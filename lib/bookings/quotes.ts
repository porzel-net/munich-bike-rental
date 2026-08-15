import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  accessoryInventory,
  bikeModels,
  bikeVariants,
  bookingRequestedItems,
  bookings,
  rentalAssets,
} from "../db/schema";
import { calculateBikePriceWithDiscounts, calculateInquiryPrice, getRentalDays } from "../inventory/pricing";
import { getLocationInventory } from "../inventory/repository";
import type { ContactInquiry } from "../inquiries/schemas";

import { BookingCommandError } from "./errors";
import { isAssetSelectableForBooking } from "./historical-availability";

export type OfferQuote = {
  totalCents: number;
  /** Set only when the sent offer uses an individually agreed total price. */
  calculatedTotalCents?: number;
  customPriceCents?: number;
  bikeSubtotalCents: number;
  equipmentSubtotalCents: number;
  discountCents: number;
  rentalDays: number;
  appliedDiscountKeys: string[];
  offeredItems: Array<{
    requestedItemId: number;
    requestedLabel: string;
    heightCm: number;
    assetId: number;
    assetName: string;
    frameNumber: string | null;
    dailyPriceCents: number;
    accessories: OfferAccessorySelection;
  }>;
};

export function applyCustomOfferPrice(quote: OfferQuote, customTotalCents?: number) {
  if (customTotalCents === undefined) return quote;
  if (!Number.isSafeInteger(customTotalCents) || customTotalCents < 0)
    throw new BookingCommandError("Der individuelle Gesamtpreis muss ein gültiger Euro-Betrag sein.");
  return {
    ...quote,
    totalCents: customTotalCents,
    calculatedTotalCents: quote.totalCents,
    customPriceCents: customTotalCents,
  };
}

export type OfferAccessorySelection = {
  needsPedals: boolean;
  pedalType: string | null;
  needsComputerMount: boolean;
  computerMountType: string | null;
  needsHelmet: boolean;
  needsClothing: boolean;
  needsBikepackingBag?: boolean;
  needsGlasses?: boolean;
  bottleHolderIncluded?: boolean;
  repairKitIncluded?: boolean;
};

/** Public requests are always accepted; this is only their initial, non-binding estimate. */
export function estimateInquiryQuote(db: AppDatabase, input: ContactInquiry) {
  return calculateInquiryPrice(getLocationInventory(db, input.location), input);
}

function requestedAccessoryKeys(item: OfferAccessorySelection) {
  return [
    item.needsPedals && item.pedalType ? `pedal-${item.pedalType}` : null,
    item.needsComputerMount && item.computerMountType ? `mount-${item.computerMountType}` : null,
    item.needsHelmet ? "helmet" : null,
    item.needsClothing ? "clothing" : null,
    item.needsBikepackingBag ? "bikepacking-bag" : null,
    item.needsGlasses ? "glasses" : null,
  ].filter((key): key is string => Boolean(key));
}

function selectedAccessories(
  item: typeof bookingRequestedItems.$inferSelect,
  override?: OfferAccessorySelection,
): OfferAccessorySelection {
  return {
    needsPedals: override?.needsPedals ?? item.needsPedals,
    pedalType: override?.needsPedals === false ? null : (override?.pedalType ?? item.pedalType),
    needsComputerMount: override?.needsComputerMount ?? item.needsComputerMount,
    computerMountType:
      override?.needsComputerMount === false ? null : (override?.computerMountType ?? item.computerMountType),
    needsHelmet: override?.needsHelmet ?? item.needsHelmet,
    needsClothing: override?.needsClothing ?? item.needsClothing,
    needsBikepackingBag: override?.needsBikepackingBag ?? item.needsBikepackingBag,
    needsGlasses: override?.needsGlasses ?? item.needsGlasses,
    bottleHolderIncluded: override?.bottleHolderIncluded ?? item.bottleHolderIncluded,
    repairKitIncluded: override?.repairKitIncluded ?? item.repairKitIncluded,
  };
}

/** Builds a non-reserving quote. Asset availability is checked again on send and confirmation. */
export function buildOfferQuote(
  db: AppDatabase,
  bookingId: number,
  assetsByRequestedItem: Record<number, number>,
  accessoriesByRequestedItem: Record<number, OfferAccessorySelection> = {},
  isStudent = false,
): OfferQuote {
  const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking) throw new BookingCommandError("Booking not found");
  const requested = db
    .select()
    .from(bookingRequestedItems)
    .where(eq(bookingRequestedItems.bookingId, booking.id))
    .all();
  const selectedIds = Object.keys(assetsByRequestedItem).map(Number);
  if (
    requested.length !== selectedIds.length ||
    requested.some((item) => !selectedIds.includes(item.id)) ||
    new Set(Object.values(assetsByRequestedItem)).size !== selectedIds.length
  ) {
    throw new BookingCommandError("An offer must select one distinct concrete asset for every requested bike");
  }
  const offeredItems = requested.map((item) => {
    const assetId = assetsByRequestedItem[item.id];
    const asset = db
      .select({ asset: rentalAssets, modelTitle: bikeModels.title, size: bikeVariants.size })
      .from(rentalAssets)
      .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
      .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
      .where(and(eq(rentalAssets.id, assetId), eq(rentalAssets.location, booking.location)))
      .get();
    if (
      !asset ||
      !isAssetSelectableForBooking(booking, { ...asset.asset, modelTitle: asset.modelTitle, size: asset.size })
    )
      throw new BookingCommandError("The selected asset is not active at this location");
    return {
      requestedItemId: item.id,
      requestedLabel: item.requestedLabel,
      heightCm: item.heightCm,
      assetId,
      assetName: asset.asset.displayName,
      frameNumber: asset.asset.frameNumber,
      dailyPriceCents: asset.asset.dailyPriceCents,
      accessories: selectedAccessories(item, accessoriesByRequestedItem[item.id]),
    };
  });
  const accessories = db
    .select()
    .from(accessoryInventory)
    .where(and(eq(accessoryInventory.location, booking.location), eq(accessoryInventory.state, "active")))
    .all();
  const accessoryPrices = new Map(accessories.map((item) => [item.accessoryKey, item.priceCents]));
  const equipmentSubtotalCents = requested
    .map((item) => selectedAccessories(item, accessoriesByRequestedItem[item.id]))
    .flatMap(requestedAccessoryKeys)
    .reduce((sum, key) => sum + (accessoryPrices.get(key) ?? 0), 0);
  const rentalDays = getRentalDays(booking.periodFrom, booking.periodTo);
  const dailyBikePriceCents = offeredItems.reduce((sum, item) => sum + item.dailyPriceCents, 0);
  const { discountCents, appliedDiscountKeys } = calculateBikePriceWithDiscounts(
    getLocationInventory(db, booking.location),
    { dailyBikePriceCents, periodFrom: booking.periodFrom, rentalDays, isStudent },
  );
  const bikeSubtotalCents = dailyBikePriceCents * rentalDays;
  return {
    totalCents: bikeSubtotalCents + equipmentSubtotalCents - discountCents,
    bikeSubtotalCents,
    equipmentSubtotalCents,
    discountCents,
    rentalDays,
    appliedDiscountKeys,
    offeredItems,
  };
}
