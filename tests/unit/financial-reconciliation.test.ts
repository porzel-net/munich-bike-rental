import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import {
  authUser,
  financialAccounts,
  financialCategories,
  financialTransactions,
  journalEntries,
  journalLines,
} from "../../lib/db/schema";
import {
  getFinancialAccountReconciliation,
  ignoreFinancialTransaction,
  postFinancialTransaction,
} from "../../lib/financial/reconciliation";
import { getEuerSummary } from "../../lib/financial/euer";

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
});
