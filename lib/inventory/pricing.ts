import type { LocationInventory } from "./repository";
import type { ContactInquiry } from "../inquiries/schemas";
import { normalizeComputerMountType, normalizePedalType } from "../inquiries/catalog";

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

/** Inventory prices are stored by model; historical requests often include a frame size suffix. */
export function getDailyBikePriceCents(inventory: Pick<LocationInventory, "bikePrices">, requestedBike: string) {
  const exactPrice = inventory.bikePrices.find((bike) => bike.option === requestedBike)?.dailyPriceCents;
  if (exactPrice !== undefined) return exactPrice;
  const model = requestedBike.split(" - ")[0];
  return inventory.bikePrices.find((bike) => bike.option === model)?.dailyPriceCents;
}

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

/** Shared discount calculation for both public estimates and concrete offers. */
export function calculateBikePriceWithDiscounts(
  inventory: {
    discounts: Array<{
      key: string;
      percentage: number;
      weekdayFrom: number | null;
      weekdayTo: number | null;
      minimumRentalDays: number | null;
      requiresStudent: boolean;
      isStackable: boolean;
    }>;
  },
  input: { dailyBikePriceCents: number; periodFrom: string; rentalDays: number; isStudent?: boolean },
) {
  const pickupDate = parseCalendarDate(input.periodFrom);
  let discountCents = 0;
  const appliedDiscountKeys = new Set<string>();
  for (let dayOffset = 0; dayOffset < input.rentalDays; dayOffset += 1) {
    const rentalDate = new Date(pickupDate.getTime() + dayOffset * 86_400_000);
    const applicable = applicableDiscounts(
      inventory as LocationInventory,
      {
        dailyPriceCents: input.dailyBikePriceCents,
        rentalDays: input.rentalDays,
        pickupDate: rentalDate,
        isStudent: input.isStudent,
      },
      rentalDate,
    );
    discountCents += Math.round((input.dailyBikePriceCents * applicable.discountPercentage) / 100);
    applicable.appliedDiscountKeys.forEach((key) => appliedDiscountKeys.add(key));
  }
  return { discountCents, appliedDiscountKeys: [...appliedDiscountKeys] };
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
  const equipmentPrices = new Map(inventory.equipmentPrices.map((item) => [item.key, item.priceCents]));
  const priceForRequestedBike = (requestedBike: string) => getDailyBikePriceCents(inventory, requestedBike) ?? 0;
  const dailyBikePriceCents = payload.bikes.reduce((total, bike) => total + priceForRequestedBike(bike.bikeSize), 0);
  const equipmentSubtotalCents = payload.bikes.reduce((total, bike) => {
    const pedalType = normalizePedalType(bike.pedalType);
    const computerMountType = normalizeComputerMountType(bike.computerMountType);
    const pedals = pedalType && bike.needsPedals ? (equipmentPrices.get(`pedal-${pedalType}`) ?? 0) : 0;
    const mount =
      computerMountType && bike.needsComputerMount ? (equipmentPrices.get(`mount-${computerMountType}`) ?? 0) : 0;
    const helmet = bike.needsHelmet ? (equipmentPrices.get("helmet") ?? 0) : 0;
    const clothing = bike.needsClothing ? (equipmentPrices.get("clothing") ?? 0) : 0;
    const bikepackingBag = bike.needsBikepackingBag ? (equipmentPrices.get("bikepacking-bag") ?? 0) : 0;
    const glasses = bike.needsGlasses ? (equipmentPrices.get("glasses") ?? 0) : 0;
    return total + pedals + mount + helmet + clothing + bikepackingBag + glasses;
  }, 0);

  const { discountCents, appliedDiscountKeys } = calculateBikePriceWithDiscounts(inventory, {
    dailyBikePriceCents,
    periodFrom: payload.periodFrom,
    rentalDays,
  });

  const bikeSubtotalCents = dailyBikePriceCents * rentalDays;
  return {
    rentalDays,
    bikeSubtotalCents,
    equipmentSubtotalCents,
    discountCents,
    totalCents: bikeSubtotalCents + equipmentSubtotalCents - discountCents,
    appliedDiscountKeys,
  };
}
