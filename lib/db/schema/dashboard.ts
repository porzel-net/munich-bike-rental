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
