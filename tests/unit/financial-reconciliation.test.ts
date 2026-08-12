import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import {
  authUser,
  bookings,
  financialAccounts,
  financialCategories,
  financialTransactionAllocations,
  financialTransactions,
  fixedAssetDepreciationEntries,
  fixedAssets,
  journalEntries,
  journalLines,
} from "../../lib/db/schema";
import {
  getFinancialAccountReconciliation,
  ignoreFinancialTransaction,
  postFinancialTransaction,
} from "../../lib/financial/reconciliation";
import { appendJournalEntry, getReceivableStatus } from "../../lib/bookings/ledger";
import { getEuerSummary } from "../../lib/financial/euer";
import { createAndPostManualTransaction } from "../../lib/financial/manual-transactions";
import { postFixedAssetDepreciation } from "../../lib/financial/fixed-assets";

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
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  const bank = db
    .insert(financialAccounts)
    .values({
      code: "test_bank",
      name: "Testkonto",
      type: "bank",
      provider: "test",
      currency: "EUR",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();
  const income = db.select().from(financialCategories).where(eq(financialCategories.code, "rental_revenue")).get()!;
  const travel = db.select().from(financialCategories).where(eq(financialCategories.code, "travel")).get()!;
  const transfer = db.select().from(financialCategories).where(eq(financialCategories.code, "cash_withdrawal")).get()!;
  const cash = db.select().from(financialAccounts).where(eq(financialAccounts.code, "cash_main")).get()!;
  return { connection, db, bank, income, travel, transfer, cash };
}

function transaction(db: ReturnType<typeof setup>["db"], financialAccountId: number, amountCents: number) {
  return db
    .insert(financialTransactions)
    .values({
      financialAccountId,
      source: "bank",
      provider: "test",
      externalId: `tx-${Math.random()}`,
      kind: amountCents > 0 ? "income" : "expense",
      status: "needs_review",
      amountCents,
      currency: "EUR",
      bookedAt: "2026-08-04",
      description: "Testbewegung",
      importedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();
}

describe("financial reconciliation", () => {
  it("posts an incoming transaction with balanced journal lines", () => {
    const { db, bank, income } = setup();
    const tx = transaction(db, bank.id, 12_500);

    const result = postFinancialTransaction(db, {
      transactionId: tx.id,
      categoryId: income.id,
      note: "Mietzahlung August",
      actorUserId: "admin",
    });

    const entry = db.select().from(journalEntries).where(eq(journalEntries.id, result.journalEntryId)).get()!;
    const lines = db.select().from(journalLines).where(eq(journalLines.entryId, entry.id)).all();
    expect(entry.financialTransactionId).toBe(tx.id);
    expect(lines.reduce((sum, line) => sum + line.amountCents, 0)).toBe(0);
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ account: "test_bank", amountCents: 12_500 }),
        expect.objectContaining({ account: "rental_revenue", amountCents: -12_500 }),
      ]),
    );
    expect(db.select().from(financialTransactions).where(eq(financialTransactions.id, tx.id)).get()?.status).toBe(
      "posted",
    );
    expect(getEuerSummary(db, 2026)).toMatchObject({
      incomeCents: 12_500,
      expenseCents: 0,
      profitCents: 12_500,
      excludedInternalCents: 0,
    });
  });

  it("records a cash withdrawal as a transfer and keeps ignored movements in the bank balance", () => {
    const { db, bank, transfer, cash } = setup();
    const withdrawal = transaction(db, bank.id, -10_000);
    postFinancialTransaction(db, {
      transactionId: withdrawal.id,
      categoryId: transfer.id,
      destinationAccountId: cash.id,
      note: "Bargeld für Kasse",
      actorUserId: "admin",
    });
    const ignored = transaction(db, bank.id, -2_500);
    ignoreFinancialTransaction(db, { transactionId: ignored.id, reason: "Doppelt importiert", actorUserId: "admin" });

    const reconciliation = getFinancialAccountReconciliation(db, bank.id);
    expect(reconciliation.expectedBalanceCents).toBe(-12_500);
    expect(getFinancialAccountReconciliation(db, cash.id).expectedBalanceCents).toBe(10_000);
    expect(getEuerSummary(db, 2026)).toMatchObject({
      incomeCents: 0,
      expenseCents: 0,
      profitCents: 0,
      excludedInternalCents: 10_000,
    });
    expect(db.select().from(financialTransactions).where(eq(financialTransactions.id, ignored.id)).get()?.status).toBe(
      "ignored",
    );
  });

  it("maps travel costs to operating expenses in the EÜR", () => {
    const { db, bank, travel } = setup();
    const tx = transaction(db, bank.id, -4_500);

    expect(travel.euerTreatment).toBe("expense");
    expect(travel.euerLine).toBe("travel");

    postFinancialTransaction(db, {
      transactionId: tx.id,
      categoryId: travel.id,
      note: "Fahrt zum Fahrradservice",
      actorUserId: "admin",
    });

    expect(getEuerSummary(db, 2026)).toMatchObject({
      incomeCents: 0,
      expenseCents: 4_500,
      profitCents: -4_500,
      unresolvedCents: 0,
    });
  });

  it("splits a business meal into deductible, non-deductible, private, and input VAT parts", () => {
    const { db, bank } = setup();
    const meal = db.select().from(financialCategories).where(eq(financialCategories.code, "business_meal")).get()!;
    const tx = transaction(db, bank.id, -10_000);

    const result = postFinancialTransaction(db, {
      transactionId: tx.id,
      categoryId: meal.id,
      businessMeal: { privateShareCents: 2_000, inputVatCents: 1_277 },
      note: "Geschäftsessen mit Kunde",
      actorUserId: "admin",
    });

    const lines = db.select().from(journalLines).where(eq(journalLines.entryId, result.journalEntryId)).all();
    expect(lines.reduce((sum, line) => sum + line.amountCents, 0)).toBe(0);
    expect(getEuerSummary(db, 2026)).toMatchObject({
      expenseCents: 4_706,
      inputVatCents: 1_277,
      profitCents: -4_706,
    });
    expect(
      db
        .select()
        .from(financialTransactionAllocations)
        .where(eq(financialTransactionAllocations.transactionId, tx.id))
        .all(),
    ).toHaveLength(4);
  });

  it("posts a historical cash asset purchase and its AfA into the EÜR", () => {
    const { db } = setup();
    const assetCategory = db
      .select()
      .from(financialCategories)
      .where(eq(financialCategories.code, "equipment_asset_purchase"))
      .get()!;

    const result = createAndPostManualTransaction(db, {
      source: "cash",
      bookedAt: "2026-01-15",
      amountCents: 119_000,
      categoryId: assetCategory.id,
      description: "Fahrrad bar gekauft",
      actorUserId: "admin",
      asset: {
        name: "Fahrrad Test M",
        assetType: "bike",
        acquisitionDate: "2026-01-15",
        inServiceDate: "2026-01-15",
        acquisitionCostCents: 100_000,
        inputVatCents: 19_000,
        usefulLifeMonths: 84,
      },
    });

    const asset = db.select().from(fixedAssets).get()!;
    expect(asset.sourceTransactionId).toBe(result.transactionId);
    const assetAllocations = db
      .select()
      .from(financialTransactionAllocations)
      .where(eq(financialTransactionAllocations.transactionId, result.transactionId))
      .all();
    expect(assetAllocations.reduce((sum, allocation) => sum + allocation.amountCents, 0)).toBe(-119_000);
    expect(assetAllocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amountCents: -100_000, allocationKind: "asset_acquisition", fixedAssetId: asset.id }),
        expect.objectContaining({ amountCents: -19_000, allocationKind: "tax", fixedAssetId: null }),
      ]),
    );
    expect(getEuerSummary(db, 2026)).toMatchObject({ expenseCents: 0, inputVatCents: 19_000 });

    postFixedAssetDepreciation(db, { assetId: asset.id, periodStart: "2026-01-01", actorUserId: "admin" });
    expect(db.select().from(fixedAssetDepreciationEntries).all()).toHaveLength(1);
    expect(getEuerSummary(db, 2026)).toMatchObject({ expenseCents: 1_190, profitCents: -1_190 });
  });

  it("records a manual account payment against a booking", () => {
    const { db, bank, income } = setup();
    const booking = db
      .insert(bookings)
      .values({
        orderNumber: "#20260808000000",
        customerName: "Alte Buchung",
        customerEmail: "alt@example.com",
        customerPhone: "0123",
        location: "munich",
        periodFrom: "2026-08-10",
        periodTo: "2026-08-11",
        pickupTime: "10:00",
        dropoffTime: "10:00",
        source: "legacy",
        status: "completed",
        quotedTotalCents: 10_000,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .get();
    appendJournalEntry(db, {
      bookingId: booking.id,
      kind: "rental_charge",
      actorUserId: "admin",
      reason: "Historischer Auftragswert",
      lines: [
        { account: "accounts_receivable", amountCents: 10_000 },
        { account: "rental_revenue", amountCents: -10_000 },
      ],
    });

    const result = createAndPostManualTransaction(db, {
      source: "manual",
      bookedAt: "2026-08-12",
      amountCents: 10_000,
      accountId: bank.id,
      bookingId: booking.id,
      categoryId: income.id,
      description: "Alte Überweisung",
      actorUserId: "admin",
    });

    const transaction = db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.id, result.transactionId))
      .get();
    const allocation = db
      .select()
      .from(financialTransactionAllocations)
      .where(eq(financialTransactionAllocations.transactionId, result.transactionId))
      .get();
    expect(transaction).toMatchObject({ financialAccountId: bank.id, status: "posted", amountCents: 10_000 });
    expect(allocation).toMatchObject({ bookingId: booking.id, categoryId: null, allocationKind: "booking_payment" });
    expect(getReceivableStatus(db, booking.id)).toMatchObject({ openCents: 0, status: "settled" });
  });
});
