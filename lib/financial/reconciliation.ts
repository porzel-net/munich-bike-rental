import { eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  accountingAccounts,
  financialAccounts,
  financialCategories,
  fixedAssets,
  financialTransactionAllocations,
  financialTransactions,
} from "../db/schema";
import { runInImmediateTransaction } from "../db/client";
import { appendJournalEntry } from "../bookings/ledger";
import { BookingCommandError } from "../bookings/errors";
import { createFixedAsset } from "./fixed-assets";

type JournalKind = Parameters<typeof appendJournalEntry>[1]["kind"];

function journalKindForTransaction(
  transaction: typeof financialTransactions.$inferSelect,
  category: typeof financialCategories.$inferSelect,
): JournalKind {
  if (category.categoryType === "transfer") return "bank_transfer";
  if (category.categoryType === "fee" || transaction.kind === "bank_fee") return "bank_fee";
  if (category.categoryType === "tax" || transaction.kind === "tax_payment") return "tax_payment";
  return transaction.amountCents < 0 ? "expense" : "payment_received";
}

function allocationKindForCategory(category: typeof financialCategories.$inferSelect) {
  return category.categoryType === "transfer"
    ? "transfer"
    : category.categoryType === "income"
      ? "revenue"
      : category.categoryType === "fee"
        ? "fee"
        : category.categoryType === "tax"
          ? "tax"
          : "expense";
}

function assertCategoryDirection(amountCents: number, category: typeof financialCategories.$inferSelect) {
  if (category.code === "unclassified")
    throw new BookingCommandError("Ungeklärte Transaktionen müssen zuerst geklärt werden.");
  if (category.euerTreatment === "needs_review")
    throw new BookingCommandError(
      "Die gewählte Kategorie hat noch keine konkrete EÜR-Zuordnung. Bitte wähle eine geklärte Kategorie.",
    );
  if (category.categoryType === "income" && amountCents <= 0)
    throw new BookingCommandError("Eine Einnahmenkategorie passt nur zu einem Zahlungseingang.");
  if (["expense", "fee", "tax"].includes(category.categoryType) && amountCents >= 0)
    throw new BookingCommandError("Diese Kategorie passt nur zu einer Kontobelastung.");
}

