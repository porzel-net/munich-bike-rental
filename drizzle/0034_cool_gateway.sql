CREATE TABLE `email_action_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`trigger_message_id` integer NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`summary` text NOT NULL,
	`open_questions_json` text DEFAULT '[]' NOT NULL,
	`model` text,
	`reasoning_effort` text,
	`prompt_version` text NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`trigger_message_id`) REFERENCES `communication_messages`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_action_reviews_trigger_message_unique` ON `email_action_reviews` (`trigger_message_id`);--> statement-breakpoint
CREATE INDEX `email_action_reviews_booking_created_idx` ON `email_action_reviews` (`booking_id`,`created_at`);