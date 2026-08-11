import { and, asc, eq, inArray } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  rentalLocationBikeSizes,
  rentalLocationBikes,
  rentalLocationDiscounts,
  rentalLocationEquipment,
} from "../db/schema";
import type { Locale, PortfolioItem } from "../home-content";

export type LocationInventory = {
  portfolioItems: PortfolioItem[];
  bikeOptions: string[];
  bikePrices: Array<{ option: string; dailyPriceCents: number }>;
  equipmentPrices: Array<{ key: string; priceCents: number }>;
  pedalTypes: Array<{ value: string; label: Record<Locale, string>; priceCents: number }>;
  computerMountTypes: Array<{ value: string; label: Record<Locale, string>; priceCents: number }>;
  helmetAvailable: boolean;
  clothingAvailable: boolean;
  bikepackingBagAvailable: boolean;
  glassesAvailable: boolean;
  bottleHolderIncluded: boolean;
  repairKitIncluded: boolean;
  accessoryFromCents: number;
  minimumBikePriceCents: number;
  discounts: Array<{
    key: string;
    label: Record<Locale, string>;
    percentage: number;
    weekdayFrom: number | null;
    weekdayTo: number | null;
    minimumRentalDays: number | null;
    requiresStudent: boolean;
    isStackable: boolean;
  }>;
};

function localizedText(value: unknown): value is { de: string; en: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { de?: unknown }).de === "string" &&
    typeof (value as { en?: unknown }).en === "string"
  );
}

function parseGallery(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function parseFacts(value: string): PortfolioItem["facts"] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PortfolioItem["facts"][number] =>
        typeof item === "object" &&
        item !== null &&
        localizedText((item as { label?: unknown }).label) &&
        localizedText((item as { value?: unknown }).value),
    );
  } catch {
    return [];
  }
}

function parseEquipment(value: string): PortfolioItem["equipment"] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as { de?: unknown }).de) ||
      !Array.isArray((parsed as { en?: unknown }).en)
    )
      return { de: [], en: [] };
    const de = (parsed as { de: unknown[] }).de.filter((item): item is string => typeof item === "string");
    const en = (parsed as { en: unknown[] }).en.filter((item): item is string => typeof item === "string");
    return { de, en };
  } catch {
    return { de: [], en: [] };
  }
}

