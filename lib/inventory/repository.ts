import { and, asc, eq, inArray } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  rentalLocationBikeSizes,
  rentalLocationBikes,
  rentalLocationDiscounts,
  accessoryInventory,
  rentalLocationEquipment,
} from "../db/schema";
import type { Locale, PortfolioItem } from "../home-content";
import { normalizeComputerMountType, normalizePedalType } from "../inquiries/catalog";

export type LocationInventory = {
  portfolioItems: PortfolioItem[];
  /** All catalog bikes that customers may ask about, including paused bikes. */
  requestBikeOptions: string[];
  /** Bikes currently eligible for internal availability checks. */
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

const optimizedBikeMedia: Record<string, string> = {
  "/bikes/aeroad-cf-sl-8-disc/preview.png": "/bikes/aeroad-cf-sl-8-disc/preview.webp",
  "/bikes/aeroad-cf-sl-8-disc/real1.png": "/bikes/aeroad-cf-sl-8-disc/real1.webp",
  "/bikes/aeroad-cf-sl-8-disc/real2.png": "/bikes/aeroad-cf-sl-8-disc/real2.webp",
  "/bikes/aeroad-cf-sl-8-disc/real3.png": "/bikes/aeroad-cf-sl-8-disc/real3.webp",
  "/bikes/aeroad-cf-sl-8-disc/real4.png": "/bikes/aeroad-cf-sl-8-disc/real4.webp",
  "/bikes/endurace-cf-sl-8-di2/preview.png": "/bikes/endurace-cf-sl-8-di2/preview.webp",
  "/bikes/endurace-cf-sl-8-di2/real1.png": "/bikes/endurace-cf-sl-8-di2/real1.webp",
  "/bikes/endurace-cf-sl-8-di2/real2.png": "/bikes/endurace-cf-sl-8-di2/real2.webp",
  "/bikes/ultimate-cf-sl-7eTap-axs/preview.png": "/bikes/ultimate-cf-sl-7eTap-axs/preview.webp",
  "/bikes/ultimate-cf-sl-7eTap-axs/real1.png": "/bikes/ultimate-cf-sl-7eTap-axs/real1.webp",
  "/bikes/ultimate-cf-sl-7eTap-axs/real2.png": "/bikes/ultimate-cf-sl-7eTap-axs/real2.webp",
  "/bikes/ultimate-cf-sl-7eTap-axs/real3.png": "/bikes/ultimate-cf-sl-7eTap-axs/real3.webp",
};

const bikeSizeOrder = new Map(
  ["3XS", "2XS", "XS", "S", "M", "L", "XL", "2XL", "XXL"].map((size, index) => [size, index]),
);

function sortBikeSizes(sizes: string[]) {
  return [...new Set(sizes)].sort((left, right) => {
    const leftIndex = bikeSizeOrder.get(left.trim().toUpperCase());
    const rightIndex = bikeSizeOrder.get(right.trim().toUpperCase());

    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  });
}

function optimizeBikeMediaPath(path: string) {
  return optimizedBikeMedia[path] ?? path;
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
    .all();
  const activeBikes = bikes.filter((bike) => bike.isAvailable);
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
    .select({ item: accessoryInventory })
    .from(accessoryInventory)
    .leftJoin(rentalLocationEquipment, eq(accessoryInventory.legacyEquipmentId, rentalLocationEquipment.id))
    .where(eq(accessoryInventory.location, location))
    .orderBy(asc(rentalLocationEquipment.displayOrder), asc(accessoryInventory.accessoryKey))
    .all()
    .map(({ item }) => item)
    .filter((item) => item.state === "active" && (!item.quantityRelevant || item.availableQuantity > 0));
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
  const requestBikeOptions = [...new Set(bikes.map((bike) => bike.title))];
  const bikeOptions = [...new Set(activeBikes.map((bike) => bike.title))];
  // Public inquiries may name paused bikes so they remain trackable. Concrete
  // asset selection in the admin still uses only active assets.
  const bikePrices = [...new Map(bikes.map((bike) => [bike.title, bike.priceCentsPerDay])).entries()].map(
    ([option, dailyPriceCents]) => ({ option, dailyPriceCents }),
  );
  const portfolioBikes = [...new Map(bikes.map((bike) => [bike.title, bike])).values()];
  const bikeSizes = (title: string) =>
    sortBikeSizes(
      bikeVariantOptions
        .filter((option) => option.startsWith(title + " - "))
        .map((option) => option.slice(title.length + 3)),
    ).join(" / ");
  const optionList = (category: string, prefix: string) =>
    equipment
      .filter((item) => item.category === category)
      .map((item) => ({
        value: item.accessoryKey.slice(prefix.length),
        label: { de: item.labelDe, en: item.labelEn },
        priceCents: item.priceCents,
      }));

  return {
    portfolioItems: portfolioBikes.map((bike) => ({
      title: bike.title,
      frameNumber: bike.frameNumber,
      subtitle: {
        de: bikeSizes(bike.title),
        en: bikeSizes(bike.title),
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
      image: optimizeBikeMediaPath(bike.image),
      gallery: parseGallery(bike.galleryJson).map(optimizeBikeMediaPath),
      facts: parseFacts(bike.factsJson),
      equipment: parseEquipment(bike.equipmentJson),
    })),
    requestBikeOptions,
    bikeOptions,
    bikePrices,
    equipmentPrices: equipment.map((item) => ({ key: item.accessoryKey, priceCents: item.priceCents })),
    pedalTypes: optionList("pedal", "pedal-"),
    computerMountTypes: optionList("computer-mount", "mount-"),
    helmetAvailable: equipment.some((item) => item.accessoryKey === "helmet"),
    clothingAvailable: equipment.some((item) => item.accessoryKey === "clothing"),
    bikepackingBagAvailable: equipment.some((item) => item.accessoryKey === "bikepacking-bag"),
    glassesAvailable: equipment.some((item) => item.accessoryKey === "glasses"),
    bottleHolderIncluded: equipment.some((item) => item.accessoryKey === "bottle-holder"),
    repairKitIncluded: equipment.some((item) => item.accessoryKey === "repair-kit"),
    accessoryFromCents: equipment.length ? Math.min(...equipment.map((item) => item.priceCents)) : 0,
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
      (!bike.needsPedals || pedals.has(normalizePedalType(bike.pedalType) ?? "")) &&
      (!bike.needsComputerMount || mounts.has(normalizeComputerMountType(bike.computerMountType) ?? "")) &&
      (!bike.needsHelmet || inventory.helmetAvailable) &&
      (!bike.needsClothing || inventory.clothingAvailable),
  );
}
