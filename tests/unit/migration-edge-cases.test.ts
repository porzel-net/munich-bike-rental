import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
  while (temporaryDirectories.length) {
    const directory = temporaryDirectories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

function migrationsThrough(version: number) {
  const directory = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "munich-bike-rental-migration-folder-"));
  temporaryDirectories.push(directory);
  const source = resolve(process.cwd(), "drizzle");
  cpSync(source, directory, { recursive: true });

  for (const file of readdirSync(directory)) {
    const match = /^(\d{4})_.*\.sql$/u.exec(file);
    if (match && Number(match[1]) > version) rmSync(join(directory, file));
  }
  for (const file of readdirSync(join(directory, "meta"))) {
    const match = /^(\d{4})_snapshot\.json$/u.exec(file);
    if (match && Number(match[1]) > version) rmSync(join(directory, "meta", file));
  }

  const journalPath = join(directory, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: Array<{ idx: number }> };
  journal.entries = journal.entries.filter((entry) => entry.idx <= version);
  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
  return directory;
}

function migrateFrom(version: number, seed: (db: ReturnType<typeof createDatabaseConnection>["db"]) => void) {
  const databaseDirectory = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "munich-bike-rental-migration-db-"));
  temporaryDirectories.push(databaseDirectory);
  const databasePath = join(databaseDirectory, "legacy.db");
  const legacy = createDatabaseConnection(databasePath, migrationsThrough(version));
  try {
    seed(legacy.db);
  } finally {
    legacy.close();
  }
  const migrated = createDatabaseConnection(databasePath);
  connections.push(migrated);
  return migrated;
}

function run(db: ReturnType<typeof createDatabaseConnection>["db"], statement: string) {
  for (const part of statement.split(";")) {
    if (part.trim()) db.run(sql.raw(part));
  }
}

function insertNormalizedBookingFixture(db: ReturnType<typeof createDatabaseConnection>["db"]) {
  run(
    db,
    `
      INSERT INTO bike_models (id, location, model_key, title, description_de, description_en, image, gallery_json, facts_json, equipment_json, created_at)
      VALUES (1, 'munich', 'test-road', 'Test Road', '', '', '', '[]', '[]', '{}', 1000);
      INSERT INTO bike_variants (id, model_id, size, created_at) VALUES (1, 1, 'M', 1000);
      INSERT INTO rental_assets (id, variant_id, location, asset_code, display_name, daily_price_cents, state, created_at, updated_at)
      VALUES (1, 1, 'munich', 'TEST-1', 'Test Road - M', 4900, 'active', 1000, 1000);
    `,
  );
}

