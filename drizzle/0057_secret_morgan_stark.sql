ALTER TABLE `bookings` ADD `legacy_source_id` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `legacy_dedupe_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_legacy_source_id_unique` ON `bookings` (`legacy_source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_legacy_dedupe_key_unique` ON `bookings` (`legacy_dedupe_key`);