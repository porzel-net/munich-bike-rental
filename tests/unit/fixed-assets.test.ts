import { describe, expect, it } from "vitest";

import { afterEach } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import { financialAccounts, financialTransactions, fixedAssets, journalLines } from "../../lib/db/schema";
import { getEuerSummary } from "../../lib/financial/euer";
import {
  createFixedAsset,
  disposeFixedAsset,
  fixedAssetDepreciationSchedule,
  monthlyDepreciationCents,
} from "../../lib/financial/fixed-assets";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

describe("fixed asset depreciation", () => {
  const asset = {
    acquisitionCostCents: 100_000,
    residualValueCents: 0,
    usefulLifeMonths: 84,
    inServiceDate: "2026-08-15",
  };

  it("spreads the full depreciable amount across the useful life", () => {
    const schedule = fixedAssetDepreciationSchedule(asset);
    expect(schedule).toHaveLength(84);
    expect(schedule[0]).toMatchObject({ periodStart: "2026-08-01", amountCents: 1_190 });
    expect(schedule.at(-1)?.amountCents).toBe(1_230);
    expect(schedule.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(100_000);
  });

  it("does not depreciate outside the schedule", () => {
    expect(monthlyDepreciationCents(asset, "2026-07-01")).toBe(0);
    expect(monthlyDepreciationCents(asset, "2033-08-01")).toBe(0);
  });

  it("posts AfA through the sale month and includes the sale in the EÜR", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Testfahrrad",
      assetType: "bike",
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      acquisitionCostCents: 120_000,
      usefulLifeMonths: 12,
      createdByUserId: null,
    });
    const cashAccount = connection.db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.code, "cash_main"))
      .get()!;

    const result = disposeFixedAsset(connection.db, {
      assetId: created.id,
      financialAccountId: cashAccount.id,
      disposedAt: "2026-03-15",
      disposalProceedsCents: 50_000,
      disposalProceedsVatCents: 9_500,
      actorUserId: null,
    });
    const disposed = connection.db.select().from(fixedAssets).get();
    const euer = getEuerSummary(connection.db, 2026);
    const sale = connection.db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.id, result.disposalTransactionId!))
      .get();
    const saleLines = connection.db
      .select()
      .from(journalLines)
      .where(eq(journalLines.entryId, result.saleEntryId!))
      .all();

    expect(result.bookValueCents).toBe(90_000);
    expect(disposed?.status).toBe("disposed");
    expect(sale).toMatchObject({ status: "posted", amountCents: 59_500 });
    expect(saleLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ account: "cash_main", amountCents: 59_500 }),
        expect.objectContaining({ account: "rental_revenue", amountCents: -50_000 }),
        expect.objectContaining({ account: "tax_output", amountCents: -9_500 }),
      ]),
    );
    expect(euer.incomeCents).toBe(50_000);
    expect(euer.expenseCents).toBe(120_000);
    expect(euer.outputVatCents).toBe(9_500);
    expect(euer.rows.filter((row) => row.fixedAssetId === created.id)).toHaveLength(6);
  });
});
