import { and, desc, eq, ne } from "drizzle-orm";

import { BookingCommandError } from "../bookings/errors";
import { appendJournalEntry } from "../bookings/ledger";
import { now } from "../bookings/service-shared";
import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import {
  bookingOffers,
  financialAccounts,
  financialTransactionAllocations,
  financialTransactions,
  journalEntries,
  stripeRefundOperations,
} from "../db/schema";
import { berlinDateKey } from "../datetime";
import {
  createStripeRefund,
  getStripeCheckoutSession,
  listStripeRefundsForPaymentIntent,
  type StripeRefund,
} from "../stripe";

import { getBookingRevenueCategory } from "./categories";

function positiveGrossAmount(transaction: typeof financialTransactions.$inferSelect) {
  return Math.abs(transaction.grossAmountCents ?? transaction.amountCents);
}

function getAcceptedStripeOffer(db: AppDatabase, bookingId: number) {
  return db
    .select()
    .from(bookingOffers)
    .where(and(eq(bookingOffers.bookingId, bookingId), eq(bookingOffers.status, "accepted")))
    .orderBy(desc(bookingOffers.acceptedAt), desc(bookingOffers.id))
    .get();
}

function getKnownStripeRefundedCents(db: AppDatabase, sessionId: string) {
  return db
    .select()
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.source, "stripe"),
        eq(financialTransactions.provider, "stripe"),
        eq(financialTransactions.reference, sessionId),
        eq(financialTransactions.kind, "refund"),
        ne(financialTransactions.status, "ignored"),
      ),
    )
    .all()
    .reduce((sum, transaction) => sum + positiveGrossAmount(transaction), 0);
}

function assertStripeRefund(refund: StripeRefund, expectedCurrency = "EUR") {
  if (!Number.isSafeInteger(refund.amount) || refund.amount <= 0)
    throw new BookingCommandError("Stripe lieferte einen ungültigen Erstattungsbetrag.");
  if (refund.currency.toUpperCase() !== expectedCurrency)
    throw new BookingCommandError("Stripe-Erstattungen werden aktuell nur in EUR unterstützt.");
  if (refund.status !== "succeeded" && refund.status !== "pending")
    throw new BookingCommandError("Stripe hat die Erstattung nicht erfolgreich angenommen.");
}

async function resolvePaymentIntent(db: AppDatabase, offer: typeof bookingOffers.$inferSelect) {
  if (offer.stripePaymentIntentId) {
    return { paymentIntentId: offer.stripePaymentIntentId, paidCents: offer.totalCents };
  }
  if (!offer.stripeSessionId)
    throw new BookingCommandError("Für diese Buchung ist keine akzeptierte Stripe-Zahlung hinterlegt.");
  const session = await getStripeCheckoutSession(offer.stripeSessionId);
  if (
    session.payment_status !== "paid" ||
    session.metadata?.booking_offer_id !== String(offer.id) ||
    session.metadata?.booking_id !== String(offer.bookingId) ||
    session.amount_total !== offer.totalCents ||
    session.currency?.toLowerCase() !== "eur"
  )
    throw new BookingCommandError("Die hinterlegte Stripe-Zahlung konnte nicht sicher verifiziert werden.");
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  if (!paymentIntentId) throw new BookingCommandError("Für die Stripe-Zahlung fehlt die Payment-Intent-Referenz.");
  db.update(bookingOffers).set({ stripePaymentIntentId: paymentIntentId }).where(eq(bookingOffers.id, offer.id)).run();
  return { paymentIntentId, paidCents: session.amount_total };
}

function getOperationByRefundId(db: AppDatabase, stripeRefundId: string) {
  return db
    .select()
    .from(stripeRefundOperations)
    .where(eq(stripeRefundOperations.stripeRefundId, stripeRefundId))
    .get();
}

function getTransactionByRefundId(db: AppDatabase, stripeRefundId: string) {
  return db
    .select()
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.source, "stripe"),
        eq(financialTransactions.provider, "stripe"),
        eq(financialTransactions.externalId, stripeRefundId),
        eq(financialTransactions.kind, "refund"),
      ),
    )
    .get();
}

