import { count, eq } from "drizzle-orm";

import { portfolioItems } from "../home-content";
import { bikeOptionsByLocation } from "../inquiries/catalog";
import type { AppDatabase } from "../db/client";
import {
  rentalLocationBikes,
  rentalLocationBikeSizes,
  rentalLocationDiscounts,
  rentalLocationEquipment,
} from "../db/schema";

const locationPrices = { munich: 5900, regensburg: 4900, lindau: 5900, friedrichshafen: 5900, konstanz: 5900 } as const;
const equipment = [
  ["pedal-platform", "pedal", "Plattformpedale", "Platform pedals", 500],
  ["pedal-spdSl", "pedal", "SPD-SL", "SPD-SL", 500],
  ["pedal-lookKeo2Max", "pedal", "Look Keo2 Max", "Look Keo2 Max", 500],
  ["pedal-other", "pedal", "Andere", "Other", 500],
  ["mount-garmin", "computer-mount", "Garmin", "Garmin", 500],
  ["mount-wahoo", "computer-mount", "Wahoo", "Wahoo", 500],
  ["mount-other", "computer-mount", "Andere", "Other", 500],
  ["helmet", "helmet", "Helm", "Helmet", 1_000],
  ["clothing", "clothing", "Kleidung", "Clothing", 1_500],
  ["bikepacking-bag", "bag", "Bikepackingtasche", "Bikepacking bag", 2_500],
  ["glasses", "glasses", "Rennradbrille", "Road cycling glasses", 500],
  ["bottle-holder", "included", "Flaschenhalter", "Bottle holder", 0],
  ["repair-kit", "included", "Reparaturset", "Repair kit", 0],
] as const;
const discounts = [
  {
    discountKey: "weekday",
    labelDe: "Mo-Do Rabatt",
    labelEn: "Mon-Thu discount",
    percentage: 10,
    weekdayFrom: 1,
    weekdayTo: 4,
  },
  { discountKey: "long-term", labelDe: "Ab 3 Tagen", labelEn: "From 3 days", percentage: 20, minimumRentalDays: 3 },
  {
    discountKey: "student",
    labelDe: "Studentenrabatt",
    labelEn: "Student discount",
    percentage: 10,
    requiresStudent: true,
  },
] as const;

function imagePath(image: (typeof portfolioItems)[number]["image"]) {
  return typeof image === "string" ? image : image.src;
}