export function getLocationInventory(db: AppDatabase, location: string): LocationInventory {
  const bikes = db
    .select()
    .from(rentalLocationBikes)
    .where(eq(rentalLocationBikes.location, location))
    .orderBy(asc(rentalLocationBikes.displayOrder))
    .all()
    .filter((bike) => bike.isAvailable);
  const sizes = bikes.length
    ? db
        .select()
        .from(rentalLocationBikeSizes)
        .where(
          and(
            inArray(
              rentalLocationBikeSizes.locationBikeId,
              bikes.map((bike) => bike.id),
            ),
            eq(rentalLocationBikeSizes.isAvailable, true),
          ),
        )
        .all()
    : [];
  const equipment = db
    .select()
    .from(rentalLocationEquipment)
    .where(eq(rentalLocationEquipment.location, location))
    .orderBy(asc(rentalLocationEquipment.displayOrder))
    .all()
    .filter((item) => item.isAvailable);
  const discounts = db
    .select()
    .from(rentalLocationDiscounts)
    .where(eq(rentalLocationDiscounts.location, location))
    .orderBy(asc(rentalLocationDiscounts.displayOrder))
    .all()
    .filter((item) => item.isAvailable);
  const bikeVariantOptions = bikes.flatMap((bike) =>
    sizes.filter((size) => size.locationBikeId === bike.id).map((size) => `${bike.title} - ${size.size}`),
  );
  // Customers choose the bike model only. Frame size is selected internally
  // later based on the customer's height and the available assets.
  const bikeOptions = [...new Set(bikes.map((bike) => bike.title))];
  const bikePrices = bikes.map((bike) => ({ option: bike.title, dailyPriceCents: bike.priceCentsPerDay }));
  const portfolioBikes = [...new Map(bikes.map((bike) => [bike.title, bike])).values()];
  const optionList = (category: string, prefix: string) =>
    equipment
      .filter((item) => item.category === category)
      .map((item) => ({
        value: item.equipmentKey.slice(prefix.length),
        label: { de: item.labelDe, en: item.labelEn },
        priceCents: item.priceCents,
      }));

  return {
    portfolioItems: portfolioBikes.map((bike) => ({
      title: bike.title,
      frameNumber: bike.frameNumber,
      subtitle: {
        de: bikeVariantOptions
          .filter((option) => option.startsWith(bike.title + " - "))
          .map((option) => option.slice(bike.title.length + 3))
          .join(" / "),
        en: bikeVariantOptions
          .filter((option) => option.startsWith(bike.title + " - "))
          .map((option) => option.slice(bike.title.length + 3))
          .join(" / "),
      },
      price: {
        de: `${(bike.priceCentsPerDay / 100).toFixed(0)}€/Tag`,
        en: `${(bike.priceCentsPerDay / 100).toFixed(0)}€/day`,
      },
      discountText: {
        de:
          bikes.find((candidate) => candidate.title === bike.title && candidate.discountTextDe.trim())
            ?.discountTextDe ?? "",
        en:
          bikes.find((candidate) => candidate.title === bike.title && candidate.discountTextEn.trim())
            ?.discountTextEn ?? "",
      },
      description: { de: bike.descriptionDe, en: bike.descriptionEn },
      image: bike.image,
      gallery: parseGallery(bike.galleryJson),
      facts: parseFacts(bike.factsJson),
      equipment: parseEquipment(bike.equipmentJson),
    })),
    bikeOptions,
    bikePrices,
    equipmentPrices: equipment.map((item) => ({ key: item.equipmentKey, priceCents: item.priceCents })),
    pedalTypes: optionList("pedal", "pedal-"),
    computerMountTypes: optionList("computer-mount", "mount-"),
    helmetAvailable: equipment.some((item) => item.equipmentKey === "helmet"),
    clothingAvailable: equipment.some((item) => item.equipmentKey === "clothing"),
    bikepackingBagAvailable: equipment.some((item) => item.equipmentKey === "bikepacking-bag"),
    glassesAvailable: equipment.some((item) => item.equipmentKey === "glasses"),
    bottleHolderIncluded: equipment.some((item) => item.equipmentKey === "bottle-holder"),
    repairKitIncluded: equipment.some((item) => item.equipmentKey === "repair-kit"),
    accessoryFromCents: equipment.filter((item) => item.priceCents > 0).length
      ? Math.min(...equipment.filter((item) => item.priceCents > 0).map((item) => item.priceCents))
      : 0,
    minimumBikePriceCents: bikes.length ? Math.min(...bikes.map((item) => item.priceCentsPerDay)) : 0,
    discounts: discounts.map((discount) => ({
      key: discount.discountKey,
      label: { de: discount.labelDe, en: discount.labelEn },
      percentage: discount.percentage,
      weekdayFrom: discount.weekdayFrom,
      weekdayTo: discount.weekdayTo,
      minimumRentalDays: discount.minimumRentalDays,
      requiresStudent: discount.requiresStudent,
      isStackable: discount.isStackable,
    })),
  };
}

export function isRequestAvailable(
  db: AppDatabase,
  location: string,
  bikes: Array<{
    bikeSize: string;
    needsPedals: boolean;
    pedalType: string;
    needsComputerMount: boolean;
    computerMountType: string;
    needsHelmet: boolean;
    needsClothing: boolean;
  }>,
) {
  const inventory = getLocationInventory(db, location);
  const pedals = new Set(inventory.pedalTypes.map((item) => item.value));
  const mounts = new Set(inventory.computerMountTypes.map((item) => item.value));
  return bikes.every(
    (bike) =>
      (inventory.bikeOptions.includes(bike.bikeSize) ||
        inventory.bikeOptions.some((option) => bike.bikeSize.startsWith(option + " - "))) &&
      (!bike.needsPedals || pedals.has(bike.pedalType)) &&
      (!bike.needsComputerMount || mounts.has(bike.computerMountType)) &&
      (!bike.needsHelmet || inventory.helmetAvailable) &&
      (!bike.needsClothing || inventory.clothingAvailable),
  );
}
