ALTER TABLE `bookings` ADD `submission_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_submission_id_unique` ON `bookings` (`submission_id`);
