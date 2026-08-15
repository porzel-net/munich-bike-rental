import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { authUser } from "./auth";

/**
 * Per-user CardDAV credentials. The password is deliberately stored only as
 * a scrypt hash. The cleartext value is generated and shown once during
 * rotation, then discarded.
 */
export const carddavAccounts = sqliteTable(
  "carddav_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
    lastSyncError: text("last_sync_error"),
  },
  (table) => [
    uniqueIndex("carddav_accounts_user_id_unique").on(table.userId),
    uniqueIndex("carddav_accounts_username_unique").on(table.username),
  ],
);
