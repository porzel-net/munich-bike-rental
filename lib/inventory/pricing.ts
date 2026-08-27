import type { LocationInventory } from "./repository";
import type { ContactInquiry } from "../inquiries/schemas";
import { normalizeComputerMountType, normalizePedalType } from "../inquiries/catalog";
import { berlinDateKey, parseDateOnly } from "../datetime";

export const MAX_DAILY_DISCOUNT_PERCENTAGE = 25;

export type BikePriceScheduleInput = {
  weekdayPriceCents: number;
  weekendPriceCents: number;
};

export type DailyPriceBreakdown = {
  date: string;
  rentalDay: number;
  baseCents: number;
  discountPercentage: number;
  discountCents: number;
  totalCents: number;
  appliedDiscountKeys: string[];
};

export type BikePriceBreakdown = {
  bikeIndex: number;
  baseCents: number;
  discountCents: number;
  totalCents: number;
};

export type RentalPriceCalculation = {
  rentalDays: number;
  bikeSubtotalCents: number;
  equipmentSubtotalCents: number;
  discountCents: number;
  totalCents: number;
  appliedDiscountKeys: string[];
  dailyBreakdown: DailyPriceBreakdown[];
  bikeBreakdown: BikePriceBreakdown[];
};

export type InquiryPrice = RentalPriceCalculation;

type DiscountRecord = {
  key: string;
  percentage: number;
  weekdayFrom: number | null;
  weekdayTo: number | null;
  minimumRentalDays: number | null;
  requiresStudent: boolean;
  isStackable: boolean;
};

type DiscountInventory = { discounts: DiscountRecord[] };

type CentralPriceInput = {
  bikes: BikePriceScheduleInput[];
  equipmentSubtotalCents?: number;
  periodFrom: string;
  rentalDays: number;
  isStudent?: boolean;
};

export type EquipmentPriceSelection = {
  needsPedals?: boolean;
  pedalType?: string | null;
  needsComputerMount?: boolean;
  computerMountType?: string | null;
  needsHelmet?: boolean;
  needsClothing?: boolean;
  needsBikepackingBag?: boolean;
  needsGlasses?: boolean;
};

type BikePriceSchedule = {
  weekdayPriceCents: number;
  weekendPriceCents: number;
};

/** Inventory prices are stored by model; historical requests often include a frame size suffix. */
export function getBikePriceScheduleCents(
  inventory: {
    bikePrices: Array<{
      option: string;
      weekdayPriceCents: number;
      weekendPriceCents: number;
    }>;
  },
  requestedBike: string,
): BikePriceSchedule | undefined {
  const exactPrice = inventory.bikePrices.find((bike) => bike.option === requestedBike);
  if (exactPrice) {
    return {
      weekdayPriceCents: exactPrice.weekdayPriceCents,
      weekendPriceCents: exactPrice.weekendPriceCents,
    };
  }
  const model = requestedBike.split(" - ")[0];
  const modelPrice = inventory.bikePrices.find((bike) => bike.option === model);
  if (!modelPrice) return undefined;
  return {
    weekdayPriceCents: modelPrice.weekdayPriceCents,
    weekendPriceCents: modelPrice.weekendPriceCents,
  };
}

export function getDailyBikePriceCents(
  inventory: {
    bikePrices: Array<{
      option: string;
      weekdayPriceCents: number;
      weekendPriceCents: number;
    }>;
  },
  requestedBike: string,
  date?: string,
) {
  const schedule = getBikePriceScheduleCents(inventory, requestedBike);
  if (!schedule) return undefined;
  return date === undefined ? schedule.weekdayPriceCents : priceForDate(schedule, parseDateOnly(date));
}

function getBikeSchedule(input: BikePriceScheduleInput): BikePriceSchedule {
  return {
    weekdayPriceCents: input.weekdayPriceCents,
    weekendPriceCents: input.weekendPriceCents,
  };
}

export function calculateEquipmentSubtotalCents(
  inventory: { equipmentPrices: Array<{ key: string; priceCents: number }> },
  items: EquipmentPriceSelection[],
) {
  const prices = new Map(inventory.equipmentPrices.map((item) => [item.key, item.priceCents]));
  return items.reduce((total, item) => {
    const pedalType = normalizePedalType(item.pedalType);
    const computerMountType = normalizeComputerMountType(item.computerMountType);
    return (
      total +
      (item.needsPedals && pedalType ? (prices.get(`pedal-${pedalType}`) ?? 0) : 0) +
      (item.needsComputerMount && computerMountType ? (prices.get(`mount-${computerMountType}`) ?? 0) : 0) +
      (item.needsHelmet ? (prices.get("helmet") ?? 0) : 0) +
      (item.needsClothing ? (prices.get("clothing") ?? 0) : 0) +
      (item.needsBikepackingBag ? (prices.get("bikepacking-bag") ?? 0) : 0) +
      (item.needsGlasses ? (prices.get("glasses") ?? 0) : 0)
    );
  }, 0);
}

function priceForDate(schedule: BikePriceSchedule, date: Date) {
  const weekday = date.getUTCDay();
  return weekday === 0 || weekday === 6 ? schedule.weekendPriceCents : schedule.weekdayPriceCents;
}