function postSucceededRefund(
  db: AppDatabase,
  operation: typeof stripeRefundOperations.$inferSelect,
  refund: StripeRefund,
) {
  assertStripeRefund(refund);
  if (refund.status !== "succeeded") {
    db.update(stripeRefundOperations)
      .set({ status: "pending", stripeRefundId: refund.id, updatedAt: now() })
      .where(eq(stripeRefundOperations.id, operation.id))
      .run();
    return { operationId: operation.id, status: "pending" as const, transactionId: null, journalEntryId: null };
  }

  const existingTransaction = getTransactionByRefundId(db, refund.id);
  const offer = db.select().from(bookingOffers).where(eq(bookingOffers.id, operation.offerId)).get();
  if (!offer?.stripeSessionId)
    throw new BookingCommandError("Das Stripe-Angebot für die Erstattung wurde nicht gefunden.");
  const stripeAccount = db.select().from(financialAccounts).where(eq(financialAccounts.code, "stripe_main")).get();
  const revenueCategory = getBookingRevenueCategory(db);
  if (!stripeAccount) throw new BookingCommandError("Das Stripe-Verrechnungskonto ist nicht eingerichtet.");

  const stamp = now();
  const negativeAmount = -refund.amount;
  const transaction =
    existingTransaction ??
    db
      .insert(financialTransactions)
      .values({
        financialAccountId: stripeAccount.id,
        source: "stripe",
        provider: "stripe",
        externalId: refund.id,
        externalParentId: operation.paymentIntentId,
        kind: "refund",
        status: "imported",
        amountCents: negativeAmount,
        grossAmountCents: negativeAmount,
        netAmountCents: negativeAmount,
        currency: refund.currency.toUpperCase(),
        bookedAt: berlinDateKey(refund.created ? new Date(refund.created * 1_000) : stamp),
        valueDate: berlinDateKey(refund.created ? new Date(refund.created * 1_000) : stamp),
        reference: offer.stripeSessionId,
        description: `Stripe-Erstattung ${refund.id}`,
        providerPayloadJson: JSON.stringify(refund),
        metadataJson: JSON.stringify({
          bookingId: operation.bookingId,
          offerId: operation.offerId,
          sessionId: offer.stripeSessionId,
          paymentIntentId: operation.paymentIntentId,
          refundId: refund.id,
          external: operation.idempotencyKey.startsWith("stripe-external:"),
        }),
        importedAt: stamp,
        createdAt: stamp,
        updatedAt: stamp,
      })
      .returning()
      .get();

  const existingJournal = db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(eq(journalEntries.idempotencyKey, operation.idempotencyKey))
    .get();
  const journalEntryId =
    existingJournal?.id ??
    appendJournalEntry(db, {
      bookingId: operation.bookingId,
      financialTransactionId: transaction.id,
      actorUserId: operation.actorUserId,
      idempotencyKey: operation.idempotencyKey,
      kind: "refund_issued",
      reason: operation.reason,
      lines: [
        { account: stripeAccount.code, amountCents: negativeAmount },
        { account: "accounts_receivable", amountCents: refund.amount },
      ],
    });

  const existingAllocation = db
    .select({ id: financialTransactionAllocations.id })
    .from(financialTransactionAllocations)
    .where(eq(financialTransactionAllocations.transactionId, transaction.id))
    .get();
  if (!existingAllocation) {
    db.insert(financialTransactionAllocations)
      .values({
        transactionId: transaction.id,
        bookingId: operation.bookingId,
        categoryId: revenueCategory.id,
        allocationKind: "booking_refund",
        matchMethod: "imported",
        amountCents: negativeAmount,
        note: operation.reason,
        matchedByUserId: operation.actorUserId,
        matchedAt: stamp,
        journalEntryId,
        createdAt: stamp,
        updatedAt: stamp,
      })
      .run();
  }
  db.update(financialTransactions)
    .set({ status: "posted", reconciledAt: stamp, reconciledByUserId: operation.actorUserId, updatedAt: stamp })
    .where(eq(financialTransactions.id, transaction.id))
    .run();
  db.update(stripeRefundOperations)
    .set({
      status: "posted",
      stripeRefundId: refund.id,
      financialTransactionId: transaction.id,
      journalEntryId,
      failureMessage: null,
      updatedAt: stamp,
    })
    .where(eq(stripeRefundOperations.id, operation.id))
    .run();
  return { operationId: operation.id, status: "posted" as const, transactionId: transaction.id, journalEntryId };
}

