import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const carddavSyncJobs = sqliteTable(
  "carddav_sync_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobKey: text("job_key").notNull(),
    requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull(),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    revision: integer("revision").notNull().default(0),
    lastError: text("last_error"),
  },
  (table) => [uniqueIndex("carddav_sync_jobs_key_unique").on(table.jobKey)],
);
