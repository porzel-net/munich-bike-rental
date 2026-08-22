CREATE TABLE `dashboard_activity_dismissals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`dismissed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dashboard_activity_dismissals_user_activity_unique` ON `dashboard_activity_dismissals` (`user_id`,`activity_id`);
--> statement-breakpoint
CREATE INDEX `dashboard_activity_dismissals_user_idx` ON `dashboard_activity_dismissals` (`user_id`);
