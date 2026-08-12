ALTER TABLE `rental_inquiries` ADD `mail_thread_message_id` text;
--> statement-breakpoint
CREATE TABLE `rental_inquiry_mail_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inquiry_id` integer NOT NULL,
	`action` text NOT NULL CHECK (`action` in ('confirmation', 'rejection')),
	`message_id` text,
	`thread_message_id` text,
	`mailbox_moved` integer NOT NULL DEFAULT 0,
	`sent_at` integer NOT NULL,
	FOREIGN KEY (`inquiry_id`) REFERENCES `rental_inquiries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_inquiry_mail_actions_inquiry_action_unique` ON `rental_inquiry_mail_actions` (`inquiry_id`,`action`);
--> statement-breakpoint
CREATE INDEX `rental_inquiry_mail_actions_inquiry_id_idx` ON `rental_inquiry_mail_actions` (`inquiry_id`);
