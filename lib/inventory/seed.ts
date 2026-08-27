import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { bikeModels, bikeVariants, rentalAssets, accessoryInventory, rentalLocationDiscounts } from "../db/schema";
import { portfolioItems } from "../home-content";
import { bikeOptionsByLocation } from "./seed-catalog";

const locationPrices = {
  munich: { weekday: 4900, weekend: 6900 },
  regensburg: { weekday: 4900, weekend: 6900 },
  lindau: { weekday: 4900, weekend: 6900 },
  friedrichshafen: { weekday: 4900, weekend: 6900 },
  konstanz: { weekday: 4900, weekend: 6900 },
} as const;

const equipment = [
  ["pedal-platform", "pedal", "Plattformpedale", "Platform pedals", 500],
  ["pedal-spdSl", "pedal", "SPD-SL", "SPD-SL", 500],
  ["pedal-lookKeo2Max", "pedal", "Look Keo 2 Max", "Look Keo 2 Max", 500],
  ["pedal-other", "pedal", "Andere", "Other", 500],
  ["mount-garmin", "computer-mount", "Garmin", "Garmin", 500],
  ["mount-wahoo", "computer-mount", "Wahoo", "Wahoo", 500],
  ["mount-other", "computer-mount", "Andere", "Other", 500],
  ["helmet", "helmet", "Helm", "Helmet", 1_000],
  ["clothing", "clothing", "Kleidung", "Clothing", 1_500],
  ["bikepacking-bag", "bag", "Bikepackingtasche", "Bikepacking bag", 2_500],
  ["glasses", "glasses", "Rennradbrille", "Road cycling glasses", 500],
  ["bottle-holder", "bottle-holder", "Flaschenhalter", "Bottle holder", 0],
  ["repair-kit", "repair-kit", "Reparaturset", "Repair kit", 0],
] as const;

const discounts = [
  { discountKey: "long-term", labelDe: "Ab 3 Tagen", labelEn: "From 3 days", percentage: 15, minimumRentalDays: 3 },
  {
    discountKey: "student",
    labelDe: "Studentenrabatt",
    labelEn: "Student discount",
    percentage: 10,
    requiresStudent: true,
  },
] as const;

type InventoryDb = Omit<AppDatabase, "$client">;

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function imagePath(image: (typeof portfolioItems)[number]["image"]) {
  return typeof image === "string" ? image : image.src;
}

function getOrCreateModel(db: InventoryDb, location: string, title: string, createdAt: Date) {
  const modelKey = slug(title);
  const current = db
    .select({ id: bikeModels.id })
    .from(bikeModels)
    .where(and(eq(bikeModels.location, location), eq(bikeModels.modelKey, modelKey)))
    .get();
  if (current) return current.id;

  const content = portfolioItems.find((item) => item.title === title);
  if (!content) throw new Error(`Kein Katalogeintrag für ${title} gefunden`);
  return db
    .insert(bikeModels)
    .values({
      location,
      modelKey,
      title,
      descriptionDe: content.description.de,
      descriptionEn: content.description.en,
      image: imagePath(content.image),
      galleryJson: JSON.stringify(content.gallery.map(imagePath)),
      factsJson: JSON.stringify(content.facts),
      equipmentJson: JSON.stringify(content.equipment),
      createdAt,
    })
    .returning({ id: bikeModels.id })
    .get()!.id;
}

function getOrCreateVariant(db: InventoryDb, modelId: number, size: string, createdAt: Date) {
  const current = db
    .select({ id: bikeVariants.id })
    .from(bikeVariants)
    .where(and(eq(bikeVariants.modelId, modelId), eq(bikeVariants.size, size)))
    .get();
  if (current) return current.id;
  return db.insert(bikeVariants).values({ modelId, size, createdAt }).returning({ id: bikeVariants.id }).get()!.id;
}

function ensureBikeAssets(db: InventoryDb, location: string, offeredBikes: readonly string[], createdAt: Date) {
  const sizeOccurrences = new Map<string, number>();
  for (const option of offeredBikes) {
    const separator = option.lastIndexOf(" - ");
    const title = separator === -1 ? option : option.slice(0, separator);
    const size = separator === -1 ? "Standard" : option.slice(separator + 3);
    const occurrenceKey = `${title} - ${size}`;
    const occurrence = (sizeOccurrences.get(occurrenceKey) ?? 0) + 1;
    sizeOccurrences.set(occurrenceKey, occurrence);
    const modelId = getOrCreateModel(db, location, title, createdAt);
    const variantId = getOrCreateVariant(db, modelId, size, createdAt);
    const assetCode = `${location}-${slug(title)}-${slug(size)}-${occurrence}`;
    const existing = db
      .select({ id: rentalAssets.id })
      .from(rentalAssets)
      .where(and(eq(rentalAssets.location, location), eq(rentalAssets.assetCode, assetCode)))
      .get();
    if (existing) continue;

    const prices = locationPrices[location as keyof typeof locationPrices];
    db.insert(rentalAssets)
      .values({
        variantId,
        location,
        assetCode,
        nickname: null,
        frameNumber: null,
        displayName: `${title} - ${size}`,
        weekdayPriceCents: prices.weekday,
        weekendPriceCents: prices.weekend,
        state: location === "munich" ? "active" : "maintenance",
        createdAt,
        updatedAt: createdAt,
      })
      .run();
  }
}

function ensureEquipment(db: InventoryDb, location: string, stamp: Date) {
  const existing = new Set(
    db
      .select({ accessoryKey: accessoryInventory.accessoryKey })
      .from(accessoryInventory)
      .where(eq(accessoryInventory.location, location))
      .all()
      .map((item) => item.accessoryKey),
  );
  const missing = equipment.filter(([key]) => !existing.has(key));
  if (!missing.length) return;
  db.insert(accessoryInventory)
    .values(
      missing.map(([accessoryKey, category, labelDe, labelEn, priceCents]) => ({
        location,
        accessoryKey,
        category,
        labelDe,
        labelEn,
        priceCents,
        availableQuantity: 1,
        quantityRelevant: category !== "bottle-holder" && category !== "repair-kit",
        state: (location === "munich" ? "active" : "maintenance") as "active" | "maintenance",
        createdAt: stamp,
        updatedAt: stamp,
      })),
    )
    .run();
}

function ensureDiscounts(db: InventoryDb, location: string) {
  const existing = db
    .select({ discountKey: rentalLocationDiscounts.discountKey })
    .from(rentalLocationDiscounts)
    .where(eq(rentalLocationDiscounts.location, location))
    .all();
  if (existing.length) return;
  db.insert(rentalLocationDiscounts)
    .values(
      discounts.map((discount, index) => ({
        location,
        ...discount,
        displayOrder: index + 1,
      })),
    )
    .run();
}

/** Seeds only the normalized booking inventory. The function is idempotent and repairs missing seed rows. */
export function seedRentalInventoryIfEmpty(db: AppDatabase) {
  const stamp = new Date();
  db.transaction((transaction) => {
    for (const [location, offeredBikes] of Object.entries(bikeOptionsByLocation)) {
      ensureBikeAssets(transaction, location, offeredBikes, stamp);
      ensureEquipment(transaction, location, stamp);
      ensureDiscounts(transaction, location);
    }
  });
}
