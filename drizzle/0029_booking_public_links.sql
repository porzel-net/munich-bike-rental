CREATE TABLE IF NOT EXISTS `booking_public_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `booking_public_links_booking_unique` ON `booking_public_links` (`booking_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `booking_public_links_token_hash_unique` ON `booking_public_links` (`token_hash`);
