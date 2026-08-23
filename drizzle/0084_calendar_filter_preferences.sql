CREATE TABLE `calendar_filter_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`location` text DEFAULT 'all' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_filter_preferences_user_id_unique` ON `calendar_filter_preferences` (`user_id`);