CREATE TABLE `booking_salary_recipients` (
	`booking_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_salary_recipients_booking_user_unique` ON `booking_salary_recipients` (`booking_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `booking_salary_recipients_user_idx` ON `booking_salary_recipients` (`user_id`);