function createOrReusePendingOperation(
  db: AppDatabase,
  input: {
    bookingId: number;
    offerId: number;
    paymentIntentId: string;
    sessionId: string;
    paidCents: number;
    amountCents: number;
    reason: string;
    actorUserId: string;
    idempotencyKey: string;
  },
) {
  return runInImmediateTransaction(db, () => {
    const existing = db
      .select()
      .from(stripeRefundOperations)
      .where(eq(stripeRefundOperations.idempotencyKey, input.idempotencyKey))
      .get();
    if (existing) {
      if (
        existing.bookingId !== input.bookingId ||
        existing.offerId !== input.offerId ||
        existing.amountCents !== input.amountCents ||
        existing.paymentIntentId !== input.paymentIntentId
      )
        throw new BookingCommandError("Der Idempotenzschlüssel gehört bereits zu einem anderen Refund.");
      if (existing.status === "posted") return existing;
      if (existing.status === "failed") {
        db.update(stripeRefundOperations)
          .set({ status: "pending", failureMessage: null, updatedAt: now() })
          .where(eq(stripeRefundOperations.id, existing.id))
          .run();
        return { ...existing, status: "pending" as const, failureMessage: null };
      }
      return existing;
    }

    const refundedCents = getKnownStripeRefundedCents(db, input.sessionId);
    const reservedCents = db
      .select({ amountCents: stripeRefundOperations.amountCents })
      .from(stripeRefundOperations)
      .where(
        and(
          eq(stripeRefundOperations.paymentIntentId, input.paymentIntentId),
          ne(stripeRefundOperations.status, "failed"),
          ne(stripeRefundOperations.status, "posted"),
        ),
      )
      .all()
      .reduce((sum, operation) => sum + operation.amountCents, 0);
    const refundableCents = Math.max(0, input.paidCents - refundedCents - reservedCents);
    if (input.amountCents > refundableCents)
      throw new BookingCommandError(
        `Die Erstattung darf den noch nicht erstatteten Stripe-Betrag von ${refundableCents} Cent nicht überschreiten.`,
      );

    return db
      .insert(stripeRefundOperations)
      .values({
        bookingId: input.bookingId,
        offerId: input.offerId,
        paymentIntentId: input.paymentIntentId,
        idempotencyKey: input.idempotencyKey,
        amountCents: input.amountCents,
        currency: "EUR",
        status: "pending",
        reason: input.reason.trim(),
        actorUserId: input.actorUserId,
        createdAt: now(),
        updatedAt: now(),
      })
      .returning()
      .get();
  });
}

async function importStripeRefundForOffer(
  db: AppDatabase,
  offer: typeof bookingOffers.$inferSelect,
  refund: StripeRefund,
  actorUserId?: string | null,
) {
  assertStripeRefund(refund);
  const existingOperation = getOperationByRefundId(db, refund.id);
  const operation =
    existingOperation ??
    runInImmediateTransaction(db, () =>
      db
        .insert(stripeRefundOperations)
        .values({
          bookingId: offer.bookingId,
          offerId: offer.id,
          paymentIntentId: offer.stripePaymentIntentId!,
          stripeRefundId: refund.id,
          idempotencyKey: `stripe-external:${refund.id}`,
          amountCents: refund.amount,
          currency: refund.currency.toUpperCase(),
          status: refund.status === "succeeded" ? "succeeded" : "pending",
          reason: "Extern in Stripe erfasste Rückerstattung",
          actorUserId: actorUserId ?? null,
          createdAt: now(),
          updatedAt: now(),
        })
        .returning()
        .get(),
    );
  if (operation.status === "posted") return { imported: false, posted: true, operationId: operation.id };
  const result = runInImmediateTransaction(db, () => postSucceededRefund(db, operation, refund));
  return { imported: !existingOperation, posted: result.status === "posted", operationId: operation.id };
}

