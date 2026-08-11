CREATE TABLE `booking_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`bike_rating` integer,
	`handover_rating` integer,
	`communication_rating` integer,
	`overall_rating` integer,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`submitted_at` integer,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "booking_feedback_bike_rating_check" CHECK("booking_feedback"."bike_rating" is null or "booking_feedback"."bike_rating" between 1 and 5),
	CONSTRAINT "booking_feedback_handover_rating_check" CHECK("booking_feedback"."handover_rating" is null or "booking_feedback"."handover_rating" between 1 and 5),
	CONSTRAINT "booking_feedback_communication_rating_check" CHECK("booking_feedback"."communication_rating" is null or "booking_feedback"."communication_rating" between 1 and 5),
	CONSTRAINT "booking_feedback_overall_rating_check" CHECK("booking_feedback"."overall_rating" is null or "booking_feedback"."overall_rating" between 1 and 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_feedback_booking_unique` ON `booking_feedback` (`booking_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_feedback_token_hash_unique` ON `booking_feedback` (`token_hash`);--> statement-breakpoint
CREATE INDEX `booking_feedback_submitted_at_idx` ON `booking_feedback` (`submitted_at`);