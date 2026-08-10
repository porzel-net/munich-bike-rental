CREATE TABLE `rental_inquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`location` text NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`pickup_time` text NOT NULL,
	`dropoff_time` text NOT NULL,
	`message` text NOT NULL,
	`bike_title` text,
	`affiliate_key` text,
	`locale` text NOT NULL,
	`mail_status` text DEFAULT 'pending' NOT NULL,
	`mail_sent_at` integer,
	`submitted_at` integer NOT NULL,
	CONSTRAINT "rental_inquiries_locale_check" CHECK("rental_inquiries"."locale" in ('de', 'en')),
	CONSTRAINT "rental_inquiries_mail_status_check" CHECK("rental_inquiries"."mail_status" in ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_inquiries_order_number_unique` ON `rental_inquiries` (`order_number`);--> statement-breakpoint
CREATE INDEX `rental_inquiries_submitted_at_idx` ON `rental_inquiries` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `rental_inquiries_mail_status_submitted_at_idx` ON `rental_inquiries` (`mail_status`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `rental_inquiry_bikes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inquiry_id` integer NOT NULL,
	`position` integer NOT NULL,
	`height_cm` integer NOT NULL,
	`bike_size` text NOT NULL,
	`needs_pedals` integer NOT NULL,
	`pedal_type` text,
	`needs_computer_mount` integer NOT NULL,
	`computer_mount_type` text,
	`needs_helmet` integer NOT NULL,
	`needs_clothing` integer NOT NULL,
	FOREIGN KEY (`inquiry_id`) REFERENCES `rental_inquiries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_inquiry_bikes_inquiry_position_unique` ON `rental_inquiry_bikes` (`inquiry_id`,`position`);--> statement-breakpoint
CREATE INDEX `rental_inquiry_bikes_inquiry_id_idx` ON `rental_inquiry_bikes` (`inquiry_id`);