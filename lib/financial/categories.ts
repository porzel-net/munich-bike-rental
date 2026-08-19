import { eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { financialCategories } from "../db/schema";
import { BookingCommandError } from "../bookings/errors";

export const financialCategoryCodes = {
  rentalRevenue: "rental_revenue",
  inputVat: "input_vat",
  businessMealNonDeductible: "business_meal_non_deductible",
  privateMealShare: "private_meal_share",
} as const;

export function getActiveFinancialCategoryByCode(db: AppDatabase, code: string) {
  const category = db.select().from(financialCategories).where(eq(financialCategories.code, code)).get();
  if (!category || !category.isActive)
    throw new BookingCommandError(`Die Buchhaltungskategorie ${code} ist nicht eingerichtet.`);
  return category;
}

/**
 * Every booking payment/refund is rental revenue for EÜR purposes. Keeping
 * this lookup in one place prevents individual write paths from forgetting
 * the persisted category on the financial allocation.
 */
export function getBookingRevenueCategory(db: AppDatabase) {
  return getActiveFinancialCategoryByCode(db, financialCategoryCodes.rentalRevenue);
}
