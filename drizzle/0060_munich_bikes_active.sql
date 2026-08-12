UPDATE `rental_location_bikes`
SET `is_available` = CASE WHEN `location` = 'munich' THEN 1 ELSE 0 END;
--> statement-breakpoint
UPDATE `rental_assets`
SET `state` = CASE WHEN `location` = 'munich' THEN 'active' ELSE 'maintenance' END;
