import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import {
  authUser,
  financialAccounts,
  financialCategories,
  financialTransactionAllocations,
  financialTransactions,
  fixedAssets,
  journalEntries,
} from "../../lib/db/schema";
import { appendJournalEntry } from "../../lib/bookings/ledger";
import {
  createFixedAsset,
  disposeFixedAsset,
  postDueFixedAssetDepreciation,
  postFixedAssetDepreciation,
} from "../../lib/financial/fixed-assets";
import { createAndPostManualTransaction } from "../../lib/financial/manual-transactions";
import { getEuerSummary } from "../../lib/financial/euer";
import { getFinancialAccountReconciliation, postFinancialTransaction } from "../../lib/financial/reconciliation";
import { updateOpeningBalance } from "../../lib/financial/accounts";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function setup() {
  const connection = createDatabaseConnection(":memory:");
  connections.push(connection);
  const { db } = connection;
  db.insert(authUser)
    .values({
      id: "admin",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      twoFactorEnabled: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  const bank = db
    .insert(financialAccounts)
    .values({
      code: "edge_bank",
      name: "Edge-Bankkonto",
      type: "bank",
      provider: "test",
      currency: "EUR",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();
  const cash = db.select().from(financialAccounts).where(eq(financialAccounts.code, "cash_main")).get()!;
  const category = (code: string) =>
    db.select().from(financialCategories).where(eq(financialCategories.code, code)).get()!;
  return { db, bank, cash, category };
}

function transaction(
  db: ReturnType<typeof setup>["db"],
  financialAccountId: number,
  amountCents: number,
  bookedAt = "2026-08-10",
  kind: "income" | "expense" | "refund" | "transfer" = amountCents > 0 ? "income" : "expense",
  valueDate?: string,
) {
  return db
    .insert(financialTransactions)
    .values({
      financialAccountId,
      source: "bank",
      provider: "edge-test",
      externalId: `edge-${Math.random()}`,
      kind,
      status: "needs_review",
      amountCents,
      currency: "EUR",
      bookedAt,
      valueDate,
      description: "Edge-Case-Transaktion",
      importedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();
}

function post(
  db: ReturnType<typeof setup>["db"],
  transactionId: number,
  categoryId: number,
  note = "Edge-Case-Buchung",
  destinationAccountId?: number,
) {
  return postFinancialTransaction(db, {
    transactionId,
    categoryId,
    destinationAccountId,
    note,
    actorUserId: "admin",
  });
}

describe("financial edge cases", () => {
  it("rejects impossible calendar dates before creating a manual transaction", () => {
    const { db, category } = setup();

    expect(() =>
      createAndPostManualTransaction(db, {
        source: "cash",
        bookedAt: "2026-02-30",
        amountCents: 1_000,
        categoryId: category("maintenance").id,
        description: "Ungültiges Datum",
        actorUserId: "admin",
      }),
    ).toThrow("gültiges Buchungsdatum");
    expect(db.select().from(financialTransactions).all()).toHaveLength(0);
  });

  it("rejects invalid depreciation months and does not create partial AfA", () => {
    const { db } = setup();
    const asset = createFixedAsset(db, {
      name: "AfA-Grenzfall",
      assetType: "equipment",
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      acquisitionCostCents: 12_000,
      usefulLifeMonths: 12,
      createdByUserId: "admin",
    });

    expect(() =>
      postFixedAssetDepreciation(db, { assetId: asset.id, periodStart: "2026-13-01", actorUserId: "admin" }),
    ).toThrow("Ungültiger AfA-Monat");
    expect(() => postDueFixedAssetDepreciation(db, { throughMonth: "2026-13", actorUserId: "admin" })).toThrow(
      "Ungültiger Abrechnungsmonat",
    );
    expect(getEuerSummary(db, 2026).rows.filter((row) => row.source === "depreciation")).toHaveLength(0);
  });

  it("rejects direction mismatches, invalid destinations and positive refunds atomically", () => {
    const { db, bank, cash, category } = setup();
    const positiveExpense = transaction(db, bank.id, 1_000);
    expect(() => post(db, positiveExpense.id, category("maintenance").id)).toThrow("Kontobelastung");

    const negativeIncome = transaction(db, bank.id, -1_000);
    expect(() => post(db, negativeIncome.id, category("rental_revenue").id)).toThrow("Zahlungseingang");

    const positiveRefund = transaction(db, bank.id, 1_000, "2026-08-10", "refund");
    expect(() => post(db, positiveRefund.id, category("rental_revenue").id)).toThrow("negative");

    const destinationOnExpense = transaction(db, bank.id, -1_000);
    expect(() => post(db, destinationOnExpense.id, category("maintenance").id, "Falsches Ziel", cash.id)).toThrow(
      "Zielkonto",
    );

    const sameAccountTransfer = transaction(db, bank.id, -1_000, "2026-08-10", "transfer");
    expect(() => post(db, sameAccountTransfer.id, category("internal_transfer").id, "Selbsttransfer", bank.id)).toThrow(
      "identisch",
    );
    expect(db.select().from(journalEntries).all()).toHaveLength(0);
    expect(
      db
        .select()
        .from(financialTransactions)
        .all()
        .every((row) => row.status === "needs_review"),
    ).toBe(true);
  });

  it("reclassifies exactly one unresolved allocation without changing its amount", () => {
    const { db, bank, category } = setup();
    const tx = transaction(db, bank.id, -1_250);
    const unresolved = category("unclassified");
    const journalEntryId = appendJournalEntry(db, {
      financialTransactionId: tx.id,
      kind: "expense",
      actorUserId: "admin",
      reason: "Vorläufige Zuordnung",
      lines: [
        { account: bank.code, amountCents: -1_250 },
        { account: unresolved.accountCode, amountCents: 1_250 },
      ],
    });
    db.insert(financialTransactionAllocations)
      .values({
        transactionId: tx.id,
        categoryId: unresolved.id,
        allocationKind: "other",
        matchMethod: "unmatched",
        amountCents: -1_250,
        journalEntryId,
        note: "Vorläufig",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    db.update(financialTransactions).set({ status: "posted" }).where(eq(financialTransactions.id, tx.id)).run();

    post(db, tx.id, category("maintenance").id, "Nach Prüfung geklärt");

    const allocation = db
      .select()
      .from(financialTransactionAllocations)
      .where(eq(financialTransactionAllocations.transactionId, tx.id))
      .get()!;
    expect(allocation.categoryId).toBe(category("maintenance").id);
    expect(allocation.amountCents).toBe(-1_250);
    expect(db.select().from(journalEntries).where(eq(journalEntries.financialTransactionId, tx.id)).all()).toHaveLength(
      2,
    );
    expect(getEuerSummary(db, 2026)).toMatchObject({ expenseCents: 1_250, profitCents: -1_250, unresolvedCents: 0 });
  });

  it("allows correcting the category of an already posted simple transaction", () => {
    const { db, bank, category } = setup();
    const tx = transaction(db, bank.id, -1_250);

    post(db, tx.id, category("maintenance").id, "Ursprüngliche Zuordnung");
    post(db, tx.id, category("bank_fee").id, "Nachträglich korrigiert");

    const allocation = db
      .select()
      .from(financialTransactionAllocations)
      .where(eq(financialTransactionAllocations.transactionId, tx.id))
      .get()!;
    expect(allocation).toMatchObject({ categoryId: category("bank_fee").id, amountCents: -1_250 });
    expect(db.select().from(journalEntries).where(eq(journalEntries.financialTransactionId, tx.id)).all()).toHaveLength(
      2,
    );
    expect(getEuerSummary(db, 2026)).toMatchObject({ expenseCents: 1_250, profitCents: -1_250, unresolvedCents: 0 });
  });

  it("keeps year boundaries and non-posted transactions out of the wrong EÜR", () => {
    const { db, bank, category } = setup();
    post(db, transaction(db, bank.id, 2_000, "2025-12-31").id, category("rental_revenue").id);
    const pending = transaction(db, bank.id, 3_000, "2026-01-01");
    post(db, pending.id, category("rental_revenue").id);
    db.update(financialTransactions)
      .set({ status: "needs_review" })
      .where(eq(financialTransactions.id, pending.id))
      .run();

    expect(getEuerSummary(db, 2025)).toMatchObject({ incomeCents: 2_000, profitCents: 2_000 });
    expect(getEuerSummary(db, 2026)).toMatchObject({ incomeCents: 0, expenseCents: 0, profitCents: 0 });
    expect(getFinancialAccountReconciliation(db, bank.id).expectedBalanceCents).toBe(5_000);
  });

  it("uses the booking/credit date for the EÜR, not the bank value date", () => {
    const { db, bank, category } = setup();
    const bookedOnNewYearsEve = transaction(db, bank.id, 2_000, "2025-12-31", "income", "2026-01-01");
    post(db, bookedOnNewYearsEve.id, category("rental_revenue").id);

    const bookedInNewYear = transaction(db, bank.id, 3_000, "2026-01-01", "income", "2025-12-31");
    post(db, bookedInNewYear.id, category("rental_revenue").id);

    expect(getEuerSummary(db, 2025)).toMatchObject({ incomeCents: 2_000 });
    expect(getEuerSummary(db, 2026)).toMatchObject({ incomeCents: 3_000 });
  });

  it("rolls back an asset purchase when gross amount and asset details disagree", () => {
    const { db, cash, category } = setup();

    expect(() =>
      createAndPostManualTransaction(db, {
        source: "cash",
        accountId: cash.id,
        bookedAt: "2026-01-15",
        amountCents: 119_000,
        categoryId: category("equipment_asset_purchase").id,
        description: "Abweichendes Anlagegut",
        actorUserId: "admin",
        asset: {
          name: "Falscher Betrag",
          assetType: "bike",
          acquisitionDate: "2026-01-15",
          inServiceDate: "2026-01-15",
          acquisitionCostCents: 99_000,
          inputVatCents: 19_000,
          usefulLifeMonths: 84,
        },
      }),
    ).toThrow("müssen dem Transaktionsbetrag entsprechen");
    expect(db.select().from(financialTransactions).all()).toHaveLength(0);
    expect(db.select().from(fixedAssets).all()).toHaveLength(0);
  });

  it("does not create a sale transaction for a zero-proceeds disposal and prevents disposal twice", () => {
    const { db, cash } = setup();
    const asset = createFixedAsset(db, {
      name: "Ohne Verkaufserlös",
      assetType: "bike",
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      acquisitionCostCents: 10_000,
      usefulLifeMonths: 10,
      createdByUserId: "admin",
    });

    const result = disposeFixedAsset(db, {
      assetId: asset.id,
      financialAccountId: cash.id,
      disposedAt: "2026-02-01",
      disposalProceedsCents: 0,
      actorUserId: "admin",
    });
    expect(result.disposalTransactionId).toBeNull();
    expect(db.select().from(financialTransactions).all()).toHaveLength(0);
    expect(getEuerSummary(db, 2026).incomeCents).toBe(0);
    expect(() =>
      disposeFixedAsset(db, {
        assetId: asset.id,
        financialAccountId: cash.id,
        disposedAt: "2026-03-01",
        disposalProceedsCents: 1_000,
        actorUserId: "admin",
      }),
    ).toThrow("bereits ausgeschieden");
  });

  it("does not allow changing the opening balance after any movement or with an impossible date", () => {
    const { db, bank } = setup();
    expect(() =>
      updateOpeningBalance(db, {
        accountId: bank.id,
        openingBalanceCents: 1_000,
        openingBalanceDate: "2026-02-30",
        actorUserId: "admin",
      }),
    ).toThrow("gültiges Datum");

    updateOpeningBalance(db, {
      accountId: bank.id,
      openingBalanceCents: 1_000,
      openingBalanceDate: "2026-01-01",
      actorUserId: "admin",
    });
    transaction(db, bank.id, 100);
    expect(() =>
      updateOpeningBalance(db, {
        accountId: bank.id,
        openingBalanceCents: 2_000,
        openingBalanceDate: "2026-01-02",
        actorUserId: "admin",
      }),
    ).toThrow("unveränderlich");
  });
});
