import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  accessoryInventory,
  bikeModels,
  bikeVariants,
  rentalAssets,
  rentalLocationBikes,
  rentalLocationBikeSizes,
  rentalLocationEquipment,
} from "../db/schema";
import { formatBikeDisplayName } from "../inventory/display-name";

/** Explicit one-time bootstrap for installations that still use the legacy catalog seed. */
export function importLegacyInventoryIntoBookingInventory(db: AppDatabase) {
  return db.transaction((tx) => {
    const stamp = new Date();
    const bikes = tx.select().from(rentalLocationBikes).all();
    let assets = 0;
    for (const bike of bikes) {
      const model =
        tx
          .insert(bikeModels)
          .values({
            location: bike.location,
            modelKey: `legacy-${bike.id}`,
            title: bike.title,
            descriptionDe: bike.descriptionDe,
            descriptionEn: bike.descriptionEn,
            image: bike.image,
            galleryJson: bike.galleryJson,
            factsJson: bike.factsJson,
            equipmentJson: bike.equipmentJson,
            createdAt: stamp,
          })
          .onConflictDoNothing()
          .returning({ id: bikeModels.id })
          .get() ??
        tx
          .select({ id: bikeModels.id })
          .from(bikeModels)
          .where(and(eq(bikeModels.location, bike.location), eq(bikeModels.modelKey, `legacy-${bike.id}`)))
          .get()!;
      const size =
        tx.select().from(rentalLocationBikeSizes).where(eq(rentalLocationBikeSizes.locationBikeId, bike.id)).get()
          ?.size ?? "Standard";
      const variant =
        tx
          .insert(bikeVariants)
          .values({ modelId: model.id, size, createdAt: stamp })
          .onConflictDoNothing()
          .returning({ id: bikeVariants.id })
          .get() ??
        tx
          .select({ id: bikeVariants.id })
          .from(bikeVariants)
          .where(and(eq(bikeVariants.modelId, model.id), eq(bikeVariants.size, size)))
          .get()!;
      const existingAsset = tx
        .select({ id: rentalAssets.id })
        .from(rentalAssets)
        .where(eq(rentalAssets.legacyLocationBikeId, bike.id))
        .get();
      if (existingAsset) {
        tx.update(rentalAssets)
          .set({
            nickname: bike.nickname,
            frameNumber: bike.frameNumber,
            displayName: formatBikeDisplayName(bike.title, size),
            dailyPriceCents: bike.priceCentsPerDay,
            state: bike.isAvailable ? "active" : "maintenance",
            updatedAt: stamp,
          })
          .where(eq(rentalAssets.id, existingAsset.id))
          .run();
      } else {
        const created = tx
          .insert(rentalAssets)
          .values({
            variantId: variant.id,
            location: bike.location,
            assetCode: `legacy-${bike.id}`,
            nickname: bike.nickname,
            frameNumber: bike.frameNumber,
            displayName: formatBikeDisplayName(bike.title, size),
            dailyPriceCents: bike.priceCentsPerDay,
            state: bike.isAvailable ? "active" : "maintenance",
            legacyLocationBikeId: bike.id,
            createdAt: stamp,
            updatedAt: stamp,
          })
          .run();
        assets += created.changes;
      }
    }
    for (const equipment of tx.select().from(rentalLocationEquipment).all()) {
      tx.insert(accessoryInventory)
        .values({
          location: equipment.location,
          accessoryKey: equipment.equipmentKey,
          category: equipment.category,
          labelDe: equipment.labelDe,
          labelEn: equipment.labelEn,
          priceCents: equipment.priceCents,
          availableQuantity: equipment.availableQuantity,
          state: equipment.isAvailable && equipment.availableQuantity > 0 ? "active" : "maintenance",
          legacyEquipmentId: equipment.id,
          createdAt: stamp,
          updatedAt: stamp,
        })
        .onConflictDoNothing()
        .run();
    }
    return { assets };
  });
}
