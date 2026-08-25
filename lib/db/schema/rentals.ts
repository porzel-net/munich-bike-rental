import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const rentalLocationDiscounts = sqliteTable(
  "rental_location_discounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    location: text("location").notNull(),
    discountKey: text("discount_key").notNull(),
    labelDe: text("label_de").notNull(),
    labelEn: text("label_en").notNull(),
    percentage: integer("percentage").notNull(),
    weekdayFrom: integer("weekday_from"),
    weekdayTo: integer("weekday_to"),
    minimumRentalDays: integer("minimum_rental_days"),
    requiresStudent: integer("requires_student", { mode: "boolean" }).notNull().default(false),
    isStackable: integer("is_stackable", { mode: "boolean" }).notNull().default(false),
    displayOrder: integer("display_order").notNull(),
    isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("rental_location_discounts_location_key_unique").on(table.location, table.discountKey),
    index("rental_location_discounts_location_order_idx").on(table.location, table.displayOrder),
    check("rental_location_discounts_percentage_check", sql`${table.percentage} between 0 and 100`),
  ],
);
