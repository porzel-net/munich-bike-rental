import type { LocationInventory } from "./repository";

export type RentalPriceInput = {
  dailyPriceCents: number;
  rentalDays: number;
  pickupDate: Date;
  isStudent?: boolean;
};

export function calculateRentalPrice(inventory: LocationInventory, input: RentalPriceInput) {
  const subtotalCents = input.dailyPriceCents * input.rentalDays;
  const weekday = input.pickupDate.getDay() || 7;
  const applicable = inventory.discounts.filter((discount) => {
    if (discount.requiresStudent && !input.isStudent) return false;
    if (discount.minimumRentalDays && input.rentalDays < discount.minimumRentalDays) return false;
    if (discount.weekdayFrom && discount.weekdayTo && (weekday < discount.weekdayFrom || weekday > discount.weekdayTo))
      return false;
    return true;
  });
  const exclusive = applicable
    .filter((discount) => !discount.isStackable)
    .sort((left, right) => right.percentage - left.percentage)[0];
  const stackablePercentage = applicable
    .filter((discount) => discount.isStackable)
    .reduce((total, discount) => total + discount.percentage, 0);
  const discountPercentage = Math.min(100, (exclusive?.percentage ?? 0) + stackablePercentage);

  return {
    subtotalCents,
    discountPercentage,
    discountCents: Math.round((subtotalCents * discountPercentage) / 100),
    totalCents: subtotalCents - Math.round((subtotalCents * discountPercentage) / 100),
    appliedDiscountKeys: applicable
      .filter((discount) => discount.isStackable || discount.key === exclusive?.key)
      .map((discount) => discount.key),
  };
}
