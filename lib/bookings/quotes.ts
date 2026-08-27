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
import { calculateInquiryPrice, calculatePrice, getRentalDays } from "../inventory/pricing";
import { getLocationInventory } from "../inventory/repository";
import type { ContactInquiry } from "../inquiries/schemas";
import { normalizeComputerMountType, normalizePedalType } from "../inquiries/catalog";

import { BookingCommandError } from "./errors";
import { isHistoricalAssetSelectableForBooking } from "./historical-availability";

export type OfferQuote = {
  totalCents: number;
  /** Eligibility context needed when an accepted offer is recalculated later. */
  isStudent?: boolean;
  /** Set only when the sent offer uses an individually agreed total price. */
  calculatedTotalCents?: number;
  customPriceCents?: number;
  /** Standard total before an individually agreed price is applied. */
  standardTotalCents?: number;
  /** Additional saving created by an individually agreed lower price. */
  customDiscountCents?: number;
  /** Difference to the standard price when an individual price is higher. */
  customSurchargeCents?: number;
  bikeSubtotalCents: number;
  equipmentSubtotalCents: number;
  discountCents: number;
  rentalDays: number;
  appliedDiscountKeys: string[];
  bikePriceLines?: Array<{
    assetId: number;
    baseCents: number;
    discountCents: number;
    totalCents: number;
  }>;
  offeredItems: Array<{
    requestedItemId: number;
    requestedLabel: string;
    heightCm: number;
    assetId: number;
    assetName: string;
    frameNumber: string | null;
    weekdayPriceCents: number;
    weekendPriceCents: number;
    accessories: OfferAccessorySelection;
  }>;
};

/**
 * Reads the current two-rate snapshot format and, only for old persisted
 * offers, converts the former single daily rate into two equal rates.
 */
export function getOfferItemPriceSchedule(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const readCents = (key: string) =>
    typeof item[key] === "number" && Number.isSafeInteger(item[key]) && item[key] >= 0 ? item[key] : undefined;
  const legacyDailyPriceCents = readCents("dailyPriceCents");
  const weekdayPriceCents = readCents("weekdayPriceCents") ?? legacyDailyPriceCents;
  const weekendPriceCents = readCents("weekendPriceCents") ?? legacyDailyPriceCents;
  return weekdayPriceCents === undefined || weekendPriceCents === undefined
    ? undefined
    : { weekdayPriceCents, weekendPriceCents };
}

export function parseOfferQuoteSnapshot(value: string): Partial<OfferQuote> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new BookingCommandError("Der gespeicherte Angebotspreis ist beschädigt. Erstelle das Angebot bitte neu.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new BookingCommandError("Der gespeicherte Angebotspreis ist ungültig. Erstelle das Angebot bitte neu.");
  const snapshot = parsed as Partial<OfferQuote>;
  if (snapshot.offeredItems !== undefined && !Array.isArray(snapshot.offeredItems))
    throw new BookingCommandError(
      "Die gespeicherten Angebotspositionen sind ungültig. Erstelle das Angebot bitte neu.",
    );
  return snapshot;
}

export function tryParseOfferQuoteSnapshot(value: string) {
  try {
    return parseOfferQuoteSnapshot(value);
  } catch {
    return null;
  }
}

export function applyCustomOfferPrice(quote: OfferQuote, customTotalCents?: number) {
  if (customTotalCents === undefined) return quote;
  if (!Number.isSafeInteger(customTotalCents) || customTotalCents < 0)
    throw new BookingCommandError("Der individuelle Gesamtpreis muss ein gültiger Euro-Betrag sein.");
  const standardTotalCents = quote.standardTotalCents ?? quote.totalCents;
  const adjustmentCents = standardTotalCents - customTotalCents;
  return {
    ...quote,
    totalCents: customTotalCents,
    standardTotalCents,
    customDiscountCents: Math.max(0, adjustmentCents),
    customSurchargeCents: Math.max(0, -adjustmentCents),
    calculatedTotalCents: standardTotalCents,
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
  insuranceProtectionSelected?: boolean;
};

export function getAssetPriceSchedule(asset: { weekdayPriceCents: number; weekendPriceCents: number }) {
  return { weekdayPriceCents: asset.weekdayPriceCents, weekendPriceCents: asset.weekendPriceCents };
}

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
    pedalType: override?.needsPedals === false ? null : normalizePedalType(override?.pedalType ?? item.pedalType),
    needsComputerMount: override?.needsComputerMount ?? item.needsComputerMount,
    computerMountType:
      override?.needsComputerMount === false
        ? null
        : normalizeComputerMountType(override?.computerMountType ?? item.computerMountType),
    needsHelmet: override?.needsHelmet ?? item.needsHelmet,
    needsClothing: override?.needsClothing ?? item.needsClothing,
    needsBikepackingBag: override?.needsBikepackingBag ?? item.needsBikepackingBag,
    needsGlasses: override?.needsGlasses ?? item.needsGlasses,
    bottleHolderIncluded: override?.bottleHolderIncluded ?? item.bottleHolderIncluded,
    repairKitIncluded: override?.repairKitIncluded ?? item.repairKitIncluded,
    insuranceProtectionSelected: override?.insuranceProtectionSelected ?? item.insuranceProtectionSelected,
  };
}

/** Builds a non-reserving quote. Asset availability is checked again on send and confirmation. */
export function buildOfferQuote(
  db: AppDatabase,
  bookingId: number,
  assetsByRequestedItem: Record<number, number>,
  accessoriesByRequestedItem: Record<number, OfferAccessorySelection> = {},
  isStudent = false,
  periodOverride?: { periodFrom: string; periodTo: string },
): OfferQuote {
  const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking)
    throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
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
    throw new BookingCommandError(
      "Für jedes angefragte Fahrrad musst du genau ein eigenes verfügbares Fahrrad auswählen.",
    );
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
      !isHistoricalAssetSelectableForBooking(booking, {
        ...asset.asset,
        modelTitle: asset.modelTitle,
        size: asset.size,
      })
    )
      throw new BookingCommandError(
        "Mindestens eines der ausgewählten Fahrräder ist an diesem Standort nicht aktiv. Wähle ein anderes Fahrrad.",
      );
    const priceSchedule = getAssetPriceSchedule(asset.asset);
    return {
      requestedItemId: item.id,
      requestedLabel: item.requestedLabel,
      heightCm: item.heightCm,
      assetId,
      assetName: asset.asset.displayName,
      frameNumber: asset.asset.frameNumber,
      ...priceSchedule,
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
  const periodFrom = periodOverride?.periodFrom ?? booking.periodFrom;
  const periodTo = periodOverride?.periodTo ?? booking.periodTo;
  const rentalDays = getRentalDays(periodFrom, periodTo);
  const price = calculatePrice(getLocationInventory(db, booking.location), {
    bikes: offeredItems,
    equipmentSubtotalCents,
    periodFrom,
    rentalDays,
    isStudent,
  });
  return {
    totalCents: price.totalCents,
    isStudent,
    standardTotalCents: price.totalCents,
    bikeSubtotalCents: price.bikeSubtotalCents,
    equipmentSubtotalCents: price.equipmentSubtotalCents,
    discountCents: price.discountCents,
    rentalDays,
    appliedDiscountKeys: price.appliedDiscountKeys,
    bikePriceLines: offeredItems.map((item, index) => ({
      assetId: item.assetId,
      ...price.bikeBreakdown[index],
    })),
    offeredItems,
  };
}
