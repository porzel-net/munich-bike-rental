ALTER TABLE `mail_outbox` ADD `sent_mailbox_path` text;
--> statement-breakpoint
ALTER TABLE `mail_outbox` ADD `sent_mailbox_at` integer;
--> statement-breakpoint
ALTER TABLE `mail_outbox` ADD `sent_mailbox_error` text;
