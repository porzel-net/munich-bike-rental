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

export function createDatabaseConnection(databasePath: string, migrationsFolder = resolve(process.cwd(), "drizzle")) {
  prepareDatabaseDirectory(databasePath);

  const client = new Database(databasePath);
  configureSqlite(client);
  const db = createDrizzleClient(client);
  migrate(db, { migrationsFolder });
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
