-- Migrate the last legacy catalog rows into the normalized physical inventory
-- before removing the old catalog tables. Existing bootstrap-created assets
-- are relinked; missing size rows are created as new physical assets.
INSERT OR IGNORE INTO `bike_models` (
  `location`, `model_key`, `title`, `description_de`, `description_en`, `image`,
  `gallery_json`, `facts_json`, `equipment_json`, `created_at`
)
SELECT `location`, 'legacy-' || `id`, `title`, `description_de`, `description_en`, `image`,
       `gallery_json`, `facts_json`, `equipment_json`, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `rental_location_bikes`;
--> statement-breakpoint
INSERT OR IGNORE INTO `bike_variants` (`model_id`, `size`, `created_at`)
SELECT m.`id`, s.`size`, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `rental_location_bikes` b
JOIN `rental_location_bike_sizes` s ON s.`location_bike_id` = b.`id`
JOIN `bike_models` m ON m.`model_key` = 'legacy-' || b.`id`;
--> statement-breakpoint
INSERT OR IGNORE INTO `bike_variants` (`model_id`, `size`, `created_at`)
SELECT m.`id`, 'Standard', CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `rental_location_bikes` b
JOIN `bike_models` m ON m.`model_key` = 'legacy-' || b.`id`
WHERE NOT EXISTS (
  SELECT 1 FROM `rental_location_bike_sizes` s WHERE s.`location_bike_id` = b.`id`
);
--> statement-breakpoint
UPDATE `rental_assets`
SET `variant_id` = (
      SELECT v.`id`
      FROM `bike_variants` v
      JOIN `bike_models` m ON m.`id` = v.`model_id`
      JOIN `rental_location_bikes` b ON m.`model_key` = 'legacy-' || b.`id`
      LEFT JOIN `rental_location_bike_sizes` s ON s.`location_bike_id` = b.`id` AND s.`size` = v.`size`
      WHERE b.`id` = `rental_assets`.`legacy_location_bike_id`
      ORDER BY s.`id` IS NULL, s.`id`
      LIMIT 1
    )
WHERE `legacy_location_bike_id` IS NOT NULL;
--> statement-breakpoint
INSERT INTO `rental_assets` (
  `variant_id`, `location`, `asset_code`, `nickname`, `frame_number`, `display_name`,
  `daily_price_cents`, `weekday_price_cents`, `weekend_price_cents`, `state`,
  `created_at`, `updated_at`
)
SELECT v.`id`, b.`location`, 'legacy-' || b.`id` || '-' || s.`id`, b.`nickname`, b.`frame_number`,
       b.`title` || ' - ' || s.`size`, b.`price_cents_per_day`, b.`weekday_price_cents_per_day`,
       b.`weekend_price_cents_per_day`, CASE WHEN b.`is_available` = 1 THEN 'active' ELSE 'maintenance' END,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `rental_location_bikes` b
JOIN `rental_location_bike_sizes` s ON s.`location_bike_id` = b.`id`
JOIN `bike_models` m ON m.`model_key` = 'legacy-' || b.`id`
JOIN `bike_variants` v ON v.`model_id` = m.`id` AND v.`size` = s.`size`
WHERE NOT EXISTS (SELECT 1 FROM `rental_assets` a WHERE a.`variant_id` = v.`id`);
--> statement-breakpoint
INSERT INTO `rental_assets` (
  `variant_id`, `location`, `asset_code`, `nickname`, `frame_number`, `display_name`,
  `daily_price_cents`, `weekday_price_cents`, `weekend_price_cents`, `state`,
  `created_at`, `updated_at`
)
SELECT v.`id`, b.`location`, 'legacy-' || b.`id` || '-0', b.`nickname`, b.`frame_number`,
       b.`title` || ' - Standard', b.`price_cents_per_day`, b.`weekday_price_cents_per_day`,
       b.`weekend_price_cents_per_day`, CASE WHEN b.`is_available` = 1 THEN 'active' ELSE 'maintenance' END,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `rental_location_bikes` b
JOIN `bike_models` m ON m.`model_key` = 'legacy-' || b.`id`
JOIN `bike_variants` v ON v.`model_id` = m.`id` AND v.`size` = 'Standard'
WHERE NOT EXISTS (SELECT 1 FROM `rental_location_bike_sizes` s WHERE s.`location_bike_id` = b.`id`)
  AND NOT EXISTS (SELECT 1 FROM `rental_assets` a WHERE a.`variant_id` = v.`id`);
--> statement-breakpoint
DROP TABLE `rental_location_bike_sizes`;--> statement-breakpoint
DROP TABLE `rental_location_bikes`;--> statement-breakpoint
DROP INDEX `rental_assets_legacy_location_bike_id_unique`;--> statement-breakpoint
ALTER TABLE `rental_assets` DROP COLUMN `legacy_location_bike_id`;
