import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import { fixedAssets } from "../../lib/db/schema";
import { fixedAssetDepreciationSchedule, updateFixedAsset } from "../../lib/financial/fixed-assets";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
  while (temporaryDirectories.length) {
    const directory = temporaryDirectories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

function legacyMigrationsFolder(version: 95 | 96) {
  const directory = mkdtempSync(join(tmpdir(), "munich-bike-rental-migrations-"));
  temporaryDirectories.push(directory);
  const source = resolve(process.cwd(), "drizzle");
  cpSync(source, directory, { recursive: true });

  rmSync(join(directory, "0098_outgoing_rachel_grey.sql"));
  rmSync(join(directory, "meta", "0098_snapshot.json"));
  if (version === 95) {
    rmSync(join(directory, "0096_mute_cammi.sql"));
    rmSync(join(directory, "meta", "0096_snapshot.json"));
  }
  const journalPath = join(directory, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: Array<{ idx: number }>;
  };
  journal.entries = journal.entries.filter((entry) => entry.idx <= version);
  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
  return directory;
}

function createLegacyFixedAssetRows(connection: ReturnType<typeof createDatabaseConnection>) {
  const timestamp = Date.now();
  const insert = connection.db.run(sql`
    INSERT INTO fixed_assets (
      asset_number,
      name,
      asset_type,
      acquisition_source,
      serial_number,
      acquisition_date,
      in_service_date,
      acquisition_cost_cents,
      input_vat_cents,
      useful_life_months,
      method,
      degressive_rate_bps,
      depreciation_revision,
      residual_value_cents,
      status,
      disposed_at,
      disposal_reason,
      disposal_proceeds_cents,
      disposal_proceeds_vat_cents,
      asset_account_code,
      accumulated_depreciation_account_code,
      source_transaction_id,
      disposal_transaction_id,
      notes,
      created_by_user_id,
      created_at,
      updated_at
    ) VALUES
      (
        ${"ANL-2026-LEGACY-LINEAR"},
        ${"Altes lineares Anlagegut"},
        ${"equipment"},
        ${"transaction"},
        ${null},
        ${"2026-01-01"},
        ${"2026-01-01"},
        ${100_000},
        ${0},
        ${84},
        ${"straight_line"},
        ${null},
        ${0},
        ${0},
        ${"active"},
        ${null},
        ${null},
        ${null},
        ${0},
        ${"fixed_assets_bikes"},
        ${"accumulated_depreciation"},
        ${null},
        ${null},
        ${"legacy transaction"},
        ${null},
        ${timestamp},
        ${timestamp}
      ),
      (
        ${"ANL-2026-LEGACY-PRIVATE"},
        ${"Alte Privateinlage"},
        ${"bike"},
        ${"private_contribution"},
        ${"LEGACY-PRIVATE"},
        ${"2026-08-01"},
        ${"2026-08-01"},
        ${195_000},
        ${0},
        ${84},
        ${"straight_line"},
        ${null},
        ${0},
        ${0},
        ${"active"},
        ${null},
        ${null},
        ${null},
        ${0},
        ${"fixed_assets_bikes"},
        ${"accumulated_depreciation"},
        ${null},
        ${null},
        ${"legacy private contribution"},
        ${null},
        ${timestamp},
        ${timestamp}
      ),
      (
        ${"ANL-2026-LEGACY-DEGRESSIVE"},
        ${"Altes degressives Anlagegut"},
        ${"equipment"},
        ${"transaction"},
        ${null},
        ${"2026-01-01"},
        ${"2026-01-01"},
        ${100_000},
        ${0},
        ${48},
        ${"declining_balance"},
        ${3_000},
        ${4},
        ${0},
        ${"active"},
        ${null},
        ${null},
        ${null},
        ${0},
        ${"fixed_assets_bikes"},
        ${"accumulated_depreciation"},
        ${null},
        ${null},
        ${"legacy declining asset"},
        ${null},
        ${timestamp},
        ${timestamp}
      )
  `);
  expect(insert.changes).toBe(3);
}

function fixedAssetColumnNames(connection: ReturnType<typeof createDatabaseConnection>) {
  const columns = connection.db.all(sql`PRAGMA table_info(fixed_assets)`) as Array<{ name: string }>;
  return columns.map((column) => column.name);
}

describe("database migrations", () => {
  it.each([95, 96] as const)(
    "migrates a version %s database with existing fixed assets and remains reopenable",
    (version) => {
      const databaseDirectory = mkdtempSync(join(tmpdir(), "munich-bike-rental-db-"));
      temporaryDirectories.push(databaseDirectory);
      const databasePath = join(databaseDirectory, "legacy.db");
      const legacyConnection = createDatabaseConnection(databasePath, legacyMigrationsFolder(version));
      expect(fixedAssetColumnNames(legacyConnection).includes("original_acquisition_date")).toBe(version === 96);
      expect(fixedAssetColumnNames(legacyConnection)).not.toContain("original_acquisition_cost_cents");
      expect(fixedAssetColumnNames(legacyConnection)).not.toContain("original_condition");
      createLegacyFixedAssetRows(legacyConnection);
      legacyConnection.close();

      execFileSync(process.execPath, [resolve(process.cwd(), "scripts/migrate.mjs")], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databasePath, NODE_ENV: "test" },
        stdio: "pipe",
      });

      const migrated = createDatabaseConnection(databasePath);
      connections.push(migrated);
      const assets = migrated.db.select().from(fixedAssets).all();
      expect(assets).toHaveLength(3);
      expect(assets.map((asset) => asset.name)).toEqual(
        expect.arrayContaining(["Altes lineares Anlagegut", "Alte Privateinlage", "Altes degressives Anlagegut"]),
      );
      expect(assets.every((asset) => asset.originalAcquisitionDate === null)).toBe(true);
      expect(assets.every((asset) => asset.originalCondition === null)).toBe(true);
      expect(assets.every((asset) => asset.preEntryDepreciationCents === 0)).toBe(true);
      expect(assets.find((asset) => asset.name === "Altes degressives Anlagegut")).toMatchObject({
        method: "declining_balance",
        degressiveRateBps: 3_000,
        depreciationRevision: 4,
      });

      const legacyPrivate = assets.find((asset) => asset.name === "Alte Privateinlage")!;
      const legacyLinearUpdate = updateFixedAsset(migrated.db, {
        assetId: legacyPrivate.id,
        name: legacyPrivate.name,
        assetType: legacyPrivate.assetType,
        inServiceDate: legacyPrivate.inServiceDate,
        usefulLifeMonths: legacyPrivate.usefulLifeMonths,
        method: "straight_line",
        actorUserId: null,
      });
      expect(legacyLinearUpdate).toMatchObject({
        method: "straight_line",
        originalAcquisitionCostCents: null,
        originalCondition: null,
      });
      const updatedPrivate = updateFixedAsset(migrated.db, {
        assetId: legacyPrivate.id,
        name: legacyPrivate.name,
        assetType: legacyPrivate.assetType,
        inServiceDate: legacyPrivate.inServiceDate,
        originalAcquisitionDate: "2026-07-24",
        originalAcquisitionCostCents: 220_000,
        originalUsefulLifeMonths: 84,
        originalCondition: "used",
        privateUseType: "personal",
        usefulLifeMonths: 83,
        method: "declining_balance",
        actorUserId: null,
      });
      expect(updatedPrivate).toMatchObject({
        originalAcquisitionDate: "2026-07-24",
        method: "declining_balance",
        degressiveRateBps: 3_000,
      });
      expect(fixedAssetDepreciationSchedule(updatedPrivate)[0]).toMatchObject({
        periodStart: "2026-08-01",
        amountCents: 4_875,
      });

      migrated.close();
      const reopened = createDatabaseConnection(databasePath);
      connections.push(reopened);
      expect(reopened.db.select().from(fixedAssets).all()).toHaveLength(3);
      expect(fixedAssetColumnNames(reopened).filter((column) => column === "original_acquisition_date")).toHaveLength(
        1,
      );
      expect(
        fixedAssetColumnNames(reopened).filter((column) => column === "original_acquisition_cost_cents"),
      ).toHaveLength(1);
      expect(fixedAssetColumnNames(reopened).filter((column) => column === "original_condition")).toHaveLength(1);
      const migrationHash = createHash("sha256")
        .update(readFileSync(resolve(process.cwd(), "drizzle/0098_outgoing_rachel_grey.sql")))
        .digest("hex");
      expect(reopened.db.all(sql`SELECT * FROM __drizzle_migrations WHERE hash = ${migrationHash}`)).toHaveLength(1);
    },
  );
});
