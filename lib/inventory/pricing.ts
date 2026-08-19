import type { LocationInventory } from "./repository";
import type { ContactInquiry } from "../inquiries/schemas";
import { normalizeComputerMountType, normalizePedalType } from "../inquiries/catalog";

export type RentalPriceInput = {
  dailyPriceCents?: number;
  weekdayPriceCents?: number;
  weekendPriceCents?: number;
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

type BikePriceRecord = {
  option: string;
  dailyPriceCents: number;
  weekdayPriceCents?: number;
  weekendPriceCents?: number;
};

export type BikePriceSchedule = {
  weekdayPriceCents: number;
  weekendPriceCents: number;
};

/** Inventory prices are stored by model; historical requests often include a frame size suffix. */
export function getBikePriceScheduleCents(
  inventory: { bikePrices: BikePriceRecord[] },
  requestedBike: string,
): BikePriceSchedule | undefined {
  const exactPrice = inventory.bikePrices.find((bike) => bike.option === requestedBike);
  if (exactPrice) {
    return {
      weekdayPriceCents: exactPrice.weekdayPriceCents ?? exactPrice.dailyPriceCents,
      weekendPriceCents: exactPrice.weekendPriceCents ?? exactPrice.dailyPriceCents,
    };
  }
  const model = requestedBike.split(" - ")[0];
  const modelPrice = inventory.bikePrices.find((bike) => bike.option === model);
  if (!modelPrice) return undefined;
  return {
    weekdayPriceCents: modelPrice.weekdayPriceCents ?? modelPrice.dailyPriceCents,
    weekendPriceCents: modelPrice.weekendPriceCents ?? modelPrice.dailyPriceCents,
  };
}

export function getDailyBikePriceCents(inventory: { bikePrices: BikePriceRecord[] }, requestedBike: string) {
  return getBikePriceScheduleCents(inventory, requestedBike)?.weekdayPriceCents;
}

function priceForDate(schedule: BikePriceSchedule, date: Date) {
  const weekday = date.getUTCDay();
  return weekday === 0 || weekday === 6 ? schedule.weekendPriceCents : schedule.weekdayPriceCents;
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
  const { bikeSubtotalCents, discountCents, appliedDiscountKeys } = calculateBikePriceWithDiscounts(inventory, {
    dailyBikePriceCents: input.dailyPriceCents,
    weekdayBikePriceCents: input.weekdayPriceCents,
    weekendBikePriceCents: input.weekendPriceCents,
    periodFrom: input.pickupDate.toISOString().slice(0, 10),
    rentalDays: input.rentalDays,
    isStudent: input.isStudent,
  });
  const discountPercentage = bikeSubtotalCents ? Math.round((discountCents * 100) / bikeSubtotalCents) : 0;

  return {
    subtotalCents: bikeSubtotalCents,
    discountPercentage,
    discountCents,
    totalCents: bikeSubtotalCents - discountCents,
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
  input: {
    dailyBikePriceCents?: number;
    weekdayBikePriceCents?: number;
    weekendBikePriceCents?: number;
    periodFrom: string;
    rentalDays: number;
    isStudent?: boolean;
  },
) {
  const pickupDate = parseCalendarDate(input.periodFrom);
  const weekdayBikePriceCents = input.weekdayBikePriceCents ?? input.dailyBikePriceCents ?? 0;
  const weekendBikePriceCents = input.weekendBikePriceCents ?? input.dailyBikePriceCents ?? 0;
  let bikeSubtotalCents = 0;
  let discountCents = 0;
  const appliedDiscountKeys = new Set<string>();
  for (let dayOffset = 0; dayOffset < input.rentalDays; dayOffset += 1) {
    const rentalDate = new Date(pickupDate.getTime() + dayOffset * 86_400_000);
    const dailyBikePriceCents = priceForDate(
      { weekdayPriceCents: weekdayBikePriceCents, weekendPriceCents: weekendBikePriceCents },
      rentalDate,
    );
    bikeSubtotalCents += dailyBikePriceCents;
    const applicable = applicableDiscounts(
      inventory as LocationInventory,
      {
        dailyPriceCents: dailyBikePriceCents,
        rentalDays: input.rentalDays,
        pickupDate: rentalDate,
        isStudent: input.isStudent,
      },
      rentalDate,
    );
    discountCents += Math.round((dailyBikePriceCents * applicable.discountPercentage) / 100);
    applicable.appliedDiscountKeys.forEach((key) => appliedDiscountKeys.add(key));
  }
  return { bikeSubtotalCents, discountCents, appliedDiscountKeys: [...appliedDiscountKeys] };
}

function parseCalendarDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function calculateBikeSubtotalCents(input: {
  dailyBikePriceCents?: number;
  weekdayBikePriceCents?: number;
  weekendBikePriceCents?: number;
  periodFrom: string;
  rentalDays: number;
}) {
  const pickupDate = parseCalendarDate(input.periodFrom);
  const weekdayBikePriceCents = input.weekdayBikePriceCents ?? input.dailyBikePriceCents ?? 0;
  const weekendBikePriceCents = input.weekendBikePriceCents ?? input.dailyBikePriceCents ?? 0;
  let subtotalCents = 0;
  for (let dayOffset = 0; dayOffset < input.rentalDays; dayOffset += 1) {
    subtotalCents += priceForDate(
      { weekdayPriceCents: weekdayBikePriceCents, weekendPriceCents: weekendBikePriceCents },
      new Date(pickupDate.getTime() + dayOffset * 86_400_000),
    );
  }
  return subtotalCents;
}

/** Rental periods include both the pickup and return date. */
export function getRentalDays(periodFrom: string, periodTo: string) {
  const milliseconds = parseCalendarDate(periodTo).getTime() - parseCalendarDate(periodFrom).getTime();
  return Math.max(1, Math.round(milliseconds / 86_400_000) + 1);
}

export function calculateInquiryPrice(inventory: LocationInventory, payload: ContactInquiry): InquiryPrice {
  const rentalDays = getRentalDays(payload.periodFrom, payload.periodTo);
  const equipmentPrices = new Map(inventory.equipmentPrices.map((item) => [item.key, item.priceCents]));
  const priceForRequestedBike = (requestedBike: string) =>
    getBikePriceScheduleCents(inventory, requestedBike) ?? { weekdayPriceCents: 0, weekendPriceCents: 0 };
  const bikePriceSchedules = payload.bikes.map((bike) => priceForRequestedBike(bike.bikeSize));
  const weekdayBikePriceCents = bikePriceSchedules.reduce((total, price) => total + price.weekdayPriceCents, 0);
  const weekendBikePriceCents = bikePriceSchedules.reduce((total, price) => total + price.weekendPriceCents, 0);
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

  const { bikeSubtotalCents, discountCents, appliedDiscountKeys } = calculateBikePriceWithDiscounts(inventory, {
    weekdayBikePriceCents,
    weekendBikePriceCents,
    periodFrom: payload.periodFrom,
    rentalDays,
  });

  return {
    rentalDays,
    bikeSubtotalCents,
    equipmentSubtotalCents,
    discountCents,
    totalCents: bikeSubtotalCents + equipmentSubtotalCents - discountCents,
    appliedDiscountKeys,
  };
}
