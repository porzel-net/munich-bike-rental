export * from "./schema/auth";
export * from "./schema/rentals";
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { rentalInquiries } from "./schema/rentals";

/** Accounting expenses recorded for the business. Monetary values are stored in cents. */
export const accountingExpenses = sqliteTable("accounting_expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  /** The supplier or other recipient of the payment, rather than the buyer. */
  payeeName: text("payee_name").notNull(),
  /** Date on which the payment was made, stored as YYYY-MM-DD. */
  paymentDate: text("payment_date"),
  depreciationDurationMonths: integer("depreciation_duration_months"),
  sumCents: integer("sum_cents").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/** Revenue records are created automatically once a booking is confirmed. */
export const accountingRevenues = sqliteTable(
  "accounting_revenues",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    inquiryId: integer("inquiry_id")
      .notNull()
      .references(() => rentalInquiries.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    paidAmountCents: integer("paid_amount_cents").notNull().default(0),
    paymentReceivedAt: text("payment_received_at"),
    payerName: text("payer_name").notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("accounting_revenues_inquiry_id_unique").on(table.inquiryId),
    check("accounting_revenues_amount_cents_check", sql`${table.amountCents} >= 0`),
    check("accounting_revenues_paid_amount_cents_check", sql`${table.paidAmountCents} >= 0`),
  ],
);

export const accountingRevenuePayments = sqliteTable(
  "accounting_revenue_payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    revenueId: integer("revenue_id")
      .notNull()
      .references(() => accountingRevenues.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    receivedAt: text("received_at").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("accounting_revenue_payments_revenue_id_idx").on(table.revenueId),
    check("accounting_revenue_payments_amount_cents_check", sql`${table.amountCents} > 0`),
  ],
);
