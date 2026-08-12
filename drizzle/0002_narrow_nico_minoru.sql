CREATE TABLE `rental_location_bike_sizes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location_bike_id` integer NOT NULL,
	`size` text NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`location_bike_id`) REFERENCES `rental_location_bikes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_location_bike_sizes_bike_size_unique` ON `rental_location_bike_sizes` (`location_bike_id`,`size`);--> statement-breakpoint
CREATE TABLE `rental_location_bikes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location` text NOT NULL,
	`bike_key` text NOT NULL,
	`title` text NOT NULL,
	`price_cents_per_day` integer NOT NULL,
	`description_de` text NOT NULL,
	`description_en` text NOT NULL,
	`image` text NOT NULL,
	`gallery_json` text NOT NULL,
	`facts_json` text NOT NULL,
	`equipment_json` text NOT NULL,
	`display_order` integer NOT NULL,
	`is_available` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_location_bikes_location_key_unique` ON `rental_location_bikes` (`location`,`bike_key`);--> statement-breakpoint
CREATE INDEX `rental_location_bikes_location_order_idx` ON `rental_location_bikes` (`location`,`display_order`);--> statement-breakpoint
CREATE TABLE `rental_location_equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location` text NOT NULL,
	`equipment_key` text NOT NULL,
	`category` text NOT NULL,
	`label_de` text NOT NULL,
	`label_en` text NOT NULL,
	`price_cents` integer NOT NULL,
	`display_order` integer NOT NULL,
	`is_available` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_location_equipment_location_key_unique` ON `rental_location_equipment` (`location`,`equipment_key`);--> statement-breakpoint
CREATE INDEX `rental_location_equipment_location_category_idx` ON `rental_location_equipment` (`location`,`category`,`display_order`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'standortuser' NOT NULL,
	`location_key` text,
	`banned` integer DEFAULT false NOT NULL,
	`ban_reason` text,
	`ban_expires` integer,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "auth_user_location_key_check" CHECK("__new_user"."location_key" is null or "__new_user"."location_key" in ('munich', 'regensburg', 'lindau', 'friedrichshafen', 'konstanz'))
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "email_verified", "image", "role", "location_key", "banned", "ban_reason", "ban_expires", "two_factor_enabled", "created_at", "updated_at") SELECT "id", "name", "email", "email_verified", "image", "role", NULL, "banned", "ban_reason", "ban_expires", "two_factor_enabled", "created_at", "updated_at" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `auth_user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `auth_user_role_idx` ON `user` (`role`);--> statement-breakpoint
CREATE INDEX `auth_user_location_key_idx` ON `user` (`location_key`);
