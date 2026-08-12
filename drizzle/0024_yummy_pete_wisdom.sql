CREATE TABLE `booking_accessory_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`accessory_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`pickup_time` text NOT NULL,
	`dropoff_time` text NOT NULL,
	`released_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`accessory_id`) REFERENCES `accessory_inventory`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "booking_accessory_allocations_quantity_positive" CHECK("booking_accessory_allocations"."quantity" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_accessory_allocations_booking_accessory_unique` ON `booking_accessory_allocations` (`booking_id`,`accessory_id`);--> statement-breakpoint
CREATE INDEX `booking_accessory_allocations_accessory_period_idx` ON `booking_accessory_allocations` (`accessory_id`,`period_from`,`period_to`);