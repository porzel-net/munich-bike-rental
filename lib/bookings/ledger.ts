import { and, eq, inArray } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { accountingAccounts, financialAccounts, journalEntries, journalLines } from "../db/schema";

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
    | "capital_contribution"
    | "asset_disposal"
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
  if (input.lines.length < 2) throw new BookingCommandError("Ein Journalposten braucht mindestens zwei Kontenzeilen.");
  if (
    input.lines.some(
      (line) => !line.account.trim() || !Number.isSafeInteger(line.amountCents) || line.amountCents === 0,
    )
  )
    throw new BookingCommandError("Jede Journalzeile braucht ein Konto und einen gültigen Nicht-Null-Betrag.");
  const balance = input.lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (balance !== 0) throw new BookingCommandError("Journalposten müssen ausgeglichen sein.");

  const accountCodes = [...new Set(input.lines.map((line) => line.account.trim()))];
  for (const code of accountCodes) {
    const exists = db
      .select({ id: accountingAccounts.id })
      .from(accountingAccounts)
      .where(eq(accountingAccounts.code, code))
      .get();
    if (exists) continue;
    const financialAccount = db.select().from(financialAccounts).where(eq(financialAccounts.code, code)).get();
    if (!financialAccount) continue;
    db.insert(accountingAccounts)
      .values({
        code: financialAccount.code,
        name: financialAccount.name,
        accountType: financialAccount.type === "stripe_clearing" ? "clearing" : "asset",
        isSystem: true,
        isActive: true,
        notes: `Finanzkonto ${financialAccount.code}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
  }
  const knownAccounts = db
    .select({ code: accountingAccounts.code, isActive: accountingAccounts.isActive })
    .from(accountingAccounts)
    .where(inArray(accountingAccounts.code, accountCodes))
    .all();
  const accountsByCode = new Map(knownAccounts.map((account) => [account.code, account]));
  for (const code of accountCodes) {
    const account = accountsByCode.get(code);
    if (!account) throw new BookingCommandError(`Das Buchungskonto ${code} ist nicht eingerichtet.`);
    if (!account.isActive) throw new BookingCommandError(`Das Buchungskonto ${code} ist nicht aktiv.`);
  }

  if (input.idempotencyKey) {
    const existing = db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.idempotencyKey, input.idempotencyKey))
      .get();
    if (existing) {
      const existingLines = db
        .select({ account: journalLines.account, amountCents: journalLines.amountCents })
        .from(journalLines)
        .where(eq(journalLines.entryId, existing.id))
        .all()
        .sort((a, b) => a.account.localeCompare(b.account) || a.amountCents - b.amountCents);
      const requestedLines = input.lines
        .map((line) => ({ account: line.account.trim(), amountCents: line.amountCents }))
        .sort((a, b) => a.account.localeCompare(b.account) || a.amountCents - b.amountCents);
      if (
        existing.kind !== input.kind ||
        (existing.bookingId ?? null) !== (input.bookingId ?? null) ||
        (existing.financialTransactionId ?? null) !== (input.financialTransactionId ?? null) ||
        JSON.stringify(existingLines) !== JSON.stringify(requestedLines)
      )
        throw new BookingCommandError("Der Idempotenzschlüssel gehört bereits zu einem anderen Journalposten.");
      return existing.id;
    }
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
    .values(
      input.lines.map((line) => ({ entryId: entry.id, account: line.account.trim(), amountCents: line.amountCents })),
    )
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
