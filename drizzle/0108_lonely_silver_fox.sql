ALTER TABLE `stripe_unmatched_payments` ADD `resolved_at` integer;--> statement-breakpoint
ALTER TABLE `stripe_unmatched_payments` ADD `last_checked_at` integer NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `stripe_unmatched_payments` SET `last_checked_at` = `detected_at` WHERE `last_checked_at` = 0;--> statement-breakpoint
CREATE INDEX `stripe_unmatched_payments_resolution_idx` ON `stripe_unmatched_payments` (`resolved_at`,`occurred_at`);
