-- Make the counted accessory inventory complete and consistent with the
-- legacy admin catalog. The counted table is the canonical source for
-- booking availability and pricing; the legacy table remains a compatibility
-- mirror for existing admin screens and data imports.

-- Repair all known historical request aliases before they are resolved into
-- counted accessory keys during a booking confirmation.
UPDATE booking_requested_items
SET pedal_type = 'platform'
WHERE lower(trim(pedal_type)) IN ('flat', 'platform-pedals', 'pedal-platform');
--> statement-breakpoint
UPDATE booking_requested_items
SET pedal_type = 'spdSl'
WHERE lower(trim(pedal_type)) IN ('spd', 'spd-sl', 'spdsl');
--> statement-breakpoint
UPDATE booking_requested_items
SET pedal_type = 'lookKeo2Max'
WHERE lower(trim(pedal_type)) IN ('look-keo', 'look-keo-2-max', 'lookkeo', 'lookkeo2max');
--> statement-breakpoint
UPDATE booking_requested_items
SET pedal_type = 'other'
WHERE lower(trim(pedal_type)) = 'unknown';
--> statement-breakpoint
UPDATE booking_requested_items
SET computer_mount_type = 'other'
WHERE lower(trim(computer_mount_type)) = 'unknown';
--> statement-breakpoint

-- First repair rows that already carry the legacy foreign key. Quantities and
-- availability deliberately come from the legacy catalog during this
-- compatibility phase so the admin quantity remains authoritative.
UPDATE accessory_inventory
SET
  location = (SELECT equipment.location FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id),
  accessory_key = (SELECT equipment.equipment_key FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id),
  category = (SELECT equipment.category FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id),
  label_de = (SELECT equipment.label_de FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id),
  label_en = (SELECT equipment.label_en FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id),
  price_cents = (SELECT equipment.price_cents FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id),
  available_quantity = (SELECT equipment.available_quantity FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id),
  state = CASE
    WHEN (SELECT equipment.is_available FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id) = 1
      AND (SELECT equipment.available_quantity FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id) > 0
    THEN 'active' ELSE 'maintenance'
  END,
  updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE legacy_equipment_id IN (SELECT id FROM rental_location_equipment);
--> statement-breakpoint

-- Repair rows that can only be matched by their stable location/key pair.
UPDATE accessory_inventory
SET
  category = (SELECT equipment.category FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key),
  label_de = (SELECT equipment.label_de FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key),
  label_en = (SELECT equipment.label_en FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key),
  price_cents = (SELECT equipment.price_cents FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key),
  available_quantity = (SELECT equipment.available_quantity FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key),
  state = CASE
    WHEN (SELECT equipment.is_available FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key) = 1
      AND (SELECT equipment.available_quantity FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key) > 0
    THEN 'active' ELSE 'maintenance'
  END,
  legacy_equipment_id = (SELECT equipment.id FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key),
  updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE legacy_equipment_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM rental_location_equipment equipment
    WHERE equipment.location = accessory_inventory.location
      AND equipment.equipment_key = accessory_inventory.accessory_key
  );
--> statement-breakpoint

-- Finally create every missing counted row. Matching on both the legacy id
-- and location/key makes this safe for partially migrated installations.
INSERT INTO accessory_inventory
  (location, accessory_key, category, label_de, label_en, price_cents, available_quantity, state, legacy_equipment_id, created_at, updated_at)
SELECT
  equipment.location,
  equipment.equipment_key,
  equipment.category,
  equipment.label_de,
  equipment.label_en,
  equipment.price_cents,
  equipment.available_quantity,
  CASE WHEN equipment.is_available = 1 AND equipment.available_quantity > 0 THEN 'active' ELSE 'maintenance' END,
  equipment.id,
  CAST(strftime('%s','now') AS INTEGER) * 1000,
  CAST(strftime('%s','now') AS INTEGER) * 1000
FROM rental_location_equipment equipment
WHERE NOT EXISTS (
  SELECT 1
  FROM accessory_inventory accessory
  WHERE accessory.legacy_equipment_id = equipment.id
     OR (accessory.location = equipment.location AND accessory.accessory_key = equipment.equipment_key)
);
