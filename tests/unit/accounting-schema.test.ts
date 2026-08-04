import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import {
  accountingAccounts,
  financialAccounts,
  financialCategories,
  financialTransactionAllocations,
  financialTransactions,
} from "../../lib/db/schema";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

describe("accounting schema", () => {
  it("seeds the core chart of accounts, financial accounts, and categories", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);

    const accounts = connection.db.select().from(accountingAccounts).all();
    const financialAccountsRows = connection.db.select().from(financialAccounts).all();
    const categories = connection.db.select().from(financialCategories).all();

    expect(accounts.map((account) => account.code)).toEqual(
      expect.arrayContaining(["accounts_receivable", "stripe_clearing", "cash_on_hand", "stripe_fees"]),
    );
    expect(financialAccountsRows.map((account) => account.code)).toEqual(
      expect.arrayContaining(["cash_main", "stripe_main"]),
    );
    expect(categories.map((category) => category.code)).toEqual(
      expect.arrayContaining(["rental_revenue", "stripe_fee", "cash_withdrawal", "unclassified"]),
    );
  });

  it("stores a cash transaction and documents its expense allocation separately", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const cashAccount = connection.db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.code, "cash_main"))
      .get();
    const maintenance = connection.db
      .select()
      .from(financialCategories)
      .where(eq(financialCategories.code, "maintenance"))
      .get();

    expect(cashAccount).toBeDefined();
    expect(maintenance).toBeDefined();

    const now = new Date();
    const transaction = connection.db
      .insert(financialTransactions)
      .values({
        financialAccountId: cashAccount!.id,
        source: "cash",
        kind: "cash_expense",
        status: "imported",
        amountCents: -1_250,
        currency: "EUR",
        bookedAt: "2026-08-03",
        description: "Schlauch für Reparatur",
        importedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: financialTransactions.id })
      .get();

    connection.db
      .insert(financialTransactionAllocations)
      .values({
        transactionId: transaction.id,
        categoryId: maintenance!.id,
        allocationKind: "expense",
        matchMethod: "manual",
        amountCents: -1_250,
        note: "Barzahlung für die Reparatur dokumentiert",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(connection.db.select().from(financialTransactionAllocations).all()).toHaveLength(1);
  });
});
