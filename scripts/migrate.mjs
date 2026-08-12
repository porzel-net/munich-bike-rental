import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const configuredPath = process.env.DATABASE_URL?.trim();
const rawDatabasePath = configuredPath || "./data/bikerental.db";
const databasePath = rawDatabasePath === ":memory:" ? rawDatabasePath : resolve(rawDatabasePath);

if (process.env.NODE_ENV === "production" && !isAbsolute(rawDatabasePath)) {
  throw new Error("DATABASE_URL must be an absolute path in production");
}

if (databasePath !== ":memory:") {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
}

const client = new Database(databasePath);

// Drizzle wraps SQLite migrations in a transaction. SQLite ignores
// PRAGMA foreign_keys changes inside that transaction, so disable FK actions
// before entering it and restore enforcement after commit or rollback.
client.pragma("foreign_keys = OFF");
try {
  migrate(drizzle({ client }), { migrationsFolder: resolve("drizzle") });
} finally {
  client.pragma("foreign_keys = ON");
  if (databasePath !== ":memory:" && existsSync(databasePath)) chmodSync(databasePath, 0o600);
  client.close();
}
