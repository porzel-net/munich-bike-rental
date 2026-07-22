import { asc, eq } from "drizzle-orm";

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

export function getLocationInventory(db: AppDatabase, location: string): LocationInventory {
  const bikes = db
    .select()
    .from(rentalLocationBikes)
    .where(eq(rentalLocationBikes.location, location))
    .orderBy(asc(rentalLocationBikes.displayOrder))
    .all()
    .filter((bike) => bike.isAvailable);
  const sizes = db
    .select()
    .from(rentalLocationBikeSizes)
    .all()
    .filter((size) => size.isAvailable);
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
  const bikeOptions = bikes.flatMap((bike) =>
    sizes.filter((size) => size.locationBikeId === bike.id).map((size) => `${bike.title} - ${size.size}`),
  );
  const bikePrices = bikes.flatMap((bike) =>
    sizes
      .filter((size) => size.locationBikeId === bike.id)
      .map((size) => ({ option: `${bike.title} - ${size.size}`, dailyPriceCents: bike.priceCentsPerDay })),
  );
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
      subtitle: {
        de: bikeOptions
          .filter((option) => option.startsWith(bike.title + " - "))
          .map((option) => option.slice(bike.title.length + 3))
          .join(" / "),
        en: bikeOptions
          .filter((option) => option.startsWith(bike.title + " - "))
          .map((option) => option.slice(bike.title.length + 3))
          .join(" / "),
      },
      price: {
        de: `${(bike.priceCentsPerDay / 100).toFixed(0)}€/Tag`,
        en: `${(bike.priceCentsPerDay / 100).toFixed(0)}€/day`,
      },
      description: { de: bike.descriptionDe, en: bike.descriptionEn },
      image: bike.image,
      gallery: JSON.parse(bike.galleryJson) as string[],
      facts: JSON.parse(bike.factsJson) as PortfolioItem["facts"],
      equipment: JSON.parse(bike.equipmentJson) as PortfolioItem["equipment"],
    })),
    bikeOptions,
    bikePrices,
    equipmentPrices: equipment.map((item) => ({ key: item.equipmentKey, priceCents: item.priceCents })),
    pedalTypes: optionList("pedal", "pedal-"),
    computerMountTypes: optionList("computer-mount", "mount-"),
    helmetAvailable: equipment.some((item) => item.equipmentKey === "helmet"),
    clothingAvailable: equipment.some((item) => item.equipmentKey === "clothing"),
    accessoryFromCents: equipment.length ? Math.min(...equipment.map((item) => item.priceCents)) : 0,
    minimumBikePriceCents: Math.min(...bikes.map((item) => item.priceCentsPerDay), 0),
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
      inventory.bikeOptions.includes(bike.bikeSize) &&
      (!bike.needsPedals || pedals.has(bike.pedalType)) &&
      (!bike.needsComputerMount || mounts.has(bike.computerMountType)) &&
      (!bike.needsHelmet || inventory.helmetAvailable) &&
      (!bike.needsClothing || inventory.clothingAvailable),
  );
}