function ensureFinancialAccountInChart(db: AppDatabase, account: typeof financialAccounts.$inferSelect) {
  const existing = db
    .select({ id: accountingAccounts.id })
    .from(accountingAccounts)
    .where(eq(accountingAccounts.code, account.code))
    .get();
  if (existing) return;
  db.insert(accountingAccounts)
    .values({
      code: account.code,
      name: account.name,
      accountType: account.type === "stripe_clearing" ? "clearing" : "asset",
      isSystem: true,
      isActive: true,
      notes: `Finanzkonto ${account.code}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
}

export function postFinancialTransaction(
  db: AppDatabase,
  input: {
    transactionId: number;
    categoryId?: number;
    destinationAccountId?: number;
    note: string;
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
    businessMeal?: {
      privateShareCents: number;
      inputVatCents?: number;
    };
  },
) {
  return runInImmediateTransaction(db, () => {
    const transaction = db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.id, input.transactionId))
      .get();
    if (!transaction) throw new BookingCommandError("Banktransaktion nicht gefunden.");
    if (transaction.status === "ignored")
      throw new BookingCommandError("Eine ignorierte Transaktion kann nicht gebucht werden.");
    const existingAllocation = db
      .select()
      .from(financialTransactionAllocations)
      .where(eq(financialTransactionAllocations.transactionId, transaction.id))
      .get();
    const existingCategory = existingAllocation?.categoryId
      ? db.select().from(financialCategories).where(eq(financialCategories.id, existingAllocation.categoryId)).get()
      : undefined;
    const isEuerReclassification =
      transaction.status === "posted" && existingCategory?.euerTreatment === "needs_review" && existingAllocation;
    if (transaction.status === "posted" && !isEuerReclassification)
      throw new BookingCommandError("Diese Transaktion ist bereits vollständig gebucht.");
    const isNevloBankTransaction = transaction.source === "bank" && transaction.provider === "nevlo";
    const note = isNevloBankTransaction
      ? transaction.description.trim() || transaction.counterpartyNameSnapshot?.trim() || "Nevlo-Banktransaktion"
      : input.note.trim();
    if (!note) throw new BookingCommandError("Bitte beschreibe den Geschäftsvorfall.");

    const sourceAccount = db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.id, transaction.financialAccountId))
      .get();
    if (!sourceAccount) throw new BookingCommandError("Zugehöriges Bankkonto nicht gefunden.");

    const category = input.categoryId
      ? db.select().from(financialCategories).where(eq(financialCategories.id, input.categoryId)).get()
      : undefined;
    if (!category) throw new BookingCommandError("Bitte wähle eine Kategorie.");
    if (!category.isActive) throw new BookingCommandError("Die gewählte Kategorie ist nicht mehr aktiv.");
    assertCategoryDirection(transaction.amountCents, category);

    const isBusinessMeal = category.code === "business_meal";
    const grossCents = Math.abs(transaction.amountCents);
    let mealSplit:
      | { deductibleCents: number; nonDeductibleCents: number; privateCents: number; inputVatCents: number }
      | undefined;
    if (isBusinessMeal) {
      const privateCents = input.businessMeal?.privateShareCents ?? 0;
      const inputVatCents = input.businessMeal?.inputVatCents ?? 0;
      if (!Number.isSafeInteger(privateCents) || privateCents < 0 || privateCents > grossCents)
        throw new BookingCommandError("Der Privatanteil muss zwischen 0 € und dem Gesamtbetrag liegen.");
      const businessGrossCents = grossCents - privateCents;
      if (businessGrossCents <= 0)
        throw new BookingCommandError("Mindestens ein Teil des Geschäftsessens muss geschäftlich veranlasst sein.");
      if (!Number.isSafeInteger(inputVatCents) || inputVatCents < 0 || inputVatCents > businessGrossCents)
        throw new BookingCommandError("Die Vorsteuer darf den geschäftlichen Anteil nicht übersteigen.");
      const businessNetCents = businessGrossCents - inputVatCents;
      const deductibleCents = Math.round((businessNetCents * 70) / 100);
      mealSplit = {
        deductibleCents,
        nonDeductibleCents: businessNetCents - deductibleCents,
        privateCents,
        inputVatCents,
      };
    } else if (input.businessMeal) {
      throw new BookingCommandError("Der Privatanteil kann nur bei der Kategorie Geschäftsessen erfasst werden.");
    }

    let counterpartAccount = category.accountCode;
    let destinationAccount: typeof financialAccounts.$inferSelect | undefined;
    if (category.categoryType === "transfer") {
      if (!input.destinationAccountId)
        throw new BookingCommandError("Für eine Umbuchung muss ein Zielkonto gewählt werden.");
      destinationAccount = db
        .select()
        .from(financialAccounts)
        .where(eq(financialAccounts.id, input.destinationAccountId))
        .get();
      if (!destinationAccount) throw new BookingCommandError("Zielkonto nicht gefunden.");
      if (destinationAccount.id === sourceAccount.id)
        throw new BookingCommandError("Quell- und Zielkonto dürfen nicht identisch sein.");
      counterpartAccount = destinationAccount.code;
    }

    let fixedAsset: typeof fixedAssets.$inferSelect | undefined;
    if (category.euerTreatment === "asset_acquisition") {
      if (!input.asset) throw new BookingCommandError("Bitte erfasse die Daten des Anlageguts.");
      const grossAmountCents = Math.abs(transaction.amountCents);
      const expectedGross = input.asset.acquisitionCostCents + (input.asset.inputVatCents ?? 0);
      if (expectedGross !== grossAmountCents)
        throw new BookingCommandError(
          "Netto-Anschaffungskosten und Vorsteuer müssen dem Transaktionsbetrag entsprechen.",
        );
      fixedAsset = createFixedAsset(db, {
        ...input.asset,
        sourceTransactionId: transaction.id,
        createdByUserId: input.actorUserId,
      });
      counterpartAccount = fixedAsset.assetAccountCode;
    }

    ensureFinancialAccountInChart(db, sourceAccount);
    if (destinationAccount) ensureFinancialAccountInChart(db, destinationAccount);

    const allocationKind = allocationKindForCategory(category);
    if (isEuerReclassification && existingAllocation && existingCategory) {
      if (!existingAllocation.journalEntryId)
        throw new BookingCommandError("Die bestehende Buchung hat keinen zugehörigen Journalposten.");
      let previousCounterpartAccount = existingCategory.accountCode;
      if (existingCategory.categoryType === "transfer" && existingAllocation.destinationAccountId) {
        const previousDestination = db
          .select()
          .from(financialAccounts)
          .where(eq(financialAccounts.id, existingAllocation.destinationAccountId))
          .get();
        if (previousDestination) previousCounterpartAccount = previousDestination.code;
      }

      if (previousCounterpartAccount !== counterpartAccount) {
        appendJournalEntry(db, {
          kind: "correction",
          financialTransactionId: transaction.id,
          actorUserId: input.actorUserId,
          reason: `EÜR-Zuordnung korrigiert: ${note}`,
          lines: [
            { account: previousCounterpartAccount, amountCents: transaction.amountCents },
            { account: counterpartAccount, amountCents: -transaction.amountCents },
          ],
        });
      }

      db.update(financialTransactionAllocations)
        .set({
          categoryId: category.id,
          destinationAccountId: destinationAccount?.id ?? null,
          allocationKind,
          matchMethod: "manual",
          note,
          matchedByUserId: input.actorUserId,
          matchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(financialTransactionAllocations.id, existingAllocation.id))
        .run();
      db.update(financialTransactions)
        .set({ notes: note, updatedAt: new Date() })
        .where(eq(financialTransactions.id, transaction.id))
        .run();

      return { journalEntryId: existingAllocation.journalEntryId, transactionId: transaction.id };
    }

    const allocationParts = mealSplit
      ? [
          { category, amountCents: -mealSplit.deductibleCents, allocationKind: "expense" as const },
          ...(mealSplit.nonDeductibleCents > 0
            ? [
                {
                  category: db
                    .select()
                    .from(financialCategories)
                    .where(eq(financialCategories.code, "business_meal_non_deductible"))
                    .get(),
                  amountCents: -mealSplit.nonDeductibleCents,
                  allocationKind: "expense" as const,
                },
              ]
            : []),
          ...(mealSplit.privateCents > 0
            ? [
                {
                  category: db
                    .select()
                    .from(financialCategories)
                    .where(eq(financialCategories.code, "private_meal_share"))
                    .get(),
                  amountCents: -mealSplit.privateCents,
                  allocationKind: "expense" as const,
                },
              ]
            : []),
          ...(mealSplit.inputVatCents > 0
            ? [
                {
                  category: db.select().from(financialCategories).where(eq(financialCategories.code, "input_vat")).get(),
                  amountCents: -mealSplit.inputVatCents,
                  allocationKind: "tax" as const,
                },
              ]
            : []),
        ]
      : [{ category, amountCents: transaction.amountCents, allocationKind }];
    if (allocationParts.some((part) => !part.category))
      throw new BookingCommandError("Die Kategorien für die Geschäftsessen-Aufteilung sind nicht eingerichtet.");
    const journalEntryId = appendJournalEntry(db, {
      kind: journalKindForTransaction(transaction, category),
      financialTransactionId: transaction.id,
      actorUserId: input.actorUserId,
      reason: note,
      lines: fixedAsset
        ? [
            { account: sourceAccount.code, amountCents: transaction.amountCents },
            { account: fixedAsset.assetAccountCode, amountCents: input.asset?.acquisitionCostCents ?? 0 },
            ...(input.asset?.inputVatCents ? [{ account: "tax_input", amountCents: input.asset.inputVatCents }] : []),
          ]
        : [
            { account: sourceAccount.code, amountCents: transaction.amountCents },
            ...allocationParts.map((part) => ({ account: part.category!.accountCode, amountCents: -part.amountCents })),
          ],
    });

    const now = new Date();
    db.insert(financialTransactionAllocations)
      .values(
        allocationParts.map((part) => ({
          transactionId: transaction.id,
          categoryId: part.category!.id,
          fixedAssetId: fixedAsset?.id ?? null,
          destinationAccountId: destinationAccount?.id ?? null,
          allocationKind: part.allocationKind as "expense" | "tax",
          matchMethod: "manual" as const,
          amountCents: part.amountCents,
          journalEntryId,
          note,
          matchedByUserId: input.actorUserId,
          matchedAt: now,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();

    if (fixedAsset && input.asset?.inputVatCents) {
      const inputVatCategory = db
        .select()
        .from(financialCategories)
        .where(eq(financialCategories.code, "input_vat"))
        .get();
      if (!inputVatCategory) throw new BookingCommandError("Die Vorsteuerkategorie ist nicht eingerichtet.");
      db.insert(financialTransactionAllocations)
        .values({
          transactionId: transaction.id,
          categoryId: inputVatCategory.id,
          allocationKind: "tax",
          matchMethod: "manual",
          amountCents: -input.asset.inputVatCents,
          journalEntryId,
          note: `Vorsteuer zum Anlagegut ${fixedAsset.assetNumber}`,
          matchedByUserId: input.actorUserId,
          matchedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();
    }

    const reconciledAt = new Date();
    db.update(financialTransactions)
      .set({
        status: "posted",
        notes: note,
        reconciledAt,
        reconciledByUserId: input.actorUserId,
        updatedAt: reconciledAt,
      })
      .where(eq(financialTransactions.id, transaction.id))
      .run();

    return { journalEntryId, transactionId: transaction.id };
  });
}

export function ignoreFinancialTransaction(
  db: AppDatabase,
  input: { transactionId: number; reason: string; actorUserId: string },
) {
  if (!input.reason.trim()) throw new BookingCommandError("Bitte begründe, warum die Transaktion ignoriert wird.");
  return runInImmediateTransaction(db, () => {
    const transaction = db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.id, input.transactionId))
      .get();
    if (!transaction) throw new BookingCommandError("Banktransaktion nicht gefunden.");
    if (transaction.status === "posted")
      throw new BookingCommandError("Eine gebuchte Transaktion kann nicht ignoriert werden.");
    const now = new Date();
    const notes = [transaction.notes, `Ignoriert: ${input.reason.trim()}`].filter(Boolean).join("\n");
    db.update(financialTransactions)
      .set({
        status: "ignored",
        notes,
        reconciledAt: now,
        reconciledByUserId: input.actorUserId,
        updatedAt: now,
      })
      .where(eq(financialTransactions.id, input.transactionId))
      .run();
    return { transactionId: input.transactionId };
  });
}

export function getFinancialAccountReconciliation(db: AppDatabase, accountId: number) {
  const account = db.select().from(financialAccounts).where(eq(financialAccounts.id, accountId)).get();
  if (!account) throw new BookingCommandError("Finanzkonto nicht gefunden.");
  const movements = db
    .select({ amountCents: financialTransactions.amountCents })
    .from(financialTransactions)
    .where(eq(financialTransactions.financialAccountId, accountId))
    .all();
  const expectedBalanceCents = account.openingBalanceCents + movements.reduce((sum, row) => sum + row.amountCents, 0);
  return {
    account,
    expectedBalanceCents,
    providerBalanceCents: account.providerBalanceCents,
    differenceCents: account.providerBalanceCents === null ? null : expectedBalanceCents - account.providerBalanceCents,
  };
}
