import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  bookings,
  financialAccounts,
  financialTransactionAllocations,
  financialTransactions,
  journalEntries,
  journalLines,
} from "../db/schema";
import { getBookingRevenueCategory } from "../financial/categories";

import { assertBookingHasAssignee, now } from "./service-shared";
import { BookingCommandError } from "./errors";
import { appendJournalEntry, getReceivedPaymentCents, getReceivableStatus } from "./ledger";
import { isValidIsoDate } from "./validation";
import { runInImmediateTransaction } from "../db/client";
import { berlinDateKey } from "../datetime";

export type BookingMoneyMovementInput = {
  bookingId: number;
  amountCents: number;
  bookedAt?: string;
  financialAccountId?: number;
  reason: string;
  actorUserId?: string | null;
  idempotencyKey?: string | null;
};

/** Commercial rental charges already posted for a booking, excluding payments. */
export function recognizedRentalChargeCents(db: AppDatabase, bookingId: number) {
  return db
    .select({ amountCents: journalLines.amountCents })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.bookingId, bookingId),
        eq(journalEntries.kind, "rental_charge"),
        eq(journalLines.account, "accounts_receivable"),
      ),
    )
    .all()
    .reduce((sum, line) => sum + line.amountCents, 0);
}

function recordBookingRefund(db: AppDatabase, input: BookingMoneyMovementInput) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    assertBookingHasAssignee(db, booking);
    if (input.idempotencyKey) {
      const existing = db
        .select({ id: journalEntries.id })
        .from(journalEntries)
        .where(eq(journalEntries.idempotencyKey, input.idempotencyKey))
        .get();
      if (existing) return existing.id;
    }
    const bookedAt = input.bookedAt ?? berlinDateKey(now());
    if (!isValidIsoDate(bookedAt)) throw new BookingCommandError("Bitte gib ein gültiges Erfassungsdatum an.");
    const account = input.financialAccountId
      ? db.select().from(financialAccounts).where(eq(financialAccounts.id, input.financialAccountId)).get()
      : db.select().from(financialAccounts).where(eq(financialAccounts.code, "cash_main")).get();
    if (!account) throw new BookingCommandError("Bitte wähle ein gültiges Zahlungskonto aus.");
    if (account.status !== "active" || account.currency !== "EUR")
      throw new BookingCommandError("Das Zahlungskonto ist nicht aktiv oder nicht in EUR geführt.");
    const incomeCategory = getBookingRevenueCategory(db);

    const refundAmountCents = -input.amountCents;
    if (input.amountCents > Math.max(0, getReceivedPaymentCents(db, booking.id)))
      throw new BookingCommandError("Die Erstattung darf die tatsächlich erhaltenen Zahlungen nicht überschreiten");

    const occurredAt = new Date(`${bookedAt}T12:00:00.000Z`);
    const stamp = now();
    const transaction = db
      .insert(financialTransactions)
      .values({
        financialAccountId: account.id,
        source: "manual",
        provider: "manual_booking",
        kind: "refund",
        status: "imported",
        amountCents: refundAmountCents,
        grossAmountCents: refundAmountCents,
        netAmountCents: refundAmountCents,
        currency: "EUR",
        bookedAt,
        reference: booking.invoiceNumber ?? booking.orderNumber,
        description: `Stornierung / Erstattung zu ${booking.invoiceNumber ?? booking.orderNumber}`,
        metadataJson: JSON.stringify({ bookingId: booking.id, invoiceNumber: booking.invoiceNumber, manual: true }),
        importedAt: stamp,
        createdAt: stamp,
        updatedAt: stamp,
      })
      .returning({ id: financialTransactions.id })
      .get();
    const journalEntryId = appendJournalEntry(db, {
      bookingId: input.bookingId,
      financialTransactionId: transaction.id,
      kind: "refund_issued",
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      occurredAt,
      lines: [
        { account: account.code, amountCents: refundAmountCents },
        { account: "accounts_receivable", amountCents: input.amountCents },
      ],
    });
    db.insert(financialTransactionAllocations)
      .values({
        transactionId: transaction.id,
        bookingId: booking.id,
        categoryId: incomeCategory.id,
        allocationKind: "booking_refund",
        matchMethod: "manual",
        amountCents: refundAmountCents,
        note: input.reason.trim(),
        matchedByUserId: input.actorUserId ?? null,
        matchedAt: stamp,
        journalEntryId,
        createdAt: stamp,
        updatedAt: stamp,
      })
      .run();
    db.update(financialTransactions)
      .set({ status: "posted", reconciledAt: stamp, reconciledByUserId: input.actorUserId ?? null, updatedAt: stamp })
      .where(eq(financialTransactions.id, transaction.id))
      .run();
    return journalEntryId;
  });
}

export function recordRefund(db: AppDatabase, input: BookingMoneyMovementInput) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || !input.reason.trim())
    throw new BookingCommandError("Für eine Erstattung musst du einen Betrag größer als 0 € und einen Grund angeben.");
  return recordBookingRefund(db, input);
}

export function correctJournalEntry(
  db: AppDatabase,
  input: { bookingId: number; entryId: number; reason: string; actorUserId?: string | null },
) {
  if (!input.reason.trim())
    throw new BookingCommandError("Für die Korrektur des Journalpostens musst du einen Grund angeben.");
  return runInImmediateTransaction(db, () => {
    const entry = db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, input.entryId), eq(journalEntries.bookingId, input.bookingId)))
      .get();
    if (!entry)
      throw new BookingCommandError(
        "Der ausgewählte Journalposten wurde nicht gefunden. Aktualisiere die Buchung und versuche es erneut.",
      );
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    assertBookingHasAssignee(db, booking);
    const lines = db.select().from(journalLines).where(eq(journalLines.entryId, entry.id)).all();
    if (!lines.length)
      throw new BookingCommandError("Der Journalposten enthält keine Buchungszeilen und kann nicht korrigiert werden.");
    return appendJournalEntry(db, {
      bookingId: entry.bookingId ?? undefined,
      kind: "correction",
      actorUserId: input.actorUserId,
      reason: input.reason,
      reversesEntryId: entry.id,
      lines: lines.map((line) => ({ account: line.account, amountCents: -line.amountCents })),
    });
  });
}

export function getBookingPaymentStatus(db: AppDatabase, bookingId: number) {
  return getReceivableStatus(db, bookingId);
}
