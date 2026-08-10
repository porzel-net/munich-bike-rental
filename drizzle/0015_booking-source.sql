ALTER TABLE `rental_inquiries` ADD `source` text NOT NULL DEFAULT 'automatic' CHECK (`source` in ('automatic', 'manual'));
--> statement-breakpoint
CREATE INDEX `rental_inquiries_source_submitted_at_idx` ON `rental_inquiries` (`source`,`submitted_at`);
