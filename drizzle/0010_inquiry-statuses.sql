ALTER TABLE `rental_inquiries` ADD `status` text NOT NULL DEFAULT 'unanswered' CHECK (`status` in ('rejected', 'pending', 'executed', 'unanswered'));
--> statement-breakpoint
CREATE INDEX `rental_inquiries_status_submitted_at_idx` ON `rental_inquiries` (`status`,`submitted_at`);
