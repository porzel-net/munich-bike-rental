UPDATE `rental_location_bikes`
SET `is_available` = CASE
  WHEN `location` = 'munich' AND (lower(`bike_key`) LIKE 'endurace-%' OR lower(`title`) LIKE '%endurace%') THEN 1
  WHEN `location` = 'munich' THEN 0
  ELSE `is_available`
END;
--> statement-breakpoint
UPDATE `rental_assets`
SET `state` = CASE
  WHEN EXISTS (
    SELECT 1
    FROM `bike_variants` bv
    JOIN `bike_models` bm ON bm.`id` = bv.`model_id`
    WHERE bv.`id` = `rental_assets`.`variant_id`
      AND (lower(bm.`model_key`) LIKE 'endurace-%' OR lower(bm.`title`) LIKE '%endurace%')
  ) THEN 'active'
  ELSE 'maintenance'
END
WHERE `location` = 'munich';
