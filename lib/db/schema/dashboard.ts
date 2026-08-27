import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { authUser } from "./auth";

/** Revenue targets shared by everyone with the same dashboard data scope. */
export const dashboardRevenueGoals = sqliteTable(
  "dashboard_revenue_goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scopeKey: text("scope_key").notNull(),
    goalYear: integer("goal_year").notNull(),
    annualGoalCents: integer("annual_goal_cents").notNull().default(0),
    monthlyGoalCents: integer("monthly_goal_cents").notNull().default(0),
    updatedBy: text("updated_by").references(() => authUser.id, { onDelete: "set null" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("dashboard_revenue_goals_scope_year_unique").on(table.scopeKey, table.goalYear),
    index("dashboard_revenue_goals_scope_idx").on(table.scopeKey),
    check("dashboard_revenue_goals_annual_cents_check", sql`${table.annualGoalCents} > 0`),
    check("dashboard_revenue_goals_monthly_cents_check", sql`${table.monthlyGoalCents} > 0`),
  ],
);

/** Activities dismissed by a user on the admin dashboard. */
export const dashboardActivityDismissals = sqliteTable(
  "dashboard_activity_dismissals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    activityId: text("activity_id").notNull(),
    dismissedAt: integer("dismissed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("dashboard_activity_dismissals_user_activity_unique").on(table.userId, table.activityId),
    index("dashboard_activity_dismissals_user_idx").on(table.userId),
  ],
);

export const whatsappNotificationStatuses = ["queued", "leased", "sent", "failed"] as const;
export type WhatsAppNotificationStatus = (typeof whatsappNotificationStatuses)[number];

/** Durable WhatsApp delivery queue for dashboard activity notifications. */
export const whatsappNotificationOutbox = sqliteTable(
  "whatsapp_notification_outbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    kind: text("kind").notNull(),
    activityId: text("activity_id"),
    messageText: text("message_text").notNull(),
    status: text("status", { enum: whatsappNotificationStatuses }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }).notNull(),
    leasedAt: integer("leased_at", { mode: "timestamp_ms" }),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("whatsapp_notification_outbox_idempotency_unique").on(table.idempotencyKey),
    index("whatsapp_notification_outbox_status_due_idx").on(table.status, table.nextAttemptAt),
    index("whatsapp_notification_outbox_recipient_idx").on(table.recipientUserId, table.createdAt),
  ],
);

/** Cursor used to avoid replaying historical booking events on first startup. */
export const whatsappNotificationState = sqliteTable("whatsapp_notification_state", {
  id: integer("id").primaryKey(),
  lastBookingEventId: integer("last_booking_event_id").notNull().default(0),
  initializedAt: integer("initialized_at", { mode: "timestamp_ms" }).notNull(),
});
