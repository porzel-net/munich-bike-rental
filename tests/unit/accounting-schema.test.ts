import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import {
  adminAuditEvents,
  accountingAccounts,
  financialAccounts,
  financialCategories,
  financialTransactionAllocations,
  financialTransactions,
} from "../../lib/db/schema";
import { updateOpeningBalance } from "../../lib/financial/accounts";

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

  it("locks the opening balance after the first account movement", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const account = connection.db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.code, "cash_main"))
      .get()!;

    expect(
      updateOpeningBalance(connection.db, {
        accountId: account.id,
        openingBalanceCents: 12_500,
        openingBalanceDate: "2026-08-01",
        actorUserId: null,
      }),
    ).toEqual({ accountId: account.id });

    expect(connection.db.select().from(adminAuditEvents).all()).toHaveLength(1);
    expect(() =>
      connection.db.update(adminAuditEvents).set({ action: "tampered" }).where(eq(adminAuditEvents.id, 1)).run(),
    ).toThrow("append-only");

    const now = new Date();
    connection.db
      .insert(financialTransactions)
      .values({
        financialAccountId: account.id,
        source: "cash",
        kind: "cash_expense",
        status: "imported",
        amountCents: -100,
        currency: "EUR",
        bookedAt: "2026-08-02",
        description: "Test",
        importedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(() =>
      updateOpeningBalance(connection.db, {
        accountId: account.id,
        openingBalanceCents: 99_999,
        openingBalanceDate: "2026-08-01",
        actorUserId: null,
      }),
    ).toThrow("unveränderlich");
  });
});
