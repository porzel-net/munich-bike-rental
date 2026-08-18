-- Keep data imported through the old rental catalog usable by the counted
-- accessory allocator. This is intentionally idempotent because some
-- installations ran the old catalog seed before accessory_inventory existed.
INSERT OR IGNORE INTO accessory_inventory
  (location, accessory_key, category, label_de, label_en, price_cents, available_quantity, state, legacy_equipment_id, created_at, updated_at)
SELECT location, equipment_key, category, label_de, label_en, price_cents,
       CASE WHEN is_available = 1 THEN 1 ELSE 0 END,
       CASE WHEN is_available = 1 THEN 'active' ELSE 'maintenance' END,
       id, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000
FROM rental_location_equipment;
--> statement-breakpoint
UPDATE booking_requested_items
SET pedal_type = CASE lower(trim(pedal_type))
  WHEN 'flat' THEN 'platform'
  WHEN 'platform-pedals' THEN 'platform'
  WHEN 'spd' THEN 'spdSl'
  WHEN 'spd-sl' THEN 'spdSl'
  WHEN 'spdsl' THEN 'spdSl'
  WHEN 'look-keo' THEN 'lookKeo2Max'
  WHEN 'look-keo-2-max' THEN 'lookKeo2Max'
  WHEN 'lookkeo' THEN 'lookKeo2Max'
  WHEN 'lookkeo2max' THEN 'lookKeo2Max'
  WHEN 'unknown' THEN 'other'
  ELSE pedal_type
END
WHERE pedal_type IS NOT NULL;
--> statement-breakpoint
UPDATE booking_requested_items
SET computer_mount_type = CASE lower(trim(computer_mount_type))
  WHEN 'unknown' THEN 'other'
  ELSE computer_mount_type
END
WHERE computer_mount_type IS NOT NULL;
--> statement-breakpoint
UPDATE accessory_inventory
SET
  category = (SELECT category FROM rental_location_equipment WHERE id = accessory_inventory.legacy_equipment_id),
  label_de = (SELECT label_de FROM rental_location_equipment WHERE id = accessory_inventory.legacy_equipment_id),
  label_en = (SELECT label_en FROM rental_location_equipment WHERE id = accessory_inventory.legacy_equipment_id),
  price_cents = (SELECT price_cents FROM rental_location_equipment WHERE id = accessory_inventory.legacy_equipment_id),
  state = CASE WHEN (SELECT is_available FROM rental_location_equipment WHERE id = accessory_inventory.legacy_equipment_id) = 1
    THEN 'active' ELSE 'maintenance' END,
  available_quantity = CASE
    WHEN (SELECT is_available FROM rental_location_equipment WHERE id = accessory_inventory.legacy_equipment_id) = 1
      AND available_quantity = 0 THEN 1
    ELSE available_quantity
  END,
  updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE legacy_equipment_id IN (SELECT id FROM rental_location_equipment);
