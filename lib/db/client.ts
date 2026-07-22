import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { seedRentalInventoryIfEmpty } from "../inventory/seed";
import * as schema from "./schema";

const SQLITE_BUSY_TIMEOUT_MS = 5_000;

export const createDrizzleClient = (client: InstanceType<typeof Database>) => drizzle({ client, schema });
export type AppDatabase = ReturnType<typeof createDrizzleClient>;

export function getDatabasePath(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  const configuredPath = environment.DATABASE_URL?.trim();
  const defaultPath = environment.NODE_ENV === "production" ? "/data/bikerental.db" : "./data/bikerental.db";
  const databasePath = configuredPath || defaultPath;

  if (databasePath.includes("\0")) {
    throw new Error("DATABASE_URL must be a filesystem path");
  }

  if (environment.NODE_ENV === "production" && !isAbsolute(databasePath)) {
    throw new Error("DATABASE_URL must be an absolute path in production");
  }

  return resolve(databasePath);
}

function prepareDatabaseDirectory(databasePath: string) {
  if (databasePath === ":memory:") return;

  const databaseDirectory = dirname(databasePath);
  mkdirSync(databaseDirectory, { recursive: true, mode: 0o700 });
  chmodSync(databaseDirectory, 0o700);
}

function configureSqlite(client: InstanceType<typeof Database>) {
  client.pragma("foreign_keys = ON");
  client.pragma("journal_mode = WAL");
  client.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
  client.pragma("synchronous = NORMAL");
}

function restoreMissingInquiryBikes(client: InstanceType<typeof Database>) {
  const legacyTables = client
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('legacy_bike_requests', 'legacy_bike_request_items')")
    .all() as Array<{ name: string }>;
  if (legacyTables.length !== 2) return;

  const inquiries = client
    .prepare(
      `SELECT i.id, i.order_number
       FROM rental_inquiries i
       JOIN legacy_bike_requests r ON ltrim(i.order_number, '#') = r.order_number
       WHERE NOT EXISTS (SELECT 1 FROM rental_inquiry_bikes b WHERE b.inquiry_id = i.id)`,
    )
    .all() as Array<{ id: number; order_number: string }>;
  if (!inquiries.length) return;

  const legacyBikes = client.prepare(
    `SELECT r.*, it.bike_number AS item_bike_number, it.height_cm AS item_height_cm,
       it.bike_model AS item_bike_model, it.original_bike_model AS item_original_bike_model,
       it.bike_size AS item_bike_size, it.requested_bike_size AS item_requested_bike_size,
       it.pedals_requested AS item_pedals_requested, it.computer_mount_requested AS item_computer_mount_requested,
       it.helmet_requested AS item_helmet_requested, it.clothing_requested AS item_clothing_requested
     FROM legacy_bike_requests r
     LEFT JOIN legacy_bike_request_items it ON it.bike_request_id = r.id
     WHERE r.order_number = ?
     ORDER BY COALESCE(it.bike_number, 1)`,
  );
  const insert = client.prepare(
    `INSERT INTO rental_inquiry_bikes
      (inquiry_id, position, height_cm, bike_size, needs_pedals, pedal_type, needs_computer_mount, computer_mount_type, needs_helmet, needs_clothing)
     VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)`,
  );

  client.transaction(() => {
    for (const inquiry of inquiries) {
      const bikes = legacyBikes.all(inquiry.order_number.replace(/^#/, "")) as Array<Record<string, unknown>>;
      for (const bike of bikes) {
        const model =
          bike.item_original_bike_model || bike.item_bike_model || bike.original_bike_model || bike.bike_model || "Fahrrad";
        const size =
          bike.item_requested_bike_size || bike.item_bike_size || bike.requested_bike_size || bike.bike_size || "Unbekannt";
        const bikeSize = String(model).toLocaleLowerCase().includes(String(size).toLocaleLowerCase())
          ? String(model)
          : `${model} - ${size}`;
        insert.run(
          inquiry.id,
          bike.item_bike_number || 1,
          Math.round(Number(bike.item_height_cm ?? bike.height_cm ?? 170)),
          bikeSize,
          Number(bike.item_pedals_requested ?? bike.pedals_requested ?? 0) ? 1 : 0,
          Number(bike.item_computer_mount_requested ?? bike.computer_mount_requested ?? 0) ? 1 : 0,
          Number(bike.item_helmet_requested ?? bike.helmet_requested ?? 0) ? 1 : 0,
          Number(bike.item_clothing_requested ?? bike.clothing_requested ?? 0) ? 1 : 0,
        );
      }
    }
  })();
}

export function createDatabaseConnection(databasePath: string, migrationsFolder = resolve(process.cwd(), "drizzle")) {
  prepareDatabaseDirectory(databasePath);

  const client = new Database(databasePath);
  configureSqlite(client);
  const db = createDrizzleClient(client);
  migrate(db, { migrationsFolder });
  restoreMissingInquiryBikes(client);
  seedRentalInventoryIfEmpty(db);

  if (databasePath !== ":memory:" && existsSync(databasePath)) {
    chmodSync(databasePath, 0o600);
  }

  return { db, close: () => client.close() };
}

let connection: ReturnType<typeof createDatabaseConnection> | undefined;

export function getDatabase() {
  connection ??= createDatabaseConnection(getDatabasePath());
  return connection.db;
}

export function resetDatabaseConnectionForTests() {
  connection?.close();
  connection = undefined;
}