describe("migration edge cases", () => {
  it("runs every migration on an empty database, reopens cleanly, and keeps SQLite integrity", () => {
    const databaseDirectory = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "munich-bike-rental-fresh-db-"));
    temporaryDirectories.push(databaseDirectory);
    const databasePath = join(databaseDirectory, "fresh.db");

    const first = createDatabaseConnection(databasePath);
    connections.push(first);
    expect(first.db.get<{ count: number }>(sql`SELECT COUNT(*) AS count FROM __drizzle_migrations`)?.count).toBe(100);
    expect(first.db.get<{ integrity_check: string }>(sql`PRAGMA integrity_check`)?.integrity_check).toBe("ok");
    expect(first.db.all(sql`PRAGMA foreign_key_check`)).toHaveLength(0);
    first.close();
    connections.splice(connections.indexOf(first), 1);

    const reopened = createDatabaseConnection(databasePath);
    connections.push(reopened);
    expect(reopened.db.get<{ count: number }>(sql`SELECT COUNT(*) AS count FROM __drizzle_migrations`)?.count).toBe(
      100,
    );
    expect(reopened.db.all(sql`PRAGMA foreign_key_check`)).toHaveLength(0);
  });

  it("does not allocate one physical asset twice when legacy offers or requested items are ambiguous", () => {
    const migrated = migrateFrom(22, (db) => {
      insertNormalizedBookingFixture(db);
      run(
        db,
        `
          INSERT INTO bookings (id, order_number, customer_name, customer_email, customer_phone, location, period_from, period_to, pickup_time, dropoff_time, customer_message, communication_locale, source, status, quoted_total_cents, version, created_at, updated_at)
          VALUES
            (1, 'AMBIGUOUS-ITEMS', 'Items', 'items@example.com', '1', 'munich', '2026-08-10', '2026-08-11', '10:00', '10:00', '', 'de', 'web', 'confirmed', 9800, 1, 1000, 1000),
            (2, 'AMBIGUOUS-OFFERS', 'Offers', 'offers@example.com', '2', 'munich', '2026-08-10', '2026-08-11', '10:00', '10:00', '', 'de', 'web', 'confirmed', 4900, 1, 1000, 1000),
            (3, 'MAPPABLE', 'Mappable', 'mappable@example.com', '3', 'munich', '2026-08-10', '2026-08-11', '10:00', '10:00', '', 'de', 'web', 'confirmed', 4900, 1, 1000, 1000);
          INSERT INTO booking_requested_items (id, booking_id, position, requested_label, height_cm, needs_pedals, needs_computer_mount, needs_helmet, needs_clothing)
            VALUES (11, 1, 0, 'Test Road - M', 180, 0, 0, 0, 0), (12, 1, 1, 'Test Road - M', 180, 0, 0, 0, 0), (21, 2, 0, 'Test Road - M', 180, 0, 0, 0, 0), (31, 3, 0, 'Mappable Road - M', 180, 0, 0, 0, 0);
          INSERT INTO booking_offers (id, booking_id, offer_number, status, token_hash, expires_at, created_at)
          VALUES (101, 1, 1, 'accepted', 'token-101', 2000, 1000), (201, 2, 1, 'accepted', 'token-201', 2000, 1000), (202, 2, 2, 'accepted', 'token-202', 2000, 1000), (301, 3, 1, 'accepted', 'token-301', 2000, 1000);
        `,
      );
      run(
        db,
        `
          INSERT INTO bike_models (id, location, model_key, title, description_de, description_en, image, gallery_json, facts_json, equipment_json, created_at)
          VALUES (2, 'munich', 'test-road-2', 'Mappable Road', '', '', '', '[]', '[]', '{}', 1000);
          INSERT INTO bike_variants (id, model_id, size, created_at) VALUES (2, 2, 'M', 1000);
          INSERT INTO rental_assets (id, variant_id, location, asset_code, display_name, daily_price_cents, state, created_at, updated_at)
          VALUES (2, 2, 'munich', 'TEST-2', 'Mappable Road - M', 4900, 'active', 1000, 1000);
        `,
      );
    });

    const allocations = migrated.db.all<{ booking_id: number }>(sql`
      SELECT booking_id FROM booking_asset_allocations ORDER BY booking_id
    `);
    expect(allocations).toEqual([{ booking_id: 3 }]);
    expect(
      migrated.db.get<{ count: number }>(sql`SELECT COUNT(*) AS count FROM booking_asset_allocations`)?.count,
    ).toBe(1);
    expect(migrated.db.all(sql`PRAGMA foreign_key_check`)).toHaveLength(0);
  });

  it("restores concrete offer assets without relying on requested labels", () => {
    const migrated = migrateFrom(99, (db) => {
      run(
        db,
        `
          INSERT INTO bike_models (id, location, model_key, title, description_de, description_en, image, gallery_json, facts_json, equipment_json, created_at)
          VALUES (1, 'munich', 'test-road', 'Test Road', '', '', '', '[]', '[]', '{}', 1000);
          INSERT INTO bike_variants (id, model_id, size, created_at) VALUES (1, 1, 'M', 1000);
          INSERT INTO rental_assets (id, variant_id, location, asset_code, display_name, weekday_price_cents, weekend_price_cents, state, created_at, updated_at)
          VALUES (1, 1, 'munich', 'TEST-1', 'Test Road - M', 4900, 6900, 'active', 1000, 1000);

          INSERT INTO bookings (id, order_number, customer_name, customer_email, customer_phone, location, period_from, period_to, pickup_time, dropoff_time, customer_message, communication_locale, source, status, quoted_total_cents, version, created_at, updated_at)
          VALUES
            (1, 'SAFE', 'Safe', 'safe@example.com', '1', 'munich', '2026-09-01', '2026-09-01', '09:00', '18:00', '', 'de', 'web', 'confirmed', 4900, 1, 1000, 1000),
            (2, 'MULTI-OFFER', 'Multi', 'multi@example.com', '2', 'munich', '2026-09-02', '2026-09-02', '09:00', '18:00', '', 'de', 'legacy', 'completed', 4900, 1, 1000, 1000),
            (3, 'DUPLICATE-ASSET', 'Duplicate', 'duplicate@example.com', '3', 'munich', '2026-09-03', '2026-09-03', '09:00', '18:00', '', 'de', 'legacy', 'completed', 9800, 1, 1000, 1000),
            (4, 'CONFLICT', 'Conflict', 'conflict@example.com', '4', 'munich', '2026-09-04', '2026-09-04', '09:00', '18:00', '', 'de', 'legacy', 'completed', 4900, 1, 1000, 1000),
            (5, 'EXISTING', 'Existing', 'existing@example.com', '5', 'munich', '2026-09-04', '2026-09-04', '10:00', '17:00', '', 'de', 'legacy', 'completed', 4900, 1, 1000, 1000);

          INSERT INTO booking_requested_items (id, booking_id, position, requested_label, height_cm, needs_pedals, needs_computer_mount, needs_helmet, needs_clothing)
          VALUES
            (11, 1, 0, 'Customer requested road bike', 180, 0, 0, 0, 0),
            (21, 2, 0, 'Test Road - M', 180, 0, 0, 0, 0),
            (31, 3, 0, 'Test Road - M', 180, 0, 0, 0, 0),
            (32, 3, 1, 'Test Road - M', 180, 0, 0, 0, 0),
            (41, 4, 0, 'Test Road - M', 180, 0, 0, 0, 0),
            (51, 5, 0, 'Test Road - M', 180, 0, 0, 0, 0);

          INSERT INTO booking_offers (id, booking_id, offer_number, status, token_hash, expires_at, total_cents, created_at, accepted_at)
          VALUES
            (101, 1, 1, 'accepted', 'safe-token', 2000, 4900, 1000, 1000),
            (201, 2, 1, 'accepted', 'multi-token-1', 2000, 4900, 1000, 1000),
            (202, 2, 2, 'accepted', 'multi-token-2', 2000, 4900, 1000, 1000),
            (301, 3, 1, 'accepted', 'duplicate-token', 2000, 9800, 1000, 1000),
            (401, 4, 1, 'accepted', 'conflict-token', 2000, 4900, 1000, 1000),
            (501, 5, 1, 'accepted', 'existing-token', 2000, 4900, 1000, 1000);

          INSERT INTO booking_offer_items (id, offer_id, requested_item_id, asset_id, item_price_cents)
          VALUES
            (1001, 101, 11, 1, 4900),
            (2001, 201, 21, 1, 4900),
            (2002, 202, 21, 1, 4900),
            (3001, 301, 31, 1, 4900),
            (3002, 301, 32, 1, 4900),
            (4001, 401, 41, 1, 4900),
            (5001, 501, 51, 1, 4900);

          INSERT INTO booking_asset_allocations (booking_id, offer_id, asset_id, period_from, period_to, pickup_time, dropoff_time, created_at)
          VALUES (5, 501, 1, '2026-09-04', '2026-09-04', '10:00', '17:00', 1000);
        `,
      );
    });

    expect(
      migrated.db.all<{ booking_id: number; asset_id: number }>(sql`
        SELECT booking_id, asset_id
        FROM booking_asset_allocations
        ORDER BY booking_id
      `),
    ).toEqual([
      { booking_id: 1, asset_id: 1 },
      { booking_id: 5, asset_id: 1 },
    ]);
    expect(migrated.db.all(sql`PRAGMA foreign_key_check`)).toHaveLength(0);
  });

  it("maps legacy catalog rows, default sizes, aliases, and historical revenue without duplicates", () => {
    const migrated = migrateFrom(20, (db) => {
      run(
        db,
        `
          INSERT INTO rental_location_bikes (id, location, bike_key, title, price_cents_per_day, description_de, description_en, image, gallery_json, facts_json, equipment_json, display_order, is_available)
          VALUES (1, 'munich', 'legacy-road', 'Legacy Road', 4900, '', '', '', '[]', '[]', '{}', 1, 1), (2, 'munich', 'legacy-standard', 'Legacy Standard', 3900, '', '', '', '[]', '[]', '{}', 2, 1);
          INSERT INTO rental_location_bike_sizes (location_bike_id, size, is_available) VALUES (1, 'M', 1), (1, 'L', 1);
          INSERT INTO rental_location_equipment (id, location, equipment_key, category, label_de, label_en, price_cents, display_order, is_available)
          VALUES (10, 'munich', 'repair-kit', 'included', 'Reparaturset', 'Repair kit', 0, 1, 1);
          INSERT INTO rental_inquiries (id, order_number, name, email, phone, location, period_from, period_to, pickup_time, dropoff_time, message, bike_title, locale, mail_status, submitted_at, status, source, total_price_cents)
          VALUES (1, 'LEGACY-1', 'Legacy Customer', 'legacy@example.com', '1', 'munich', '2026-08-10', '2026-08-11', '10:00', '10:00', '', 'Legacy Road', 'de', 'sent', 1000, 'confirmed', 'automatic', 4900);
          INSERT INTO rental_inquiry_bikes (inquiry_id, position, height_cm, bike_size, needs_pedals, pedal_type, needs_computer_mount, computer_mount_type, needs_helmet, needs_clothing)
          VALUES (1, 0, 180, 'Legacy Road - M', 1, ' SPD ', 1, ' unknown ', 0, 0);
          INSERT INTO accounting_revenues (id, inquiry_id, amount_cents, paid_amount_cents, payer_name, created_at, updated_at)
          VALUES (1, 1, 4900, 4900, 'Legacy Customer', 1000, 1000);
          INSERT INTO accounting_revenue_payments (id, revenue_id, amount_cents, received_at, created_at)
          VALUES (1, 1, 4900, '2026-08-10', 1000);
        `,
      );
    });

    expect(migrated.db.get<{ count: number }>(sql`SELECT COUNT(*) AS count FROM bike_variants`)?.count).toBe(3);
    expect(migrated.db.get<{ count: number }>(sql`SELECT COUNT(*) AS count FROM rental_assets`)?.count).toBe(3);
    expect(migrated.db.all<{ display_name: string }>(sql`SELECT display_name FROM rental_assets`)).toEqual(
      expect.arrayContaining([{ display_name: "Legacy Road - M" }]),
    );
    expect(
      migrated.db.get<{ count: number }>(sql`SELECT COUNT(*) AS count FROM booking_asset_allocations`)?.count,
    ).toBe(1);
    expect(
      migrated.db.get<{ category: string; quantity_relevant: number; state: string }>(sql`
      SELECT category, quantity_relevant, state FROM accessory_inventory WHERE accessory_key = 'repair-kit'
    `),
    ).toMatchObject({ category: "repair-kit", quantity_relevant: 0, state: "active" });
    expect(
      migrated.db.get<{ pedal_type: string; computer_mount_type: string }>(sql`
      SELECT pedal_type, computer_mount_type FROM booking_requested_items WHERE booking_id = 1
    `),
    ).toEqual({ pedal_type: "spdSl", computer_mount_type: "other" });
    expect(
      migrated.db.all(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rental_location_bikes'`),
    ).toHaveLength(0);
    expect(migrated.db.all(sql`PRAGMA foreign_key_check`)).toHaveLength(0);
  });

  it("generates deterministic invoice numbers for completed and newly confirmed legacy bookings", () => {
    const migrated = migrateFrom(36, (db) => {
      run(
        db,
        `
          INSERT INTO bookings (id, order_number, customer_name, customer_email, customer_phone, location, period_from, period_to, pickup_time, dropoff_time, customer_message, communication_locale, source, status, quoted_total_cents, version, created_at, updated_at)
          VALUES
            (1, 'INVOICE-1', 'One', 'one@example.com', '1', 'munich', '2026-08-10', '2026-08-11', '10:00', '10:00', '', 'de', 'legacy', 'completed', 4900, 1, 1000, 1780000000000),
            (2, 'INVOICE-2', 'Two', 'two@example.com', '2', 'munich', '2026-08-10', '2026-08-11', '10:00', '10:00', '', 'de', 'legacy', 'completed', 4900, 1, 1000, 1780000000000),
            (3, 'INVOICE-3', 'Three', 'three@example.com', '3', 'munich', '2026-08-10', '2026-08-11', '10:00', '10:00', '', 'de', 'legacy', 'confirmed', 4900, 1, 1000, 1780000001000);
        `,
      );
    });

    expect(
      migrated.db.all<{ id: number; invoice_number: string }>(sql`
        SELECT id, invoice_number FROM bookings ORDER BY id
      `),
    ).toEqual([
      { id: 1, invoice_number: "YBR-2026-0001" },
      { id: 2, invoice_number: "YBR-2026-0002" },
      { id: 3, invoice_number: "YBR-2026-0003" },
    ]);
  });
});
