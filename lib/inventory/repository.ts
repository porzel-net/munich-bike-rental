import { asc, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { accessoryInventory, bikeModels, bikeVariants, rentalAssets, rentalLocationDiscounts } from "../db/schema";
import type { Locale, PortfolioItem } from "../home-content";
import { normalizeComputerMountType, normalizePedalType } from "../inquiries/catalog";

export type LocationInventory = {
  portfolioItems: PortfolioItem[];
  /** All catalog bikes that customers may ask about, including paused bikes. */
  requestBikeOptions: string[];
  /** Bikes currently eligible for internal availability checks. */
  bikeOptions: string[];
  bikePrices: Array<{
    option: string;
    weekdayPriceCents: number;
    weekendPriceCents: number;
  }>;
  bikeOptionQuantities: Record<string, number>;
  equipmentPrices: Array<{ key: string; priceCents: number }>;
  equipmentQuantities: Array<{ key: string; availableQuantity: number; quantityRelevant: boolean; state: string }>;
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
  minimumWeekendBikePriceCents: number;
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

const accessoryDisplayOrder = new Map(
  [
    "pedal-platform",
    "pedal-spdSl",
    "pedal-lookKeo2Max",
    "pedal-other",
    "mount-garmin",
    "mount-wahoo",
    "mount-other",
    "helmet",
    "clothing",
    "bikepacking-bag",
    "glasses",
    "bottle-holder",
    "repair-kit",
  ].map((key, index) => [key, index]),
);

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
  const bikeRows = db
    .select({ model: bikeModels, variant: bikeVariants, asset: rentalAssets })
    .from(rentalAssets)
    .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
    .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
    .where(eq(rentalAssets.location, location))
    .all();
  const activeBikes = bikeRows.filter(({ asset }) => asset.state === "active");
  const rowsByModel = new Map<number, typeof bikeRows>();
  for (const row of bikeRows) rowsByModel.set(row.model.id, [...(rowsByModel.get(row.model.id) ?? []), row]);
  const models = [...rowsByModel.values()].map(
    (rows) =>
      [...rows].sort(
        (left, right) =>
          Number(right.asset.state === "active") - Number(left.asset.state === "active") ||
          left.asset.weekdayPriceCents +
            left.asset.weekendPriceCents -
            (right.asset.weekdayPriceCents + right.asset.weekendPriceCents) ||
          left.asset.id - right.asset.id,
      )[0],
  );
  // The legacy-to-normalized migration can leave more than one internal model
  // row for the same public title. Portfolio cards represent model families,
  // not individual database rows, so prefer active models and collapse
  // duplicate titles before rendering the public catalog.
  const portfolioSource = activeBikes.length ? models.filter(({ asset }) => asset.state === "active") : models;
  const portfolioModels = new Map<string, (typeof models)[number]>();
  for (const row of portfolioSource) {
    const existing = portfolioModels.get(row.model.title);
    if (!existing || (existing.model.modelKey.startsWith("legacy-") && !row.model.modelKey.startsWith("legacy-"))) {
      portfolioModels.set(row.model.title, row);
    }
  }
  const modelTitles = new Set(models.map(({ model }) => model.title));
  const activeModelTitles = new Set(activeBikes.map(({ model }) => model.title));
  const allEquipment = db
    .select()
    .from(accessoryInventory)
    .where(eq(accessoryInventory.location, location))
    .orderBy(asc(accessoryInventory.category), asc(accessoryInventory.accessoryKey))
    .all();
  const equipment = allEquipment
    .sort(
      (left, right) =>
        (accessoryDisplayOrder.get(left.accessoryKey) ?? Number.MAX_SAFE_INTEGER) -
          (accessoryDisplayOrder.get(right.accessoryKey) ?? Number.MAX_SAFE_INTEGER) ||
        left.accessoryKey.localeCompare(right.accessoryKey),
    )
    .filter((item) => item.state === "active" && (!item.quantityRelevant || item.availableQuantity > 0));
  const discounts = db
    .select()
    .from(rentalLocationDiscounts)
    .where(eq(rentalLocationDiscounts.location, location))
    .orderBy(asc(rentalLocationDiscounts.displayOrder))
    .all()
    .filter((item) => item.isAvailable);
  const bikeVariantOptions = [...new Set(bikeRows.map(({ model, variant }) => `${model.title} - ${variant.size}`))];
  // Customers choose the bike model only. Frame size is selected internally
  // later based on the customer's height and the available assets.
  const requestBikeOptions = [...modelTitles];
  const bikeOptions = [...activeModelTitles];
  // Public inquiries may name paused bikes so they remain trackable. Concrete
  // asset selection in the admin still uses only active assets.
  const bikePricesByOption = new Map<string, LocationInventory["bikePrices"][number]>();
  const pickPriceRow = (rows: typeof bikeRows) =>
    [...rows].sort(
      (left, right) =>
        left.asset.weekdayPriceCents +
          left.asset.weekendPriceCents -
          (right.asset.weekdayPriceCents + right.asset.weekendPriceCents) || left.asset.id - right.asset.id,
    )[0];
  for (const rows of rowsByModel.values()) {
    const model = rows[0]?.model;
    if (!model) continue;
    const modelRows = rows.some(({ asset }) => asset.state === "active")
      ? rows.filter(({ asset }) => asset.state === "active")
      : rows;
    const modelPriceRow = pickPriceRow(modelRows);
    if (modelPriceRow) {
      bikePricesByOption.set(model.title, {
        option: model.title,
        weekdayPriceCents: modelPriceRow.asset.weekdayPriceCents,
        weekendPriceCents: modelPriceRow.asset.weekendPriceCents,
      });
    }
    const variantRows = new Map<string, typeof bikeRows>();
    for (const row of modelRows) variantRows.set(row.variant.size, [...(variantRows.get(row.variant.size) ?? []), row]);
    for (const [size, sizeRows] of variantRows) {
      const priceRow = pickPriceRow(sizeRows);
      if (!priceRow) continue;
      bikePricesByOption.set(`${model.title} - ${size}`, {
        option: `${model.title} - ${size}`,
        weekdayPriceCents: priceRow.asset.weekdayPriceCents,
        weekendPriceCents: priceRow.asset.weekendPriceCents,
      });
    }
  }
  const bikePrices = [...bikePricesByOption.values()];
  const bikeOptionQuantities: Record<string, number> = {};
  for (const { model, variant } of activeBikes) {
    const variantOption = `${model.title} - ${variant.size}`;
    bikeOptionQuantities[model.title] = (bikeOptionQuantities[model.title] ?? 0) + 1;
    bikeOptionQuantities[variantOption] = (bikeOptionQuantities[variantOption] ?? 0) + 1;
  }
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
    portfolioItems: [...portfolioModels.values()].map(({ model, asset }) => ({
      title: model.title,
      frameNumber: asset.frameNumber,
      subtitle: {
        de: bikeSizes(model.title),
        en: bikeSizes(model.title),
      },
      weekdayPrice: {
        de: `Mo-Fr: ${(asset.weekdayPriceCents / 100).toFixed(0)}€/Tag`,
        en: `Mon-Fri: ${(asset.weekdayPriceCents / 100).toFixed(0)}€/day`,
      },
      weekendPrice: {
        de: `Sa-So: ${(asset.weekendPriceCents / 100).toFixed(0)}€/Tag`,
        en: `Sat-Sun: ${(asset.weekendPriceCents / 100).toFixed(0)}€/day`,
      },
      description: { de: model.descriptionDe, en: model.descriptionEn },
      image: optimizeBikeMediaPath(model.image),
      gallery: parseGallery(model.galleryJson).map(optimizeBikeMediaPath),
      facts: parseFacts(model.factsJson),
      equipment: parseEquipment(model.equipmentJson),
    })),
    requestBikeOptions,
    bikeOptions,
    bikePrices,
    bikeOptionQuantities,
    equipmentPrices: equipment.map((item) => ({ key: item.accessoryKey, priceCents: item.priceCents })),
    equipmentQuantities: allEquipment.map((item) => ({
      key: item.accessoryKey,
      availableQuantity: item.availableQuantity,
      quantityRelevant: item.quantityRelevant,
      state: item.state,
    })),
    pedalTypes: optionList("pedal", "pedal-"),
    computerMountTypes: optionList("computer-mount", "mount-"),
    helmetAvailable: equipment.some((item) => item.accessoryKey === "helmet"),
    clothingAvailable: equipment.some((item) => item.accessoryKey === "clothing"),
    bikepackingBagAvailable: equipment.some((item) => item.accessoryKey === "bikepacking-bag"),
    glassesAvailable: equipment.some((item) => item.accessoryKey === "glasses"),
    bottleHolderIncluded: equipment.some((item) => item.accessoryKey === "bottle-holder"),
    repairKitIncluded: equipment.some((item) => item.accessoryKey === "repair-kit"),
    accessoryFromCents: equipment.length ? Math.min(...equipment.map((item) => item.priceCents)) : 0,
    minimumBikePriceCents: bikeRows.length ? Math.min(...bikeRows.map(({ asset }) => asset.weekdayPriceCents)) : 0,
    minimumWeekendBikePriceCents: bikeRows.length
      ? Math.min(...bikeRows.map(({ asset }) => asset.weekendPriceCents))
      : 0,
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
    needsBikepackingBag?: boolean;
    needsGlasses?: boolean;
  }>,
) {
  const inventory = getLocationInventory(db, location);
  const pedals = new Set(inventory.pedalTypes.map((item) => item.value));
  const mounts = new Set(inventory.computerMountTypes.map((item) => item.value));
  const bikeCounts = new Map<string, number>();
  const accessoryCounts = new Map<string, number>();
  for (const bike of bikes) {
    const bikeOption = inventory.bikeOptionQuantities[bike.bikeSize]
      ? bike.bikeSize
      : inventory.bikeOptionQuantities[bike.bikeSize.split(" - ")[0]]
        ? bike.bikeSize.split(" - ")[0]
        : null;
    if (bikeOption) bikeCounts.set(bikeOption, (bikeCounts.get(bikeOption) ?? 0) + 1);
    const addAccessory = (key: string, requested: boolean) => {
      if (requested) accessoryCounts.set(key, (accessoryCounts.get(key) ?? 0) + 1);
    };
    addAccessory(`pedal-${normalizePedalType(bike.pedalType) ?? ""}`, bike.needsPedals);
    addAccessory(`mount-${normalizeComputerMountType(bike.computerMountType) ?? ""}`, bike.needsComputerMount);
    addAccessory("helmet", bike.needsHelmet);
    addAccessory("clothing", bike.needsClothing);
    addAccessory("bikepacking-bag", bike.needsBikepackingBag ?? false);
    addAccessory("glasses", bike.needsGlasses ?? false);
  }
  if ([...bikeCounts].some(([option, count]) => (inventory.bikeOptionQuantities[option] ?? 0) < count)) return false;
  const equipmentByKey = new Map(inventory.equipmentQuantities.map((item) => [item.key, item]));
  if (
    [...accessoryCounts].some(([key, count]) => {
      const item = equipmentByKey.get(key);
      return !item || item.state !== "active" || (item.quantityRelevant && item.availableQuantity < count);
    })
  )
    return false;
  return bikes.every(
    (bike) =>
      Boolean(
        inventory.bikeOptionQuantities[bike.bikeSize] ?? inventory.bikeOptionQuantities[bike.bikeSize.split(" - ")[0]],
      ) &&
      (!bike.needsPedals || pedals.has(normalizePedalType(bike.pedalType) ?? "")) &&
      (!bike.needsComputerMount || mounts.has(normalizeComputerMountType(bike.computerMountType) ?? "")) &&
      (!bike.needsHelmet || inventory.helmetAvailable) &&
      (!bike.needsClothing || inventory.clothingAvailable),
  );
}
