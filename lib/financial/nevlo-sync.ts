import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";

import {
  NevloClient,
  NevloConfigurationError,
  type NevloAccount,
  type NevloStoredTokens,
  type NevloTokenStore,
  type NevloTransaction,
} from "../nevlo";
import type { AppDatabase } from "../db/client";
import { financialAccounts, financialTransactions, nevloOAuthTokens } from "../db/schema";
import { runInImmediateTransaction } from "../db/client";

let sharedClient: NevloClient | null = null;

function getNevloTokenEncryptionKey() {
  const secret = process.env.NEVLO_TOKEN_ENCRYPTION_KEY?.trim() || process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new NevloConfigurationError(
      "Für die persistente Nevlo-Token-Rotation muss NEVLO_TOKEN_ENCRYPTION_KEY oder BETTER_AUTH_SECRET konfiguriert sein.",
    );
  }
  return createHash("sha256").update(`nevlo-oauth-token-storage:${secret}`).digest();
}

function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getNevloTokenEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function decryptToken(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new NevloConfigurationError("Die gespeicherten Nevlo-Tokens haben ein unbekanntes Format.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", getNevloTokenEncryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new NevloConfigurationError("Die gespeicherten Nevlo-Tokens konnten nicht entschlüsselt werden.");
  }
}

class DatabaseNevloTokenStore implements NevloTokenStore {
  constructor(private readonly db: AppDatabase) {
    // Validate the encryption key before any network request can consume a
    // rotating refresh token that we would then be unable to persist.
    getNevloTokenEncryptionKey();
  }

  load(): NevloStoredTokens | null {
    const row = this.db.select().from(nevloOAuthTokens).where(eq(nevloOAuthTokens.id, 1)).get();
    if (!row) return null;
    return {
      accessToken: decryptToken(row.accessTokenCiphertext),
      refreshToken: decryptToken(row.refreshTokenCiphertext),
      accessTokenExpiresAt: row.accessTokenExpiresAt,
    };
  }

  save(tokens: NevloStoredTokens) {
    const now = new Date();
    this.db
      .insert(nevloOAuthTokens)
      .values({
        id: 1,
        accessTokenCiphertext: encryptToken(tokens.accessToken),
        refreshTokenCiphertext: encryptToken(tokens.refreshToken),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: nevloOAuthTokens.id,
        set: {
          accessTokenCiphertext: encryptToken(tokens.accessToken),
          refreshTokenCiphertext: encryptToken(tokens.refreshToken),
          accessTokenExpiresAt: tokens.accessTokenExpiresAt ?? null,
          updatedAt: now,
        },
      })
      .run();
  }
}

function getNevloClient(db: AppDatabase) {
  return (sharedClient ??= new NevloClient(undefined, undefined, undefined, new DatabaseNevloTokenStore(db)));
}

/** Verifies credentials and token rotation without importing any transactions. */
export async function checkNevloConnection(db: AppDatabase) {
  const accounts = await getNevloClient(db).getAccounts();
  return { accounts: accounts.length };
}

function amountToCents(amount: number) {
  if (!Number.isFinite(amount)) throw new Error("Nevlo lieferte einen ungültigen Transaktionsbetrag.");
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || cents === 0)
    throw new Error("Nevlo lieferte einen ungültigen Transaktionsbetrag.");
  return cents;
}

function optionalAmountToCents(amount?: number) {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : null;
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
  const existing = db.select().from(financialAccounts).where(eq(financialAccounts.code, "operating_main")).get();
  const now = new Date();
  const providerBalanceCents = optionalAmountToCents(account.balance);
  const providerBalanceAt = account.lastSyncedAt || now.toISOString();
  if (existing) {
    db.update(financialAccounts)
      .set({
        name: "Betriebskonto Verleih",
        iban: account.iban || existing.iban,
        currency: account.currency || existing.currency,
        provider: "nevlo",
        providerAccountId: account.id,
        notes: `Festes Nevlo-Importkonto${account.bankConnection?.bankName ? `: ${account.bankConnection.bankName}` : ""}`,
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
      code: "operating_main",
      name: "Betriebskonto Verleih",
      type: "bank",
      status: "active",
      iban: account.iban || null,
      currency: account.currency || "EUR",
      provider: "nevlo",
      providerAccountId: account.id,
      openingBalanceCents: 0,
      providerBalanceCents,
      providerBalanceAt: providerBalanceCents === null ? null : providerBalanceAt,
      notes: `Festes Nevlo-Importkonto${account.bankConnection?.bankName ? `: ${account.bankConnection.bankName}` : ""}`,
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
  const client = getNevloClient(db);
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