function bikeKey(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sizeKey(size: string) {
  return size
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function bikeDiscountText(location: string, title: string, size: string) {
  if (location === "munich" && title === "Endurace CF SL 8" && size === "S") {
    return {
      discountTextDe: "50%\nRabatt insgesamt\nVom 6.8.–13.8.\nFür Größe S",
      discountTextEn: "50%\nTotal discount\nFrom Aug 6–13\nFor size S",
    };
  }
  if (title === "Aeroad CF SL 8") {
    return {
      discountTextDe: "25%\nDauerhafter\nJuli – August\nRabatt",
      discountTextEn: "25%\nPermanent\nJuly – August\nDiscount",
    };
  }
  return { discountTextDe: "", discountTextEn: "" };
}

function normalizeExistingBikeSizes(db: AppDatabase) {
  const bikes = db.select().from(rentalLocationBikes).all();
  db.transaction((transaction) => {
    for (const bike of bikes) {
      const sizes = transaction
        .select()
        .from(rentalLocationBikeSizes)
        .where(eq(rentalLocationBikeSizes.locationBikeId, bike.id))
        .all();
      if (sizes.length <= 1) {
        if (sizes[0] && !bike.bikeKey.endsWith(`-${sizeKey(sizes[0].size)}`)) {
          transaction
            .update(rentalLocationBikes)
            .set({ bikeKey: `${bike.bikeKey}-${sizeKey(sizes[0].size)}` })
            .where(eq(rentalLocationBikes.id, bike.id))
            .run();
        }
        continue;
      }
      for (const [sizeIndex, size] of sizes.entries()) {
        const newBike = transaction
          .insert(rentalLocationBikes)
          .values({
            location: bike.location,
            bikeKey: `${bike.bikeKey}-${sizeKey(size.size)}`,
            title: bike.title,
            frameNumber: bike.frameNumber,
            priceCentsPerDay: bike.priceCentsPerDay,
            discountTextDe: bike.discountTextDe,
            discountTextEn: bike.discountTextEn,
            descriptionDe: bike.descriptionDe,
            descriptionEn: bike.descriptionEn,
            image: bike.image,
            galleryJson: bike.galleryJson,
            factsJson: bike.factsJson,
            equipmentJson: bike.equipmentJson,
            displayOrder: bike.displayOrder + sizeIndex,
            isAvailable: bike.isAvailable,
          })
          .returning({ id: rentalLocationBikes.id })
          .get();
        transaction
          .insert(rentalLocationBikeSizes)
          .values({ locationBikeId: newBike.id, size: size.size, isAvailable: size.isAvailable })
          .run();
      }
      transaction.delete(rentalLocationBikes).where(eq(rentalLocationBikes.id, bike.id)).run();
    }
  });
}

export function seedRentalInventoryIfEmpty(db: AppDatabase) {
  const needsInventory = (db.select({ value: count() }).from(rentalLocationBikes).get()?.value ?? 0) === 0;
  const needsDiscounts = (db.select({ value: count() }).from(rentalLocationDiscounts).get()?.value ?? 0) === 0;
  db.transaction((transaction) => {
    for (const [location, offeredBikes] of Object.entries(bikeOptionsByLocation)) {
      if (needsInventory) {
        const offers = portfolioItems.filter((item) => offeredBikes.some((bike) => bike.startsWith(item.title)));
        for (const [index, item] of offers.entries()) {
          const key = bikeKey(item.title);
          const sizes = offeredBikes
            .filter((bike) => bike.startsWith(item.title + " - "))
            .map((bike) => bike.slice(item.title.length + 3));
          for (const [sizeIndex, size] of sizes.entries()) {
            const inserted = transaction
              .insert(rentalLocationBikes)
              .values({
                location,
                bikeKey: `${key}-${sizeKey(size)}`,
                title: item.title,
                priceCentsPerDay: locationPrices[location as keyof typeof locationPrices],
                ...bikeDiscountText(location, item.title, size),
                descriptionDe: item.description.de,
                descriptionEn: item.description.en,
                image: imagePath(item.image),
                galleryJson: JSON.stringify(item.gallery.map(imagePath)),
                factsJson: JSON.stringify(item.facts),
                equipmentJson: JSON.stringify(item.equipment),
                displayOrder: index + sizeIndex,
              })
              .returning({ id: rentalLocationBikes.id })
              .get();
            transaction.insert(rentalLocationBikeSizes).values({ locationBikeId: inserted.id, size }).run();
          }
        }
        transaction
          .insert(rentalLocationEquipment)
          .values(
            equipment.map(([equipmentKey, category, labelDe, labelEn, priceCents], index) => ({
              location,
              equipmentKey,
              category,
              labelDe,
              labelEn,
              priceCents,
              displayOrder: index + 1,
            })),
          )
          .run();
      }

      const existingEquipment = transaction
        .select({ equipmentKey: rentalLocationEquipment.equipmentKey })
        .from(rentalLocationEquipment)
        .where(eq(rentalLocationEquipment.location, location))
        .all();
      const existingEquipmentKeys = new Set(existingEquipment.map((item) => item.equipmentKey));
      const missingEquipment = equipment.filter(([equipmentKey]) => !existingEquipmentKeys.has(equipmentKey));
      if (missingEquipment.length > 0) {
        transaction
          .insert(rentalLocationEquipment)
          .values(
            missingEquipment.map(([equipmentKey, category, labelDe, labelEn, priceCents], index) => ({
              location,
              equipmentKey,
              category,
              labelDe,
              labelEn,
              priceCents,
              displayOrder: equipment.length + index + 1,
            })),
          )
          .run();
      }

      if (needsDiscounts) {
        transaction
          .insert(rentalLocationDiscounts)
          .values(discounts.map((discount, index) => ({ location, ...discount, displayOrder: index + 1 })))
          .run();
      }
    }
  });
  normalizeExistingBikeSizes(db);
}
