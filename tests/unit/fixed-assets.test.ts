import { describe, expect, it } from "vitest";

import { afterEach } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import {
  financialAccounts,
  financialTransactions,
  fixedAssetDepreciationEntries,
  fixedAssets,
  authUser,
  journalLines,
} from "../../lib/db/schema";
import { getEuerSummary } from "../../lib/financial/euer";
import {
  createFixedAsset,
  createPrivateAssetContribution,
  disposeFixedAsset,
  getMaximumDegressiveRateBps,
  fixedAssetDepreciationSchedule,
  monthlyDepreciationCents,
  postDueFixedAssetDepreciation,
  updateFixedAsset,
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

  it("calculates the legal maximum declining-balance rates by acquisition date", () => {
    expect(getMaximumDegressiveRateBps({ acquisitionDate: "2026-01-01", usefulLifeMonths: 84 })).toBe(3_000);
    expect(getMaximumDegressiveRateBps({ acquisitionDate: "2026-01-01", usefulLifeMonths: 144 })).toBe(2_500);
    expect(getMaximumDegressiveRateBps({ acquisitionDate: "2024-04-01", usefulLifeMonths: 84 })).toBe(2_000);
    expect(getMaximumDegressiveRateBps({ acquisitionDate: "2025-06-30", usefulLifeMonths: 84 })).toBeNull();
    expect(getMaximumDegressiveRateBps({ acquisitionDate: "2028-01-01", usefulLifeMonths: 84 })).toBeNull();
  });

  it("calculates declining depreciation from the opening book value and switches to linear", () => {
    const degressiveAsset = {
      ...asset,
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      usefulLifeMonths: 48,
      method: "declining_balance" as const,
      degressiveRateBps: 3_000,
    };
    const schedule = fixedAssetDepreciationSchedule(degressiveAsset);
    const yearly = new Map<string, number>();
    for (const entry of schedule) {
      const year = entry.periodStart.slice(0, 4);
      yearly.set(year, (yearly.get(year) ?? 0) + entry.amountCents);
    }

    expect(schedule).toHaveLength(48);
    expect(yearly.get("2026")).toBe(30_000);
    expect(yearly.get("2027")).toBe(23_333);
    expect(yearly.get("2028")).toBe(23_333);
    expect(yearly.get("2029")).toBe(23_334);
    expect(schedule.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(100_000);
  });

  it("uses the BMF-style partial year and later linear switch for a 2024 asset", () => {
    const schedule = fixedAssetDepreciationSchedule({
      acquisitionCostCents: 60_000,
      residualValueCents: 0,
      usefulLifeMonths: 72,
      acquisitionDate: "2024-04-15",
      inServiceDate: "2024-04-15",
      method: "declining_balance" as const,
      degressiveRateBps: 2_000,
    });
    const yearly = new Map<string, number>();
    for (const entry of schedule) {
      const year = entry.periodStart.slice(0, 4);
      yearly.set(year, (yearly.get(year) ?? 0) + entry.amountCents);
    }

    expect(yearly.get("2024")).toBe(9_000);
    expect(yearly.get("2025")).toBe(10_200);
    expect(yearly.get("2026")).toBe(9_600);
    expect(yearly.get("2027")).toBe(9_600);
    expect(schedule.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(60_000);
  });

  it("preserves the residual value with declining depreciation", () => {
    const schedule = fixedAssetDepreciationSchedule({
      acquisitionCostCents: 100_000,
      residualValueCents: 10_000,
      usefulLifeMonths: 48,
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      method: "declining_balance" as const,
      degressiveRateBps: 3_000,
    });

    expect(schedule.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(90_000);
    expect(schedule.at(-1)?.amountCents).toBeGreaterThan(0);
  });

  it("rejects declining depreciation outside the statutory acquisition windows", () => {
    expect(() =>
      createFixedAsset(connectionForTest().db, {
        name: "Nicht zulässiges Anlagegut",
        assetType: "equipment",
        acquisitionDate: "2025-06-30",
        inServiceDate: "2025-06-30",
        acquisitionCostCents: 100_000,
        usefulLifeMonths: 84,
        method: "declining_balance",
      }),
    ).toThrow("degressive AfA");
  });

  it("requires the original private acquisition date for declining depreciation", () => {
    expect(() =>
      createFixedAsset(connectionForTest().db, {
        name: "Privat eingebrachtes Anlagegut",
        assetType: "equipment",
        acquisitionSource: "private_contribution",
        acquisitionDate: "2026-08-01",
        originalAcquisitionCostCents: 100_000,
        originalUsefulLifeMonths: 84,
        originalCondition: "used",
        privateUseType: "personal",
        inServiceDate: "2026-08-01",
        acquisitionCostCents: 100_000,
        usefulLifeMonths: 70,
        method: "declining_balance",
      }),
    ).toThrow("ursprüngliche Anschaffungsdatum");
  });

  it("allows declining depreciation for a private contribution when the original purchase qualifies", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Privat gekauftes Anlagegut",
      assetType: "equipment",
      acquisitionSource: "private_contribution",
      acquisitionDate: "2026-08-01",
      originalAcquisitionDate: "2026-08-01",
      originalAcquisitionCostCents: 100_000,
      originalUsefulLifeMonths: 84,
      originalCondition: "used",
      privateUseType: "personal",
      inServiceDate: "2026-08-01",
      acquisitionCostCents: 100_000,
      usefulLifeMonths: 84,
      method: "declining_balance",
      createdByUserId: null,
    });

    expect(created).toMatchObject({
      acquisitionDate: "2026-08-01",
      originalAcquisitionDate: "2026-08-01",
      originalCondition: "used",
      method: "declining_balance",
      degressiveRateBps: 3_000,
    });
  });

  it("uses the original purchase date instead of the contribution date for eligibility", () => {
    expect(() =>
      createFixedAsset(connectionForTest().db, {
        name: "Zu alte Privateinlage",
        assetType: "equipment",
        acquisitionSource: "private_contribution",
        acquisitionDate: "2026-08-01",
        originalAcquisitionDate: "2025-06-30",
        originalAcquisitionCostCents: 100_000,
        originalUsefulLifeMonths: 84,
        originalCondition: "used",
        privateUseType: "personal",
        inServiceDate: "2026-08-01",
        acquisitionCostCents: 100_000,
        usefulLifeMonths: 70,
        method: "declining_balance",
      }),
    ).toThrow("Anschaffungsdatum");
  });

  it("calculates prior theoretical linear depreciation before a recent private contribution", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Privateinlage mit Vorlauf-AfA",
      assetType: "equipment",
      acquisitionSource: "private_contribution",
      acquisitionDate: "2026-08-01",
      originalAcquisitionDate: "2026-01-01",
      originalAcquisitionCostCents: 84_000,
      originalUsefulLifeMonths: 84,
      originalCondition: "used",
      privateUseType: "personal",
      inServiceDate: "2026-08-01",
      acquisitionCostCents: 70_000,
      usefulLifeMonths: 77,
      method: "straight_line",
      createdByUserId: null,
    });

    expect(created).toMatchObject({
      acquisitionCostCents: 70_000,
      preEntryDepreciationCents: 7_000,
      originalAcquisitionCostCents: 84_000,
      originalUsefulLifeMonths: 84,
      privateUseType: "personal",
    });
  });

  it("rejects a private entry value above the three-year historical-cost cap", () => {
    expect(() =>
      createFixedAsset(connectionForTest().db, {
        name: "Überhöhter Einlagewert",
        assetType: "equipment",
        acquisitionSource: "private_contribution",
        acquisitionDate: "2026-08-01",
        originalAcquisitionDate: "2026-01-01",
        originalAcquisitionCostCents: 84_000,
        originalUsefulLifeMonths: 84,
        originalCondition: "used",
        privateUseType: "personal",
        inServiceDate: "2026-08-01",
        acquisitionCostCents: 84_000,
        usefulLifeMonths: 77,
      }),
    ).toThrow("Einlagewert");
  });

  it("accepts the exact three-year boundary as a Teilwert case", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Teilwert nach drei Jahren",
      assetType: "equipment",
      acquisitionSource: "private_contribution",
      acquisitionDate: "2026-08-01",
      originalAcquisitionDate: "2023-08-01",
      originalAcquisitionCostCents: 100_000,
      originalUsefulLifeMonths: 84,
      originalCondition: "used",
      privateUseType: "mixed",
      inServiceDate: "2026-08-01",
      acquisitionCostCents: 120_000,
      usefulLifeMonths: 48,
      method: "straight_line",
    });

    expect(created).toMatchObject({
      acquisitionCostCents: 120_000,
      privateUseType: "mixed",
      preEntryDepreciationCents: 42_840,
    });
  });

  it("accepts the exact historical-cost cap within the three-year period", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Fortgeführte Anschaffungskosten",
      assetType: "equipment",
      acquisitionSource: "private_contribution",
      acquisitionDate: "2026-08-01",
      originalAcquisitionDate: "2026-01-01",
      originalAcquisitionCostCents: 84_000,
      originalUsefulLifeMonths: 84,
      originalCondition: "used",
      privateUseType: "personal",
      inServiceDate: "2026-08-01",
      acquisitionCostCents: 77_000,
      usefulLifeMonths: 77,
      method: "straight_line",
    });

    expect(created.preEntryDepreciationCents).toBe(7_000);
  });

  it("uses the original useful life for the degressive rate after a private contribution", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Privateinlage mit langer Nutzungsdauer",
      assetType: "equipment",
      acquisitionSource: "private_contribution",
      acquisitionDate: "2026-08-01",
      originalAcquisitionDate: "2026-01-01",
      originalAcquisitionCostCents: 240_000,
      originalUsefulLifeMonths: 240,
      originalCondition: "used",
      privateUseType: "income_generation",
      inServiceDate: "2026-08-01",
      acquisitionCostCents: 100_000,
      usefulLifeMonths: 228,
      method: "declining_balance",
    });

    expect(created.degressiveRateBps).toBe(1_500);
  });

  it("requires the original cost, original useful life, and prior-use classification", () => {
    expect(() =>
      createFixedAsset(connectionForTest().db, {
        name: "Unvollständige Privateinlage",
        assetType: "equipment",
        acquisitionSource: "private_contribution",
        acquisitionDate: "2026-08-01",
        originalAcquisitionDate: "2026-07-24",
        inServiceDate: "2026-08-01",
        acquisitionCostCents: 100_000,
        usefulLifeMonths: 84,
      }),
    ).toThrow("ursprünglichen Anschaffungskosten");
  });

  it("requires an explicit new-or-used classification", () => {
    expect(() =>
      createFixedAsset(connectionForTest().db, {
        name: "Privateinlage ohne Zustandsangabe",
        assetType: "equipment",
        acquisitionSource: "private_contribution",
        acquisitionDate: "2026-08-01",
        originalAcquisitionDate: "2026-07-01",
        originalAcquisitionCostCents: 100_000,
        originalUsefulLifeMonths: 84,
        privateUseType: "personal",
        inServiceDate: "2026-08-01",
        acquisitionCostCents: 98_000,
        usefulLifeMonths: 83,
      }),
    ).toThrow("neu oder gebraucht");
  });

  it("rejects a remaining life longer than the original useful life after the contribution", () => {
    expect(() =>
      createFixedAsset(connectionForTest().db, {
        name: "Zu lange Restnutzungsdauer",
        assetType: "equipment",
        acquisitionSource: "private_contribution",
        acquisitionDate: "2026-08-01",
        originalAcquisitionDate: "2026-01-01",
        originalAcquisitionCostCents: 84_000,
        originalUsefulLifeMonths: 84,
        originalCondition: "used",
        privateUseType: "personal",
        inServiceDate: "2026-08-01",
        acquisitionCostCents: 70_000,
        usefulLifeMonths: 84,
      }),
    ).toThrow("Restnutzungsdauer");
  });

  it("creates a private contribution with separate purchase and contribution dates", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    connection.db
      .insert(authUser)
      .values({
        id: "test-user",
        name: "Test User",
        email: "test@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    const result = createPrivateAssetContribution(connection.db, {
      name: "Privat eingebrachtes Fahrrad",
      assetType: "bike",
      originalAcquisitionDate: "2026-07-24",
      originalAcquisitionCostCents: 220_000,
      originalUsefulLifeMonths: 84,
      originalCondition: "used",
      privateUseType: "personal",
      contributionDate: "2026-08-01",
      inServiceDate: "2026-08-01",
      acquisitionCostCents: 195_000,
      usefulLifeMonths: 83,
      method: "declining_balance",
      actorUserId: "test-user",
    });
    const created = connection.db.select().from(fixedAssets).where(eq(fixedAssets.id, result.assetId)).get();

    expect(created).toMatchObject({
      acquisitionDate: "2026-08-01",
      originalAcquisitionDate: "2026-07-24",
      acquisitionSource: "private_contribution",
      method: "declining_balance",
      degressiveRateBps: 3_000,
    });
  });

  it("supports correcting a posted private contribution from linear to declining and back", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Korrigierbare Privateinlage",
      assetType: "bike",
      acquisitionSource: "private_contribution",
      acquisitionDate: "2026-08-01",
      originalAcquisitionDate: "2026-08-01",
      originalAcquisitionCostCents: 100_000,
      originalUsefulLifeMonths: 48,
      originalCondition: "used",
      privateUseType: "personal",
      inServiceDate: "2026-08-01",
      acquisitionCostCents: 100_000,
      usefulLifeMonths: 48,
      method: "straight_line",
      createdByUserId: null,
    });
    postDueFixedAssetDepreciation(connection.db, { throughMonth: "2026-08", actorUserId: null });

    updateFixedAsset(connection.db, {
      assetId: created.id,
      name: created.name,
      assetType: created.assetType,
      inServiceDate: created.inServiceDate,
      usefulLifeMonths: created.usefulLifeMonths,
      originalAcquisitionDate: created.originalAcquisitionDate,
      method: "declining_balance",
      actorUserId: null,
    });
    expect(connection.db.select().from(fixedAssets).get()).toMatchObject({
      method: "declining_balance",
      degressiveRateBps: 3_000,
    });

    updateFixedAsset(connection.db, {
      assetId: created.id,
      name: created.name,
      assetType: created.assetType,
      inServiceDate: created.inServiceDate,
      usefulLifeMonths: created.usefulLifeMonths,
      originalAcquisitionDate: created.originalAcquisitionDate,
      method: "straight_line",
      actorUserId: null,
    });
    expect(connection.db.select().from(fixedAssets).get()).toMatchObject({
      method: "straight_line",
      degressiveRateBps: null,
    });
  });

  it("reports the remaining depreciable amount for active assets", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    createFixedAsset(connection.db, {
      name: "Testausstattung",
      assetType: "equipment",
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      acquisitionCostCents: 100_000,
      residualValueCents: 10_000,
      usefulLifeMonths: 10,
      createdByUserId: null,
    });

    expect(getEuerSummary(connection.db, 2026).remainingDepreciationCents).toBe(90_000);

    postDueFixedAssetDepreciation(connection.db, { throughMonth: "2026-01", actorUserId: null });

    expect(getEuerSummary(connection.db, 2026).remainingDepreciationCents).toBe(81_000);
  });

  it("persists the selected depreciation method and its legal rate", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Degressives Testfahrrad",
      assetType: "bike",
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      acquisitionCostCents: 100_000,
      usefulLifeMonths: 84,
      method: "declining_balance",
      createdByUserId: null,
    });

    expect(created.method).toBe("declining_balance");
    expect(created.degressiveRateBps).toBe(3_000);
  });

  it("recalculates the stored maximum rate when the useful life changes", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Nutzungsdaueränderung",
      assetType: "equipment",
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      acquisitionCostCents: 100_000,
      usefulLifeMonths: 84,
      method: "declining_balance",
      createdByUserId: null,
    });

    updateFixedAsset(connection.db, {
      assetId: created.id,
      name: "Nutzungsdaueränderung",
      assetType: "equipment",
      inServiceDate: "2026-01-01",
      usefulLifeMonths: 144,
      method: "declining_balance",
      actorUserId: null,
    });

    expect(connection.db.select().from(fixedAssets).get()).toMatchObject({
      method: "declining_balance",
      degressiveRateBps: 2_500,
      usefulLifeMonths: 144,
    });
  });

  it("rejects a manually supplied declining rate above the statutory maximum", () => {
    expect(() =>
      createFixedAsset(connectionForTest().db, {
        name: "Ungültiger Satz",
        assetType: "equipment",
        acquisitionDate: "2026-01-01",
        inServiceDate: "2026-01-01",
        acquisitionCostCents: 100_000,
        usefulLifeMonths: 84,
        method: "declining_balance",
        degressiveRateBps: 3_001,
      }),
    ).toThrow("Höchstsatz");
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

  it("updates asset metadata and rebuilds already posted depreciation when the schedule changes", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Falsches Fahrrad",
      assetType: "bike",
      serialNumber: "ALT-123",
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      acquisitionCostCents: 12_000,
      usefulLifeMonths: 12,
      createdByUserId: null,
    });
    postDueFixedAssetDepreciation(connection.db, { throughMonth: "2026-02", actorUserId: null });

    updateFixedAsset(connection.db, {
      assetId: created.id,
      name: "Richtiges Fahrrad",
      assetType: "bike",
      serialNumber: "NEU-456",
      inServiceDate: "2026-03-01",
      usefulLifeMonths: 24,
      actorUserId: null,
    });

    expect(connection.db.select().from(fixedAssets).get()).toMatchObject({
      name: "Richtiges Fahrrad",
      serialNumber: "NEU-456",
      inServiceDate: "2026-03-01",
      usefulLifeMonths: 24,
    });
    expect(
      connection.db
        .select()
        .from(fixedAssetDepreciationEntries)
        .where(eq(fixedAssetDepreciationEntries.fixedAssetId, created.id))
        .all(),
    ).toEqual([]);
  });

  it("allows an explicit audited method correction in both directions", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Methodenwechsel",
      assetType: "equipment",
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      acquisitionCostCents: 100_000,
      usefulLifeMonths: 48,
      method: "declining_balance",
      createdByUserId: null,
    });
    postDueFixedAssetDepreciation(connection.db, { throughMonth: "2026-02", actorUserId: null });

    updateFixedAsset(connection.db, {
      assetId: created.id,
      name: "Methodenwechsel",
      assetType: "equipment",
      inServiceDate: "2026-01-01",
      usefulLifeMonths: 48,
      method: "straight_line",
      actorUserId: null,
    });
    expect(connection.db.select().from(fixedAssets).get()).toMatchObject({
      method: "straight_line",
      degressiveRateBps: null,
    });
    expect(
      connection.db
        .select()
        .from(fixedAssetDepreciationEntries)
        .where(eq(fixedAssetDepreciationEntries.fixedAssetId, created.id))
        .all(),
    ).toEqual([]);

    postDueFixedAssetDepreciation(connection.db, { throughMonth: "2026-02", actorUserId: null });

    updateFixedAsset(connection.db, {
      assetId: created.id,
      name: "Methodenwechsel",
      assetType: "equipment",
      inServiceDate: "2026-01-01",
      usefulLifeMonths: 48,
      method: "declining_balance",
      actorUserId: null,
    });
    expect(connection.db.select().from(fixedAssets).get()).toMatchObject({
      method: "declining_balance",
      degressiveRateBps: 3_000,
    });
    expect(
      connection.db
        .select()
        .from(fixedAssetDepreciationEntries)
        .where(eq(fixedAssetDepreciationEntries.fixedAssetId, created.id))
        .all(),
    ).toEqual([]);
  });

  it("posts a declining schedule idempotently through the requested month", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const created = createFixedAsset(connection.db, {
      name: "Automatische degressive AfA",
      assetType: "equipment",
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      acquisitionCostCents: 100_000,
      usefulLifeMonths: 48,
      method: "declining_balance",
      createdByUserId: null,
    });

    expect(postDueFixedAssetDepreciation(connection.db, { throughMonth: "2026-03", actorUserId: null })).toEqual({
      posted: 3,
    });
    expect(postDueFixedAssetDepreciation(connection.db, { throughMonth: "2026-03", actorUserId: null })).toEqual({
      posted: 0,
    });
    expect(
      connection.db
        .select()
        .from(fixedAssetDepreciationEntries)
        .where(eq(fixedAssetDepreciationEntries.fixedAssetId, created.id))
        .all()
        .reduce((sum, entry) => sum + entry.amountCents, 0),
    ).toBe(7_500);
  });
});

function connectionForTest() {
  const connection = createDatabaseConnection(":memory:");
  connections.push(connection);
  return connection;
}
