import { and, desc, eq, ne } from "drizzle-orm";

import { getStripeCheckoutSession, createStripeRefund } from "../stripe";
import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import {
  bookingOffers,
  financialAccounts,
  financialTransactionAllocations,
  financialTransactions,
  journalEntries,
} from "../db/schema";
import { berlinDateKey } from "../datetime";
import { BookingCommandError } from "../bookings/errors";
import { appendJournalEntry } from "../bookings/ledger";
import { now } from "../bookings/service-shared";
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

  const existing = db
    .select({ id: journalEntries.id, bookingId: journalEntries.bookingId })
    .from(journalEntries)
    .where(eq(journalEntries.idempotencyKey, input.idempotencyKey))
    .get();
  if (existing) {
    if (existing.bookingId !== input.bookingId)
      throw new BookingCommandError("Der Idempotenzschlüssel wurde bereits für eine andere Buchung verwendet.");
    return { journalEntryId: existing.id, alreadyRefunded: true };
  }

  const offer = getAcceptedStripeOffer(db, input.bookingId);
  if (!offer?.stripeSessionId)
    throw new BookingCommandError("Für diese Buchung ist keine akzeptierte Stripe-Zahlung hinterlegt.");

  let paymentIntentId = offer.stripePaymentIntentId;
  let paidCents = offer.totalCents;
  if (!paymentIntentId) {
    const session = await getStripeCheckoutSession(offer.stripeSessionId);
    if (session.payment_status !== "paid" || session.metadata?.booking_offer_id !== String(offer.id))
      throw new BookingCommandError("Die hinterlegte Stripe-Zahlung konnte nicht sicher verifiziert werden.");
    if (session.amount_total !== offer.totalCents)
      throw new BookingCommandError("Der hinterlegte Stripe-Betrag stimmt nicht mit dem Angebot überein.");
    paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
    paidCents = session.amount_total;
  }
  if (!paymentIntentId) throw new BookingCommandError("Für die Stripe-Zahlung fehlt die Payment-Intent-Referenz.");

  const refundedCents = getKnownStripeRefundedCents(db, offer.stripeSessionId);
  const refundableCents = Math.max(0, paidCents - refundedCents);
  if (input.amountCents > refundableCents)
    throw new BookingCommandError(
      `Die Erstattung darf den noch nicht erstatteten Stripe-Betrag von ${refundableCents} Cent nicht überschreiten.`,
    );

  const refund = await createStripeRefund({
    paymentIntentId,
    amountCents: input.amountCents,
    idempotencyKey: input.idempotencyKey,
  });

  return runInImmediateTransaction(db, () => {
    const transactionOffer = getAcceptedStripeOffer(db, input.bookingId);
    if (!transactionOffer?.stripeSessionId || transactionOffer.stripeSessionId !== offer.stripeSessionId)
      throw new BookingCommandError("Die Stripe-Zahlung gehört nicht mehr zur aktuellen Buchung.");

    const transactionAlreadyImported = db
      .select({ id: financialTransactions.id })
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.source, "stripe"),
          eq(financialTransactions.provider, "stripe"),
          eq(financialTransactions.externalId, refund.id),
        ),
      )
      .get();
    if (transactionAlreadyImported) {
      const existingJournal = db
        .select({ id: journalEntries.id })
        .from(journalEntries)
        .where(eq(journalEntries.idempotencyKey, input.idempotencyKey))
        .get();
      if (existingJournal) return { journalEntryId: existingJournal.id, alreadyRefunded: true };
      throw new BookingCommandError("Diese Stripe-Erstattung ist bereits importiert, aber noch nicht zugeordnet.");
    }

    const stripeAccount = db.select().from(financialAccounts).where(eq(financialAccounts.code, "stripe_main")).get();
    const revenueCategory = getBookingRevenueCategory(db);
    if (!stripeAccount) throw new BookingCommandError("Das Stripe-Verrechnungskonto ist nicht eingerichtet.");

    const stamp = now();
    const negativeAmount = -input.amountCents;
    const transaction = db
      .insert(financialTransactions)
      .values({
        financialAccountId: stripeAccount.id,
        source: "stripe",
        provider: "stripe",
        externalId: refund.id,
        externalParentId: offer.stripeSessionId,
        kind: "refund",
        status: "imported",
        amountCents: negativeAmount,
        grossAmountCents: negativeAmount,
        netAmountCents: negativeAmount,
        currency: refund.currency.toUpperCase(),
        bookedAt: berlinDateKey(stamp),
        valueDate: berlinDateKey(stamp),
        reference: offer.stripeSessionId,
        description: `Stripe-Erstattung ${refund.id}`,
        providerPayloadJson: JSON.stringify(refund),
        metadataJson: JSON.stringify({
          bookingId: input.bookingId,
          offerId: offer.id,
          sessionId: offer.stripeSessionId,
          paymentIntentId,
          refundId: refund.id,
        }),
        importedAt: stamp,
        createdAt: stamp,
        updatedAt: stamp,
      })
      .returning({ id: financialTransactions.id })
      .get();

    const journalEntryId = appendJournalEntry(db, {
      bookingId: input.bookingId,
      financialTransactionId: transaction.id,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      kind: "refund_issued",
      reason: input.reason,
      lines: [
        { account: stripeAccount.code, amountCents: negativeAmount },
        { account: "accounts_receivable", amountCents: input.amountCents },
      ],
    });

    db.insert(financialTransactionAllocations)
      .values({
        transactionId: transaction.id,
        bookingId: input.bookingId,
        categoryId: revenueCategory.id,
        allocationKind: "booking_refund",
        matchMethod: "imported",
        amountCents: negativeAmount,
        note: input.reason.trim(),
        matchedByUserId: input.actorUserId,
        matchedAt: stamp,
        journalEntryId,
        createdAt: stamp,
        updatedAt: stamp,
      })
      .run();
    db.update(financialTransactions)
      .set({ status: "posted", reconciledAt: stamp, reconciledByUserId: input.actorUserId, updatedAt: stamp })
      .where(eq(financialTransactions.id, transaction.id))
      .run();

    return { journalEntryId, transactionId: transaction.id, alreadyRefunded: false };
  });
}
