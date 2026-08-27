CREATE TABLE `whatsapp_notification_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient_user_id` text NOT NULL,
	`phone` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`kind` text NOT NULL,
	`activity_id` text,
	`message_text` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`leased_at` integer,
	`sent_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_notification_outbox_idempotency_unique` ON `whatsapp_notification_outbox` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `whatsapp_notification_outbox_status_due_idx` ON `whatsapp_notification_outbox` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `whatsapp_notification_outbox_recipient_idx` ON `whatsapp_notification_outbox` (`recipient_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `whatsapp_notification_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_booking_event_id` integer DEFAULT 0 NOT NULL,
	`initialized_at` integer NOT NULL
);
