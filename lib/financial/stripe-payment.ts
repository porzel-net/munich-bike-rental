import { and, eq } from "drizzle-orm";

import { appendJournalEntry } from "../bookings/ledger";
import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import {
  financialAccounts,
  financialCategories,
  financialTransactionAllocations,
  financialTransactions,
} from "../db/schema";
import { getStripeCheckoutPaymentDetails } from "../stripe";

function dateInBerlin(timestampSeconds: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(timestampSeconds * 1_000))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Imports one successful Checkout payment into the financial layer.
 *
 * The financial transaction represents the net movement on Stripe. Its
 * allocations deliberately split that movement into a gross EÜR income and a
 * separate Stripe-fee expense. A later Stripe payout is therefore only a
 * transfer from stripe_main to the bank account and cannot create income a
 * second time.
 */
export async function importStripeCheckoutPayment(db: AppDatabase, input: { sessionId: string; bookingId: number }) {
  const details = await getStripeCheckoutPaymentDetails(input.sessionId);
  const balance = details.balanceTransaction;
  const existing = db
    .select({ id: financialTransactions.id })
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.source, "stripe"),
        eq(financialTransactions.provider, "stripe"),
        eq(financialTransactions.externalId, balance.id),
      ),
    )
    .get();
  if (existing) return { transactionId: existing.id, alreadyImported: true };

  const grossAmountCents = balance.amount;
  const feeAmountCents = balance.fee;
  const netAmountCents = balance.net;
  if (grossAmountCents <= 0 || netAmountCents <= 0 || feeAmountCents < 0)
    throw new Error("Stripe lieferte für die Zahlung ungültige Beträge.");

  return runInImmediateTransaction(db, () => {
    const importedDuringConcurrentWebhook = db
      .select({ id: financialTransactions.id })
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.source, "stripe"),
          eq(financialTransactions.provider, "stripe"),
          eq(financialTransactions.externalId, balance.id),
        ),
      )
      .get();
    if (importedDuringConcurrentWebhook)
      return { transactionId: importedDuringConcurrentWebhook.id, alreadyImported: true };

    const stripeAccount = db.select().from(financialAccounts).where(eq(financialAccounts.code, "stripe_main")).get();
    const revenueCategory = db
      .select()
      .from(financialCategories)
      .where(eq(financialCategories.code, "rental_revenue"))
      .get();
    const feeCategory = db.select().from(financialCategories).where(eq(financialCategories.code, "stripe_fee")).get();
    if (!stripeAccount || !revenueCategory || !feeCategory)
      throw new Error("Stripe-Konto oder EÜR-Kategorien sind nicht eingerichtet.");

    const createdAt = new Date(balance.created * 1_000);
    const bookedAt = dateInBerlin(balance.created);
    const transaction = db
      .insert(financialTransactions)
      .values({
        financialAccountId: stripeAccount.id,
        source: "stripe",
        provider: "stripe",
        externalId: balance.id,
        externalParentId: details.chargeId,
        kind: "payment",
        status: "imported",
        amountCents: netAmountCents,
        grossAmountCents,
        feeAmountCents,
        netAmountCents,
        currency: balance.currency.toUpperCase(),
        bookedAt,
        valueDate: balance.available_on ? dateInBerlin(balance.available_on) : null,
        counterpartyNameSnapshot: details.session.customer_email ?? "Stripe-Kunde",
        reference: details.session.id,
        description: `Stripe-Zahlung ${details.session.id}`,
        providerPayloadJson: JSON.stringify(details),
        metadataJson: JSON.stringify({
          sessionId: details.session.id,
          paymentIntentId: details.paymentIntentId,
          chargeId: details.chargeId,
          bookingId: input.bookingId,
          euerDateBasis: "stripe_balance_transaction_created",
        }),
        importedAt: new Date(),
        createdAt,
        updatedAt: new Date(),
      })
      .returning({ id: financialTransactions.id })
      .get();

    const feeJournalEntryId =
      feeAmountCents > 0
        ? appendJournalEntry(db, {
            bookingId: input.bookingId,
            financialTransactionId: transaction.id,
            kind: "stripe_fee",
            reason: `Stripe-Gebühr für ${details.session.id}`,
            lines: [
              { account: stripeAccount.code, amountCents: -feeAmountCents },
              { account: "stripe_fees", amountCents: feeAmountCents },
            ],
          })
        : null;

    db.insert(financialTransactionAllocations)
      .values([
        {
          transactionId: transaction.id,
          bookingId: input.bookingId,
          categoryId: revenueCategory.id,
          allocationKind: "revenue",
          matchMethod: "imported",
          amountCents: grossAmountCents,
          note: "Stripe-Zahlung als einzelne EÜR-Einnahme",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        ...(feeAmountCents > 0
          ? [
              {
                transactionId: transaction.id,
                bookingId: input.bookingId,
                categoryId: feeCategory.id,
                allocationKind: "fee" as const,
                matchMethod: "imported" as const,
                amountCents: -feeAmountCents,
                journalEntryId: feeJournalEntryId,
                note: "Stripe-Gebühr als separate EÜR-Ausgabe",
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]
          : []),
      ])
      .run();
    db.update(financialTransactions)
      .set({ status: "posted", reconciledAt: new Date(), updatedAt: new Date() })
      .where(eq(financialTransactions.id, transaction.id))
      .run();

    return { transactionId: transaction.id, alreadyImported: false };
  });
}