export async function syncStripeRefundsForOffer(
  db: AppDatabase,
  offer: typeof bookingOffers.$inferSelect,
  actorUserId?: string | null,
) {
  if (!offer.stripePaymentIntentId) return { scanned: 0, imported: 0, posted: 0, pending: 0 };
  let startingAfter: string | undefined;
  let scanned = 0;
  let imported = 0;
  let posted = 0;
  let pending = 0;
  do {
    const page = await listStripeRefundsForPaymentIntent(offer.stripePaymentIntentId, { startingAfter, limit: 100 });
    for (const refund of page.data) {
      scanned += 1;
      const result = await importStripeRefundForOffer(db, offer, refund, actorUserId);
      imported += Number(result.imported);
      posted += Number(result.posted);
      pending += Number(!result.posted);
    }
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data.at(-1)?.id;
  } while (startingAfter);
  return { scanned, imported, posted, pending };
}

export async function syncStripeRefunds(db: AppDatabase, actorUserId?: string | null) {
  const offers = db
    .select()
    .from(bookingOffers)
    .where(eq(bookingOffers.status, "accepted"))
    .all()
    .filter((offer) => Boolean(offer.stripePaymentIntentId));
  const result = { scanned: 0, imported: 0, posted: 0, pending: 0, failed: 0, errors: [] as string[] };
  for (const offer of offers) {
    try {
      const current = await syncStripeRefundsForOffer(db, offer, actorUserId);
      result.scanned += current.scanned;
      result.imported += current.imported;
      result.posted += current.posted;
      result.pending += current.pending;
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 20)
        result.errors.push(
          `${offer.id}: ${error instanceof Error ? error.message : "Unbekannter Stripe-Refund-Fehler."}`,
        );
    }
  }
  return result;
}

export async function refundStripeBookingPayment(
  db: AppDatabase,
  input: {
    bookingId: number;
    amountCents: number;
    reason: string;
    actorUserId: string;
    idempotencyKey: string;
  },
) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0)
    throw new BookingCommandError("Der Stripe-Erstattungsbetrag muss positiv sein.");
  if (!input.reason.trim()) throw new BookingCommandError("Für eine Stripe-Erstattung ist ein Grund erforderlich.");
  if (!input.idempotencyKey.trim())
    throw new BookingCommandError("Für eine Stripe-Erstattung ist ein Idempotenzschlüssel erforderlich.");

  const offer = getAcceptedStripeOffer(db, input.bookingId);
  if (!offer?.stripeSessionId)
    throw new BookingCommandError("Für diese Buchung ist keine akzeptierte Stripe-Zahlung hinterlegt.");
  const payment = await resolvePaymentIntent(db, offer);
  await syncStripeRefundsForOffer(db, { ...offer, stripePaymentIntentId: payment.paymentIntentId }, input.actorUserId);
  const operation = createOrReusePendingOperation(db, {
    bookingId: input.bookingId,
    offerId: offer.id,
    paymentIntentId: payment.paymentIntentId,
    sessionId: offer.stripeSessionId,
    paidCents: payment.paidCents,
    amountCents: input.amountCents,
    reason: input.reason,
    actorUserId: input.actorUserId,
    idempotencyKey: input.idempotencyKey,
  });
  if (operation.status === "posted")
    return {
      operationId: operation.id,
      journalEntryId: operation.journalEntryId,
      alreadyRefunded: true,
      status: "posted" as const,
    };

  let refund: StripeRefund;
  try {
    refund = await createStripeRefund({
      paymentIntentId: payment.paymentIntentId,
      amountCents: input.amountCents,
      idempotencyKey: input.idempotencyKey,
      metadata: {
        application_refund_operation_id: String(operation.id),
        booking_id: String(input.bookingId),
        booking_offer_id: String(offer.id),
      },
    });
  } catch (error) {
    runInImmediateTransaction(db, () => {
      db.update(stripeRefundOperations)
        .set({
          status: "failed",
          failureMessage: error instanceof Error ? error.message : "Unbekannter Stripe-Fehler.",
          updatedAt: now(),
        })
        .where(eq(stripeRefundOperations.id, operation.id))
        .run();
    });
    throw error;
  }

  return runInImmediateTransaction(db, () => {
    const current = db.select().from(stripeRefundOperations).where(eq(stripeRefundOperations.id, operation.id)).get();
    if (!current) throw new BookingCommandError("Der Stripe-Refund-Vorgang wurde nicht gefunden.");
    const result = postSucceededRefund(db, current, refund);
    return {
      operationId: current.id,
      transactionId: result.transactionId,
      journalEntryId: result.journalEntryId,
      alreadyRefunded: false,
      status: result.status,
    };
  });
}
