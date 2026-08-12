-- Nicknames are internal inventory metadata and must never be exposed through
-- public booking views or outgoing customer emails. Normalize legacy display
-- names to the model title and frame size.
UPDATE `rental_assets`
SET `display_name` = (
  SELECT bm.`title` || ' - ' || bv.`size`
  FROM `bike_variants` bv
  JOIN `bike_models` bm ON bm.`id` = bv.`model_id`
  WHERE bv.`id` = `rental_assets`.`variant_id`
)
WHERE EXISTS (
  SELECT 1
  FROM `bike_variants` bv
  JOIN `bike_models` bm ON bm.`id` = bv.`model_id`
  WHERE bv.`id` = `rental_assets`.`variant_id`
);
