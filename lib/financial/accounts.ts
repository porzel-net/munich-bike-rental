import { eq } from "drizzle-orm";

import { BookingCommandError } from "../bookings/errors";
import { recordAdminAuditEvent } from "../auth/audit";
import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import { financialAccounts, financialTransactions } from "../db/schema";
import { isValidIsoDate } from "../bookings/validation";

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