function getApplicableDiscounts(
  inventory: DiscountInventory,
  input: { rentalDays: number; isStudent?: boolean },
  date: Date,
  rentalDay: number,
) {
  const weekday = date.getUTCDay() || 7;
  const applicable = inventory.discounts.filter((discount) => {
    if (discount.requiresStudent && !input.isStudent) return false;
    if (discount.minimumRentalDays !== null && input.rentalDays < discount.minimumRentalDays) return false;
    // A duration discount configured as “from 3 days” starts on day 4.
    // Discounts without a duration threshold, such as the student discount,
    // apply to every rental day.
    if (discount.minimumRentalDays !== null && rentalDay <= discount.minimumRentalDays) return false;
    if (
      discount.weekdayFrom !== null &&
      discount.weekdayTo !== null &&
      (weekday < discount.weekdayFrom || weekday > discount.weekdayTo)
    )
      return false;
    return true;
  });
  const exclusive = applicable
    .filter((discount) => !discount.isStackable)
    .sort((left, right) => right.percentage - left.percentage)[0];
  const stackablePercentage = applicable
    .filter((discount) => discount.isStackable)
    .reduce((total, discount) => total + discount.percentage, 0);
  const discountPercentage = Math.min(
    MAX_DAILY_DISCOUNT_PERCENTAGE,
    (exclusive?.percentage ?? 0) + stackablePercentage,
  );

  return {
    discountPercentage,
    appliedDiscountKeys: applicable
      .filter((discount) => discount.isStackable || discount.key === exclusive?.key)
      .map((discount) => discount.key),
  };
}

/**
 * Canonical rental price calculation used by estimates, offers, manual
 * bookings and invoices. Prices are calculated per bike and per calendar day
 * so weekday/weekend rates and daily discount caps remain transparent.
 */
export function calculatePrice(inventory: DiscountInventory, input: CentralPriceInput): RentalPriceCalculation {
  const pickupDate = parseDateOnly(input.periodFrom);
  const bikeBreakdown = input.bikes.map((_, bikeIndex) => ({
    bikeIndex,
    baseCents: 0,
    discountCents: 0,
    totalCents: 0,
  }));
  const dailyBreakdown: DailyPriceBreakdown[] = [];
  const appliedDiscountKeys = new Set<string>();

  for (let dayOffset = 0; dayOffset < input.rentalDays; dayOffset += 1) {
    const date = new Date(pickupDate.getTime() + dayOffset * 86_400_000);
    const rentalDay = dayOffset + 1;
    const discount = getApplicableDiscounts(inventory, input, date, rentalDay);
    const dateValue = berlinDateKey(date);
    let baseCents = 0;
    let discountCents = 0;

    input.bikes.forEach((bike, bikeIndex) => {
      const dailyBaseCents = priceForDate(getBikeSchedule(bike), date);
      const dailyDiscountCents = Math.round((dailyBaseCents * discount.discountPercentage) / 100);
      baseCents += dailyBaseCents;
      discountCents += dailyDiscountCents;
      bikeBreakdown[bikeIndex].baseCents += dailyBaseCents;
      bikeBreakdown[bikeIndex].discountCents += dailyDiscountCents;
      bikeBreakdown[bikeIndex].totalCents += dailyBaseCents - dailyDiscountCents;
    });

    discount.appliedDiscountKeys.forEach((key) => appliedDiscountKeys.add(key));
    dailyBreakdown.push({
      date: dateValue,
      rentalDay,
      baseCents,
      discountPercentage: discount.discountPercentage,
      discountCents,
      totalCents: baseCents - discountCents,
      appliedDiscountKeys: discount.appliedDiscountKeys,
    });
  }

  const bikeSubtotalCents = bikeBreakdown.reduce((sum, bike) => sum + bike.baseCents, 0);
  const discountCents = bikeBreakdown.reduce((sum, bike) => sum + bike.discountCents, 0);
  const equipmentSubtotalCents = input.equipmentSubtotalCents ?? 0;
  return {
    rentalDays: input.rentalDays,
    bikeSubtotalCents,
    equipmentSubtotalCents,
    discountCents,
    totalCents: bikeSubtotalCents + equipmentSubtotalCents - discountCents,
    appliedDiscountKeys: [...appliedDiscountKeys],
    dailyBreakdown,
    bikeBreakdown,
  };
}

export function calculateBikeSubtotalCents(input: BikePriceScheduleInput & { periodFrom: string; rentalDays: number }) {
  return calculatePrice(
    { discounts: [] },
    { bikes: [input], periodFrom: input.periodFrom, rentalDays: input.rentalDays },
  ).bikeSubtotalCents;
}

/** Rental periods include both the pickup and return date. */
export function getRentalDays(periodFrom: string, periodTo: string) {
  const milliseconds = parseDateOnly(periodTo).getTime() - parseDateOnly(periodFrom).getTime();
  return Math.max(1, Math.round(milliseconds / 86_400_000) + 1);
}

export function calculateInquiryPrice(inventory: LocationInventory, payload: ContactInquiry): InquiryPrice {
  const rentalDays = getRentalDays(payload.periodFrom, payload.periodTo);
  const bikes = payload.bikes.map(
    (bike) =>
      getBikePriceScheduleCents(inventory, bike.bikeSize) ?? {
        weekdayPriceCents: 0,
        weekendPriceCents: 0,
      },
  );
  const equipmentSubtotalCents = calculateEquipmentSubtotalCents(inventory, payload.bikes);

  return calculatePrice(inventory, {
    bikes,
    equipmentSubtotalCents,
    periodFrom: payload.periodFrom,
    rentalDays,
  });
}
