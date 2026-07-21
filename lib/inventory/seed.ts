import { count } from "drizzle-orm";

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
  ["pedal-platform", "pedal", "Plattformpedale", "Platform pedals"],
  ["pedal-spdSl", "pedal", "SPD-SL", "SPD-SL"],
  ["pedal-lookKeo2Max", "pedal", "Look Keo2 Max", "Look Keo2 Max"],
  ["pedal-other", "pedal", "Andere", "Other"],
  ["mount-garmin", "computer-mount", "Garmin", "Garmin"],
  ["mount-wahoo", "computer-mount", "Wahoo", "Wahoo"],
  ["mount-other", "computer-mount", "Andere", "Other"],
  ["helmet", "helmet", "Helm", "Helmet"],
  ["clothing", "clothing", "Kleidung", "Clothing"],
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

export function seedRentalInventoryIfEmpty(db: AppDatabase) {
  const needsInventory = (db.select({ value: count() }).from(rentalLocationBikes).get()?.value ?? 0) === 0;
  const needsDiscounts = (db.select({ value: count() }).from(rentalLocationDiscounts).get()?.value ?? 0) === 0;
  if (!needsInventory && !needsDiscounts) return;

  db.transaction((transaction) => {
    for (const [location, offeredBikes] of Object.entries(bikeOptionsByLocation)) {
      if (needsInventory) {
        const offers = portfolioItems.filter((item) => offeredBikes.some((bike) => bike.startsWith(item.title)));
        for (const [index, item] of offers.entries()) {
          const key = bikeKey(item.title);
          const inserted = transaction
            .insert(rentalLocationBikes)
            .values({
              location,
              bikeKey: key,
              title: item.title,
              priceCentsPerDay: locationPrices[location as keyof typeof locationPrices],
              descriptionDe: item.description.de,
              descriptionEn: item.description.en,
              image: imagePath(item.image),
              galleryJson: JSON.stringify(item.gallery.map(imagePath)),
              factsJson: JSON.stringify(item.facts),
              equipmentJson: JSON.stringify(item.equipment),
              displayOrder: index + 1,
            })
            .returning({ id: rentalLocationBikes.id })
            .get();
          const sizes = offeredBikes
            .filter((bike) => bike.startsWith(item.title + " - "))
            .map((bike) => bike.slice(item.title.length + 3));
          transaction
            .insert(rentalLocationBikeSizes)
            .values(sizes.map((size) => ({ locationBikeId: inserted.id, size })))
            .run();
        }
        transaction
          .insert(rentalLocationEquipment)
          .values(
            equipment.map(([equipmentKey, category, labelDe, labelEn], index) => ({
              location,
              equipmentKey,
              category,
              labelDe,
              labelEn,
              priceCents: 500,
              displayOrder: index + 1,
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
}
