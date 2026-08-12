import { eq } from "drizzle-orm";

import { BookingCommandError } from "../bookings/errors";
import { recordAdminAuditEvent } from "../auth/audit";
import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import { accountingAccounts, financialAccounts, financialAccountTypes, financialTransactions } from "../db/schema";
import { isValidIsoDate } from "../bookings/validation";

export type CreateFinancialAccountInput = {
  code: string;
  name: string;
  type: (typeof financialAccountTypes)[number];
  currency: string;
  iban?: string | null;
  provider?: string | null;
  notes?: string;
};

function accountingTypeForFinancialAccount(type: CreateFinancialAccountInput["type"]) {
  return type === "stripe_clearing" ? "clearing" : "asset";
}

/** Creates a manually configured financial account and its matching journal account. */
export function createFinancialAccount(db: AppDatabase, input: CreateFinancialAccountInput, actorUserId: string) {
  return runInImmediateTransaction(db, () => {
    const existingFinancialAccount = db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(eq(financialAccounts.code, input.code))
      .get();
    if (existingFinancialAccount) throw new BookingCommandError("Diese Kontokennung ist bereits vergeben.");

    const existingAccountingAccount = db
      .select({ id: accountingAccounts.id })
      .from(accountingAccounts)
      .where(eq(accountingAccounts.code, input.code))
      .get();
    if (existingAccountingAccount)
      throw new BookingCommandError("Diese Kontokennung ist bereits im Kontenplan vorhanden.");

    const now = new Date();
    const account = db
      .insert(financialAccounts)
      .values({
        code: input.code,
        name: input.name,
        type: input.type,
        status: "active",
        iban: input.iban || null,
        currency: input.currency,
        provider: input.provider || "internal",
        notes: input.notes || "",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    db.insert(accountingAccounts)
      .values({
        code: input.code,
        name: input.name,
        accountType: accountingTypeForFinancialAccount(input.type),
        isSystem: false,
        isActive: true,
        notes: `Manuell angelegtes Finanzkonto ${input.code}`,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    recordAdminAuditEvent(db, {
      actorUserId,
      action: "financial_account_created",
      targetType: "financial_account",
      targetId: account.id,
      metadata: {
        code: account.code,
        name: account.name,
        type: account.type,
        currency: account.currency,
      },
    });

    return account;
  });
}

export function setFinancialAccountStatus(
  db: AppDatabase,
  input: { accountId: number; status: "active" | "archived"; actorUserId: string },
) {
  return runInImmediateTransaction(db, () => {
    const account = db.select().from(financialAccounts).where(eq(financialAccounts.id, input.accountId)).get();
    if (!account) throw new BookingCommandError("Finanzkonto nicht gefunden.");
    const now = new Date();
    db.update(financialAccounts)
      .set({ status: input.status, updatedAt: now })
      .where(eq(financialAccounts.id, account.id))
      .run();
    db.update(accountingAccounts)
      .set({ isActive: input.status === "active", updatedAt: now })
      .where(eq(accountingAccounts.code, account.code))
      .run();
    recordAdminAuditEvent(db, {
      actorUserId: input.actorUserId,
      action: input.status === "active" ? "financial_account_reactivated" : "financial_account_archived",
      targetType: "financial_account",
      targetId: account.id,
      metadata: { code: account.code },
    });
    return { accountId: account.id, status: input.status };
  });
}

/**
 * Opening balances are only editable before the first imported movement.
 * Once movements exist, corrections must be represented by an auditable
 * transaction instead of rewriting the reconciliation baseline.
 */
export function updateOpeningBalance(
  db: AppDatabase,
  input: {
    accountId: number;
    openingBalanceCents: number;
    openingBalanceDate: string;
    actorUserId: string | null;
  },
) {
  if (!Number.isSafeInteger(input.openingBalanceCents))
    throw new BookingCommandError("Der Anfangsbestand muss ein gültiger Centbetrag sein.");
  if (!isValidIsoDate(input.openingBalanceDate))
    throw new BookingCommandError("Bitte gib ein gültiges Datum des Anfangsbestands an.");
  return runInImmediateTransaction(db, () => {
    const account = db.select().from(financialAccounts).where(eq(financialAccounts.id, input.accountId)).get();
    if (!account) throw new BookingCommandError("Finanzkonto nicht gefunden.");

    const firstMovement = db
      .select({ id: financialTransactions.id })
      .from(financialTransactions)
      .where(eq(financialTransactions.financialAccountId, account.id))
      .get();
    if (firstMovement) {
      throw new BookingCommandError(
        "Der Anfangsbestand ist nach dem ersten Kontoumsatz unveränderlich. Bitte buche eine Korrekturtransaktion.",
      );
    }

    db.update(financialAccounts)
      .set({
        openingBalanceCents: input.openingBalanceCents,
        openingBalanceDate: input.openingBalanceDate,
        updatedAt: new Date(),
      })
      .where(eq(financialAccounts.id, account.id))
      .run();

    recordAdminAuditEvent(db, {
      actorUserId: input.actorUserId,
      action: "opening_balance_changed",
      targetType: "financial_account",
      targetId: account.id,
      metadata: {
        openingBalanceCents: input.openingBalanceCents,
        openingBalanceDate: input.openingBalanceDate,
      },
    });

    return { accountId: account.id };
  });
}
