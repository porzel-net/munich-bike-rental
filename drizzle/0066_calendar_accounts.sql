CREATE TABLE `calendar_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_accounts_user_id_unique` ON `calendar_accounts` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_accounts_username_unique` ON `calendar_accounts` (`username`);
