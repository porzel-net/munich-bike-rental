ALTER TABLE `rental_assets` ADD `is_visible_on_landing` integer DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `rental_assets` ADD `is_bookable` integer DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE `rental_assets`
SET
  `is_visible_on_landing` = CASE WHEN `state` <> 'retired' THEN 1 ELSE 0 END,
  `is_bookable` = CASE WHEN `state` = 'active' THEN 1 ELSE 0 END;
