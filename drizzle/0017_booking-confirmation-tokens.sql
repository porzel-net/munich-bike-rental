CREATE TABLE `rental_booking_confirmation_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inquiry_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`confirmed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`inquiry_id`) REFERENCES `rental_inquiries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_booking_confirmation_tokens_hash_unique` ON `rental_booking_confirmation_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `rental_booking_confirmation_tokens_inquiry_id_idx` ON `rental_booking_confirmation_tokens` (`inquiry_id`);
--> statement-breakpoint
CREATE INDEX `rental_booking_confirmation_tokens_expires_at_idx` ON `rental_booking_confirmation_tokens` (`expires_at`);
