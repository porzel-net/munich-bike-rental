import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { accessoryInventory, rentalLocationEquipment } from "../db/schema";

type LegacyEquipment = typeof rentalLocationEquipment.$inferSelect;

/**
 * Keeps the counted booking inventory compatible with the legacy equipment
 * catalog. The latter is still the source edited by the admin inventory API.
 * Existing quantities are preserved; a previously empty but available legacy
 * item gets the historical default quantity of one.
 */
export function syncLegacyEquipmentToAccessoryInventory(
  db: AppDatabase,
  equipment: LegacyEquipment,
  stamp = new Date(),
) {
  const byLegacyId = db
    .select()
    .from(accessoryInventory)
    .where(eq(accessoryInventory.legacyEquipmentId, equipment.id))
    .get();
  const byLocationKey = db
    .select()
    .from(accessoryInventory)
    .where(
      and(
        eq(accessoryInventory.location, equipment.location),
        eq(accessoryInventory.accessoryKey, equipment.equipmentKey),
      ),
    )
    .get();
  const accessory = byLegacyId ?? byLocationKey;
  const nextState = equipment.isAvailable ? "active" : "maintenance";

  if (!accessory) {
    db.insert(accessoryInventory)
      .values({
        location: equipment.location,
        accessoryKey: equipment.equipmentKey,
        category: equipment.category,
        labelDe: equipment.labelDe,
        labelEn: equipment.labelEn,
        priceCents: equipment.priceCents,
        availableQuantity: equipment.isAvailable ? 1 : 0,
        state: nextState,
        legacyEquipmentId: equipment.id,
        createdAt: stamp,
        updatedAt: stamp,
      })
      .run();
    return;
  }

  const conflictingKey =
    accessory.accessoryKey !== equipment.equipmentKey
      ? db
          .select({ id: accessoryInventory.id })
          .from(accessoryInventory)
          .where(
            and(
              eq(accessoryInventory.location, equipment.location),
              eq(accessoryInventory.accessoryKey, equipment.equipmentKey),
            ),
          )
          .get()
      : undefined;

  db.update(accessoryInventory)
    .set({
      ...(conflictingKey ? {} : { accessoryKey: equipment.equipmentKey }),
      category: equipment.category,
      labelDe: equipment.labelDe,
      labelEn: equipment.labelEn,
      priceCents: equipment.priceCents,
      availableQuantity: Math.max(accessory.availableQuantity, equipment.isAvailable ? 1 : 0),
      state: nextState,
      legacyEquipmentId: accessory.legacyEquipmentId ?? equipment.id,
      updatedAt: stamp,
    })
    .where(eq(accessoryInventory.id, accessory.id))
    .run();
}

/** Repairs all legacy equipment rows after migrations and on every startup. */
export function syncAllLegacyEquipmentToAccessoryInventory(db: AppDatabase, stamp = new Date()) {
  for (const equipment of db.select().from(rentalLocationEquipment).all())
    syncLegacyEquipmentToAccessoryInventory(db, equipment, stamp);
}
