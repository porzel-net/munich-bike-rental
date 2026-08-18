ALTER TABLE rental_location_equipment
ADD COLUMN available_quantity INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
UPDATE rental_location_equipment
SET available_quantity = 1
WHERE available_quantity < 1;
--> statement-breakpoint
UPDATE accessory_inventory
SET available_quantity = (
  SELECT equipment.available_quantity
  FROM rental_location_equipment equipment
  WHERE equipment.id = accessory_inventory.legacy_equipment_id
)
WHERE legacy_equipment_id IN (SELECT id FROM rental_location_equipment);
