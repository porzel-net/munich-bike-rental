import type { LocationInventory } from "./repository";
import type { ContactInquiry } from "../inquiries/schemas";

export type RentalPriceInput = {
  dailyPriceCents: number;
  rentalDays: number;
  pickupDate: Date;
  isStudent?: boolean;
};

export type InquiryPrice = {
  rentalDays: number;
  bikeSubtotalCents: number;
  equipmentSubtotalCents: number;
  discountCents: number;
  totalCents: number;
  appliedDiscountKeys: string[];
};

function applicableDiscounts(inventory: LocationInventory, input: RentalPriceInput, date: Date) {
  const weekday = date.getUTCDay() || 7;
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
    discountPercentage,
    appliedDiscountKeys: applicable
      .filter((discount) => discount.isStackable || discount.key === exclusive?.key)
      .map((discount) => discount.key),
  };
}

export function calculateRentalPrice(inventory: LocationInventory, input: RentalPriceInput) {
  const subtotalCents = input.dailyPriceCents * input.rentalDays;
  const { discountPercentage, appliedDiscountKeys } = applicableDiscounts(inventory, input, input.pickupDate);
  const discountCents = Math.round((subtotalCents * discountPercentage) / 100);

  return {
    subtotalCents,
    discountPercentage,
    discountCents,
    totalCents: subtotalCents - discountCents,
    appliedDiscountKeys,
  };
}

function parseCalendarDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Rental periods include both the pickup and return date. */
export function getRentalDays(periodFrom: string, periodTo: string) {
  const milliseconds = parseCalendarDate(periodTo).getTime() - parseCalendarDate(periodFrom).getTime();
  return Math.max(1, Math.round(milliseconds / 86_400_000) + 1);
}

export function calculateInquiryPrice(inventory: LocationInventory, payload: ContactInquiry): InquiryPrice {
  const rentalDays = getRentalDays(payload.periodFrom, payload.periodTo);
  const bikePrices = new Map(inventory.bikePrices.map((bike) => [bike.option, bike.dailyPriceCents]));
  const equipmentPrices = new Map(inventory.equipmentPrices.map((item) => [item.key, item.priceCents]));
  const dailyBikePriceCents = payload.bikes.reduce((total, bike) => total + (bikePrices.get(bike.bikeSize) ?? 0), 0);
  const equipmentSubtotalCents = payload.bikes.reduce((total, bike) => {
    const pedals = bike.needsPedals ? (equipmentPrices.get(`pedal-${bike.pedalType}`) ?? 0) : 0;
    const mount = bike.needsComputerMount ? (equipmentPrices.get(`mount-${bike.computerMountType}`) ?? 0) : 0;
    const helmet = bike.needsHelmet ? (equipmentPrices.get("helmet") ?? 0) : 0;
    const clothing = bike.needsClothing ? (equipmentPrices.get("clothing") ?? 0) : 0;
    return total + pedals + mount + helmet + clothing;
  }, 0);

  let discountCents = 0;
  const appliedDiscountKeys = new Set<string>();
  const pickupDate = parseCalendarDate(payload.periodFrom);
  for (let dayOffset = 0; dayOffset < rentalDays; dayOffset += 1) {
    const rentalDate = new Date(pickupDate.getTime() + dayOffset * 86_400_000);
    const applicable = applicableDiscounts(
      inventory,
      { dailyPriceCents: dailyBikePriceCents, rentalDays, pickupDate: rentalDate },
      rentalDate,
    );
    discountCents += Math.round((dailyBikePriceCents * applicable.discountPercentage) / 100);
    applicable.appliedDiscountKeys.forEach((key) => appliedDiscountKeys.add(key));
  }

  const bikeSubtotalCents = dailyBikePriceCents * rentalDays;
  return {
    rentalDays,
    bikeSubtotalCents,
    equipmentSubtotalCents,
    discountCents,
    totalCents: bikeSubtotalCents + equipmentSubtotalCents - discountCents,
    appliedDiscountKeys: [...appliedDiscountKeys],
  };
}
