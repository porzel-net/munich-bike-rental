import { eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { financialAccounts, financialCategories, financialTransactions } from "../db/schema";
import { postFinancialTransaction } from "./reconciliation";
import { BookingCommandError } from "../bookings/errors";

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
    destinationAccountId?: number;
    counterpartyName?: string;
    description: string;
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.bookedAt))
    throw new BookingCommandError("Bitte gib ein gültiges Buchungsdatum an.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0)
    throw new BookingCommandError("Der Betrag muss größer als 0 sein.");
  if (!input.description.trim()) throw new BookingCommandError("Bitte gib eine Beschreibung an.");
  const category = db.select().from(financialCategories).where(eq(financialCategories.id, input.categoryId)).get();
  if (!category || !category.isActive) throw new BookingCommandError("Die gewählte Kategorie ist nicht verfügbar.");
  if (category.euerTreatment === "needs_review")
    throw new BookingCommandError("Die Kategorie ist noch nicht EÜR-geklärt.");
  const account = input.accountId
    ? db.select().from(financialAccounts).where(eq(financialAccounts.id, input.accountId)).get()
    : getOrCreateCashAccount(db);
  if (!account) throw new BookingCommandError("Finanzkonto nicht gefunden.");
  if (account.status !== "active") throw new BookingCommandError("Das Finanzkonto ist nicht aktiv.");
  if (account.currency !== "EUR")
    throw new BookingCommandError("Manuelle Transaktionen werden aktuell nur in EUR unterstützt.");
  const signedAmountCents = category.categoryType === "income" ? input.amountCents : -input.amountCents;
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
      description: input.description.trim(),
      metadataJson: JSON.stringify({ manual: true, note: input.note?.trim() || "" }),
      importedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: financialTransactions.id })
    .get();
  return postFinancialTransaction(db, {
    transactionId: transaction.id,
    categoryId: input.categoryId,
    destinationAccountId: input.destinationAccountId,
    note: input.note?.trim() || input.description.trim(),
    actorUserId: input.actorUserId,
    asset: input.asset,
    businessMeal: input.businessMeal,
  });
}
