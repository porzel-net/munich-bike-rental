ALTER TABLE `communication_messages` ADD `references_header` text;
--> statement-breakpoint
ALTER TABLE `mail_outbox` ADD `references_header` text;
