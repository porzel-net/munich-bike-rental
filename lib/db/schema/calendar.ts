import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { authUser } from "./auth";

/**
 * Per-user read-only calendar credentials. The password is never persisted in
 * cleartext; it is generated and shown once when the account is created or
 * rotated.
 */
export const calendarAccounts = sqliteTable(
  "calendar_accounts",
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
  },
  (table) => [
    uniqueIndex("calendar_accounts_user_id_unique").on(table.userId),
    uniqueIndex("calendar_accounts_username_unique").on(table.username),
  ],
);

/** Per-user calendar filter state shared across devices. */
export const calendarFilterPreferences = sqliteTable(
  "calendar_filter_preferences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    location: text("location").notNull().default("all"),
    status: text("status").notNull().default(""),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("calendar_filter_preferences_user_id_unique").on(table.userId)],
);
