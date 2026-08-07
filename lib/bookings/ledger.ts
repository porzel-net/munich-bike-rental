import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { journalEntries, journalLines } from "../db/schema";

import { BookingCommandError } from "./errors";

export type JournalCommand = {
  bookingId?: number;
  kind:
    | "rental_charge"
    | "cancellation_fee"
    | "payment_received"
    | "refund_issued"
    | "credit_note"
    | "expense"
    | "bank_transfer"
    | "stripe_fee"
    | "cash_expense"
    | "bank_fee"
    | "tax_payment"
    | "depreciation"
    | "unclassified_transaction"
    | "correction";
  financialTransactionId?: number | null;
  actorUserId?: string | null;
  idempotencyKey?: string | null;
  reason: string;
  lines: Array<{ account: string; amountCents: number }>;
  occurredAt?: Date;
  reversesEntryId?: number;
  dueAt?: Date | null;
};

export function appendJournalEntry(db: AppDatabase, input: JournalCommand) {
  const balance = input.lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (balance !== 0 || input.lines.some((line) => line.amountCents === 0))
    throw new BookingCommandError("Journal entries must be balanced and non-zero");
  if (input.idempotencyKey) {
    const existing = db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(eq(journalEntries.idempotencyKey, input.idempotencyKey))
      .get();
    if (existing) return existing.id;
  }
  const createdAt = new Date();
  const entry = db
    .insert(journalEntries)
    .values({
      bookingId: input.bookingId ?? null,
      financialTransactionId: input.financialTransactionId ?? null,
      kind: input.kind,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey ?? null,
      reversesEntryId: input.reversesEntryId ?? null,
      actorUserId: input.actorUserId ?? null,
      dueAt: input.dueAt ?? null,
      occurredAt: input.occurredAt ?? createdAt,
      createdAt,
    })
    .returning({ id: journalEntries.id })
    .get();
  db.insert(journalLines)
    .values(input.lines.map((line) => ({ entryId: entry.id, account: line.account, amountCents: line.amountCents })))
    .run();
  return entry.id;
}

export function getReceivableStatus(db: AppDatabase, bookingId: number) {
  const rows = db
    .select({ amountCents: journalLines.amountCents })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(eq(journalEntries.bookingId, bookingId), eq(journalLines.account, "accounts_receivable")))
    .all();
  const openCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
  return { openCents, status: openCents > 0 ? "open" : openCents < 0 ? "refund_due" : "settled" } as const;
}
