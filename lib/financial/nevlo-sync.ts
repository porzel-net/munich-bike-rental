import { and, eq } from "drizzle-orm";

import { NevloClient, type NevloAccount, type NevloTransaction } from "../nevlo";
import type { AppDatabase } from "../db/client";
import { financialAccounts, financialTransactions } from "../db/schema";
import { runInImmediateTransaction } from "../db/client";

function accountCode(account: NevloAccount) {
  const suffix = account.id
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toLowerCase()
    .slice(0, 40);
  return `nevlo_${suffix || "bank"}`;
}

function amountToCents(amount: number) {
  if (!Number.isFinite(amount)) throw new Error("Nevlo lieferte einen ungültigen Transaktionsbetrag.");
  const cents = Math.round(amount * 100);
  if (cents === 0) throw new Error("Nevlo-Transaktionen mit Betrag 0 werden nicht importiert.");
  return cents;
}

function optionalAmountToCents(amount?: number) {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function transactionKind(transaction: NevloTransaction): (typeof financialTransactions)["kind"]["enumValues"][number] {
  const type = transaction.type?.toLowerCase();
  const category = transaction.category?.toUpperCase();
  if (category === "TRANSFER" || type === "transfer") return "transfer";
  if (category === "TAX" || type === "tax_payment") return "tax_payment";
  if (category === "BANK_FEE" || type === "bank_fee") return "bank_fee";
  if (transaction.amount < 0) return "expense";
  return "income";
}

function lastFour(value?: string) {
  const normalized = value?.replace(/\s+/g, "");
  return normalized && normalized.length >= 4 ? normalized.slice(-4) : null;
}

function configuredAccountId() {
  return process.env.NEVLO_ACCOUNT_ID?.trim() || undefined;
}

function upsertFinancialAccount(db: AppDatabase, account: NevloAccount) {
  const existing = db
    .select()
    .from(financialAccounts)
    .where(and(eq(financialAccounts.provider, "nevlo"), eq(financialAccounts.providerAccountId, account.id)))
    .get();
  const now = new Date();
  const providerBalanceCents = optionalAmountToCents(account.balance);
  const providerBalanceAt = account.lastSyncedAt || now.toISOString();
  if (existing) {
    db.update(financialAccounts)
      .set({
        name: account.accountName || existing.name,
        currency: account.currency || existing.currency,
        notes: `Nevlo-Bankkonto${account.bankConnection?.bankName ? `: ${account.bankConnection.bankName}` : ""}`,
        ...(providerBalanceCents === null ? {} : { providerBalanceCents, providerBalanceAt }),
        updatedAt: now,
      })
      .where(eq(financialAccounts.id, existing.id))
      .run();
    return existing;
  }
  return db
    .insert(financialAccounts)
    .values({
      code: accountCode(account),
      name: account.accountName || "Nevlo-Bankkonto",
      type: "bank",
      status: "active",
      currency: account.currency || "EUR",
      provider: "nevlo",
      providerAccountId: account.id,
      openingBalanceCents: 0,
      providerBalanceCents,
      providerBalanceAt: providerBalanceCents === null ? null : providerBalanceAt,
      notes: `Nevlo-Bankkonto${account.bankConnection?.bankName ? `: ${account.bankConnection.bankName}` : ""}`,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

function importTransactions(db: AppDatabase, account: NevloAccount, transactions: NevloTransaction[]) {
  const financialAccount = upsertFinancialAccount(db, account);
  const now = new Date();
  let inserted = 0;
  let skipped = 0;
  for (const transaction of transactions) {
    const externalId = transaction.id?.trim();
    if (!externalId || !transaction.bookingDate) {
      skipped += 1;
      continue;
    }
    const exists = db
      .select({ id: financialTransactions.id })
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.source, "bank"),
          eq(financialTransactions.financialAccountId, financialAccount.id),
          eq(financialTransactions.externalId, externalId),
        ),
      )
      .get();
    if (exists) {
      skipped += 1;
      continue;
    }
    const counterpart = transaction.counterpartName || transaction.merchantName || null;
    db.insert(financialTransactions)
      .values({
        financialAccountId: financialAccount.id,
        source: "bank",
        provider: "nevlo",
        externalId,
        kind: transactionKind(transaction),
        status: "needs_review",
        amountCents: amountToCents(transaction.amount),
        currency: transaction.currency || financialAccount.currency,
        bookedAt: transaction.bookingDate,
        valueDate: transaction.valueDate || null,
        counterpartyNameSnapshot: counterpart,
        counterpartyIbanLast4: lastFour(transaction.counterpartIban),
        reference: transaction.counterpartMandateReference || "",
        description: transaction.purpose || transaction.merchantName || counterpart || "",
        bankTransactionCode: transaction.bankTransactionCode || null,
        providerPayloadJson: JSON.stringify(transaction),
        metadataJson: JSON.stringify({ nevloAccountId: account.id, importedBy: "nevlo-sync" }),
        importedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    inserted += 1;
  }
  return { account: financialAccount, inserted, skipped };
}

export async function syncNevloTransactions(
  db: AppDatabase,
  input: { accountId?: string; dateFrom?: string; dateTo?: string } = {},
) {
  const client = new NevloClient();
  const accounts = await client.getAccounts();
  if (!accounts.length) throw new Error("Nevlo hat keine verbundenen Bankkonten geliefert.");
  const requestedId = input.accountId || configuredAccountId();
  const selected = requestedId ? accounts.filter((account) => account.id === requestedId) : accounts;
  if (requestedId && selected.length === 0) throw new Error("Das konfigurierte Nevlo-Konto wurde nicht gefunden.");

  const results = [];
  for (const account of selected) {
    const transactions = await client.getAllTransactions({
      accountId: account.id,
      dateFrom: input.dateFrom || process.env.NEVLO_SYNC_DATE_FROM?.trim(),
      dateTo: input.dateTo || process.env.NEVLO_SYNC_DATE_TO?.trim(),
    });
    results.push(runInImmediateTransaction(db, () => importTransactions(db, account, transactions)));
  }
  return {
    accounts: results.map(({ account, inserted, skipped }) => ({
      id: account.providerAccountId,
      name: account.name,
      code: account.code,
      inserted,
      skipped,
    })),
    inserted: results.reduce((sum, result) => sum + result.inserted, 0),
    skipped: results.reduce((sum, result) => sum + result.skipped, 0),
  };
}
