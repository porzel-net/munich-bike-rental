CREATE TABLE `web_push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `web_push_subscriptions_endpoint_unique` ON `web_push_subscriptions` (`endpoint`);
--> statement-breakpoint
CREATE INDEX `web_push_subscriptions_user_idx` ON `web_push_subscriptions` (`user_id`);
--> statement-breakpoint
CREATE TABLE `web_push_notification_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` integer NOT NULL,
	`activity_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`href` text NOT NULL,
	`tag` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`leased_at` integer,
	`sent_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `web_push_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `web_push_notification_outbox_idempotency_unique` ON `web_push_notification_outbox` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `web_push_notification_outbox_status_due_idx` ON `web_push_notification_outbox` (`status`,`next_attempt_at`);
--> statement-breakpoint
CREATE INDEX `web_push_notification_outbox_subscription_idx` ON `web_push_notification_outbox` (`subscription_id`,`created_at`);
