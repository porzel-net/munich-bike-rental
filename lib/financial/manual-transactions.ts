import { eq } from "drizzle-orm";

import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import {
  bookings,
  financialAccounts,
  financialCategories,
  financialTransactionAllocations,
  financialTransactions,
} from "../db/schema";
import { postFinancialTransactionInTransaction } from "./reconciliation";
import { appendJournalEntry, getReceivableStatus } from "../bookings/ledger";
import { BookingCommandError } from "../bookings/errors";
import { isValidIsoDate } from "../bookings/validation";

export function getOrCreateCashAccount(db: AppDatabase) {
  const existing = db.select().from(financialAccounts).where(eq(financialAccounts.code, "cash_main")).get();
  if (existing) return existing;
  const now = new Date();
  return db
    .insert(financialAccounts)
    .values({
      code: "cash_main",
      name: "Kasse / Bargeld",
      type: "cash",
      status: "active",
      currency: "EUR",
      notes: "Manuelle Bargeld- und historische Transaktionen",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

export function createAndPostManualTransaction(
  db: AppDatabase,
  input: {
    accountId?: number;
    source: "cash" | "manual";
    bookedAt: string;
    amountCents: number;
    categoryId: number;
    bookingId?: number;
    destinationAccountId?: number;
    counterpartyName?: string;
    description?: string;
    note?: string;
    businessMeal?: {
      privateShareCents: number;
      inputVatCents?: number;
    };
    actorUserId: string;
    asset?: {
      name: string;
      assetType: "bike" | "equipment" | "other";
      serialNumber?: string | null;
      acquisitionDate: string;
      inServiceDate: string;
      acquisitionCostCents: number;
      inputVatCents?: number;
      usefulLifeMonths: number;
      residualValueCents?: number;
      notes?: string;
    };
  },
) {
  if (!isValidIsoDate(input.bookedAt)) throw new BookingCommandError("Bitte gib ein gültiges Buchungsdatum an.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0)
    throw new BookingCommandError("Der Betrag muss größer als 0 sein.");
  const booking = input.bookingId ? db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get() : null;
  if (input.bookingId && !booking) throw new BookingCommandError("Die gewählte Buchung wurde nicht gefunden.");
  const category = db.select().from(financialCategories).where(eq(financialCategories.id, input.categoryId)).get();
  if (!category || !category.isActive) throw new BookingCommandError("Die gewählte Kategorie ist nicht verfügbar.");
  if (category.euerTreatment === "needs_review")
    throw new BookingCommandError("Die Kategorie ist noch nicht EÜR-geklärt.");
  if (category.code === "rental_revenue" && !booking)
    throw new BookingCommandError("Für Mieterträge muss eine Buchung zugewiesen werden.");
  if (booking && category.code !== "rental_revenue")
    throw new BookingCommandError("Eine Buchung kann nur der sachlichen Zuordnung Mieterträge zugewiesen werden.");
  if (!booking && !input.description?.trim()) throw new BookingCommandError("Bitte gib eine Beschreibung an.");
  return runInImmediateTransaction(db, () => {
    const account = input.accountId
      ? db.select().from(financialAccounts).where(eq(financialAccounts.id, input.accountId)).get()
      : getOrCreateCashAccount(db);
    if (!account) throw new BookingCommandError("Finanzkonto nicht gefunden.");
    if (account.status !== "active" && input.source !== "manual")
      throw new BookingCommandError("Das Finanzkonto ist nicht aktiv.");
    if (account.currency !== "EUR")
      throw new BookingCommandError("Manuelle Transaktionen werden aktuell nur in EUR unterstützt.");
    if (booking) {
      const receivable = getReceivableStatus(db, booking.id);
      if (receivable.openCents <= 0) throw new BookingCommandError("Diese Buchung hat keine offene Forderung mehr.");
      if (input.amountCents > receivable.openCents)
        throw new BookingCommandError("Der Zahlungseingang ist höher als der noch offene Buchungsbetrag.");
      const now = new Date();
      const description = input.description?.trim() || `Zahlung zu ${booking.orderNumber}`;
      const transaction = db
        .insert(financialTransactions)
        .values({
          financialAccountId: account.id,
          source: input.source,
          provider: "manual",
          kind: "payment",
          status: "imported",
          amountCents: input.amountCents,
          grossAmountCents: input.amountCents,
          netAmountCents: input.amountCents,
          currency: "EUR",
          bookedAt: input.bookedAt,
          counterpartyNameSnapshot: input.counterpartyName?.trim() || booking.customerName,
          reference: booking.orderNumber,
          description,
          metadataJson: JSON.stringify({ manual: true, bookingId: booking.id }),
          importedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: financialTransactions.id })
        .get();
      const journalEntryId = appendJournalEntry(db, {
        bookingId: booking.id,
        financialTransactionId: transaction.id,
        kind: "payment_received",
        actorUserId: input.actorUserId,
        reason: input.note?.trim() || description,
        occurredAt: new Date(`${input.bookedAt}T12:00:00.000Z`),
        lines: [
          { account: account.code, amountCents: input.amountCents },
          { account: "accounts_receivable", amountCents: -input.amountCents },
        ],
      });
      db.insert(financialTransactionAllocations)
        .values({
          transactionId: transaction.id,
          bookingId: booking.id,
          allocationKind: "booking_payment",
          matchMethod: "manual",
          amountCents: input.amountCents,
          journalEntryId,
          note: input.note?.trim() || description,
          matchedByUserId: input.actorUserId,
          matchedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.update(financialTransactions)
        .set({ status: "posted", reconciledAt: now, reconciledByUserId: input.actorUserId, updatedAt: now })
        .where(eq(financialTransactions.id, transaction.id))
        .run();
      return { transactionId: transaction.id, journalEntryId };
    }
    const signedAmountCents = ["income", "output_vat"].includes(category.euerTreatment)
      ? input.amountCents
      : -input.amountCents;
    const now = new Date();
    const transaction = db
      .insert(financialTransactions)
      .values({
        financialAccountId: account.id,
        source: input.source,
        provider: "manual",
        kind: category.categoryType === "income" ? "income" : "expense",
        status: "imported",
        amountCents: signedAmountCents,
        grossAmountCents: signedAmountCents,
        netAmountCents: signedAmountCents,
        currency: "EUR",
        bookedAt: input.bookedAt,
        counterpartyNameSnapshot: input.counterpartyName?.trim() || null,
        reference: "",
        description: input.description!.trim(),
        metadataJson: JSON.stringify({ manual: true, note: input.note?.trim() || "" }),
        importedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: financialTransactions.id })
      .get();
    return postFinancialTransactionInTransaction(db, {
      transactionId: transaction.id,
      categoryId: input.categoryId,
      destinationAccountId: input.destinationAccountId,
      note: input.note?.trim() || input.description!.trim(),
      actorUserId: input.actorUserId,
      asset: input.asset,
      businessMeal: input.businessMeal,
    });
  });
}
