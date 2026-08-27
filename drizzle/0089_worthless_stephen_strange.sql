PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_rental_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variant_id` integer NOT NULL,
	`location` text NOT NULL,
	`asset_code` text NOT NULL,
	`nickname` text,
	`frame_number` text,
	`display_name` text NOT NULL,
	`weekday_price_cents` integer DEFAULT 4900 NOT NULL,
	`weekend_price_cents` integer DEFAULT 6900 NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `bike_variants`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "rental_assets_weekday_price_nonnegative" CHECK("__new_rental_assets"."weekday_price_cents" >= 0),
	CONSTRAINT "rental_assets_weekend_price_nonnegative" CHECK("__new_rental_assets"."weekend_price_cents" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_rental_assets`("id", "variant_id", "location", "asset_code", "nickname", "frame_number", "display_name", "weekday_price_cents", "weekend_price_cents", "state", "created_at", "updated_at") SELECT "id", "variant_id", "location", "asset_code", "nickname", "frame_number", "display_name", "weekday_price_cents", "weekend_price_cents", "state", "created_at", "updated_at" FROM `rental_assets`;--> statement-breakpoint
DROP TABLE `rental_assets`;--> statement-breakpoint
ALTER TABLE `__new_rental_assets` RENAME TO `rental_assets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `rental_assets_location_code_unique` ON `rental_assets` (`location`,`asset_code`);--> statement-breakpoint
CREATE INDEX `rental_assets_location_state_idx` ON `rental_assets` (`location`,`state`);