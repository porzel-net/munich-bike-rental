CREATE TABLE `rental_location_discounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location` text NOT NULL,
	`discount_key` text NOT NULL,
	`label_de` text NOT NULL,
	`label_en` text NOT NULL,
	`percentage` integer NOT NULL,
	`weekday_from` integer,
	`weekday_to` integer,
	`minimum_rental_days` integer,
	`requires_student` integer DEFAULT false NOT NULL,
	`is_stackable` integer DEFAULT false NOT NULL,
	`display_order` integer NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	CONSTRAINT "rental_location_discounts_percentage_check" CHECK("rental_location_discounts"."percentage" between 0 and 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_location_discounts_location_key_unique` ON `rental_location_discounts` (`location`,`discount_key`);--> statement-breakpoint
CREATE INDEX `rental_location_discounts_location_order_idx` ON `rental_location_discounts` (`location`,`display_order`);