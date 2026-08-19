-- Make the equipment catalog explicit about whether its quantity is a
-- booking constraint. Existing rows stay usable and are upgraded in place.
ALTER TABLE rental_location_equipment
ADD COLUMN quantity_relevant INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE accessory_inventory
ADD COLUMN quantity_relevant INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint

-- The old seed used one generic `included` category for these two bike-bound
-- items. Give them stable top-level categories before the admin catalog reads
-- the category values.
UPDATE rental_location_equipment
SET category = 'bottle-holder'
WHERE equipment_key = 'bottle-holder' AND category = 'included';
--> statement-breakpoint
UPDATE rental_location_equipment
SET category = 'repair-kit'
WHERE equipment_key = 'repair-kit' AND category = 'included';
--> statement-breakpoint
UPDATE rental_location_equipment
SET quantity_relevant = 0
WHERE category IN ('bottle-holder', 'repair-kit');
--> statement-breakpoint

-- Copy the legacy catalog's rules into the counted booking catalog. Matching
-- by legacy id keeps this safe for installations that already repaired the
-- old/new inventory relationship in 0070-0072.
UPDATE accessory_inventory
SET
  category = (SELECT equipment.category FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id),
  quantity_relevant = (SELECT equipment.quantity_relevant FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id),
  state = CASE
    WHEN (SELECT equipment.is_available FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id) = 1
      AND ((SELECT equipment.quantity_relevant FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id) = 0
        OR (SELECT equipment.available_quantity FROM rental_location_equipment equipment WHERE equipment.id = accessory_inventory.legacy_equipment_id) > 0)
    THEN 'active' ELSE 'maintenance'
  END,
  updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE legacy_equipment_id IN (SELECT id FROM rental_location_equipment);
--> statement-breakpoint

-- Keep rows that were matched only by location/key consistent as well.
UPDATE accessory_inventory
SET
  category = (SELECT equipment.category FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key),
  quantity_relevant = (SELECT equipment.quantity_relevant FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key),
  state = CASE
    WHEN (SELECT equipment.is_available FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key) = 1
      AND ((SELECT equipment.quantity_relevant FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key) = 0
        OR (SELECT equipment.available_quantity FROM rental_location_equipment equipment WHERE equipment.location = accessory_inventory.location AND equipment.equipment_key = accessory_inventory.accessory_key) > 0)
    THEN 'active' ELSE 'maintenance'
  END,
  updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE legacy_equipment_id IS NULL
  AND EXISTS (
    SELECT 1 FROM rental_location_equipment equipment
    WHERE equipment.location = accessory_inventory.location
      AND equipment.equipment_key = accessory_inventory.accessory_key
  );
