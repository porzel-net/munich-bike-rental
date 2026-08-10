-- Revenue records must not exist before the customer confirms the booking.
DELETE FROM `accounting_revenues`
WHERE `paid_amount_cents` = 0
  AND `inquiry_id` IN (
    SELECT `id` FROM `rental_inquiries` WHERE `status` <> 'confirmed'
  );
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_rental_inquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`location` text NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`pickup_time` text NOT NULL,
	`dropoff_time` text NOT NULL,
	`message` text NOT NULL,
	`bike_title` text,
	`affiliate_key` text,
	`total_price_cents` integer DEFAULT 0 NOT NULL,
	`locale` text NOT NULL,
	`mail_status` text DEFAULT 'pending' NOT NULL,
	`status` text DEFAULT 'unanswered' NOT NULL,
	`source` text DEFAULT 'automatic' NOT NULL,
	`mail_thread_message_id` text,
	`mail_sent_at` integer,
	`submitted_at` integer NOT NULL,
	CONSTRAINT "rental_inquiries_locale_check" CHECK("__new_rental_inquiries"."locale" in ('de', 'en')),
	CONSTRAINT "rental_inquiries_mail_status_check" CHECK("__new_rental_inquiries"."mail_status" in ('pending', 'sent', 'failed')),
	CONSTRAINT "rental_inquiries_status_check" CHECK("__new_rental_inquiries"."status" in ('rejected', 'pending', 'confirmed', 'executed', 'unanswered')),
	CONSTRAINT "rental_inquiries_source_check" CHECK("__new_rental_inquiries"."source" in ('automatic', 'manual'))
);
--> statement-breakpoint
INSERT INTO `__new_rental_inquiries`(`id`, `order_number`, `name`, `email`, `phone`, `location`, `period_from`, `period_to`, `pickup_time`, `dropoff_time`, `message`, `bike_title`, `affiliate_key`, `total_price_cents`, `locale`, `mail_status`, `status`, `source`, `mail_thread_message_id`, `mail_sent_at`, `submitted_at`)
SELECT `id`, `order_number`, `name`, `email`, `phone`, `location`, `period_from`, `period_to`, `pickup_time`, `dropoff_time`, `message`, `bike_title`, `affiliate_key`, `total_price_cents`, `locale`, `mail_status`, `status`, `source`, `mail_thread_message_id`, `mail_sent_at`, `submitted_at`
FROM `rental_inquiries`;
--> statement-breakpoint
DROP TABLE `rental_inquiries`;
--> statement-breakpoint
ALTER TABLE `__new_rental_inquiries` RENAME TO `rental_inquiries`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_inquiries_order_number_unique` ON `rental_inquiries` (`order_number`);
--> statement-breakpoint
CREATE INDEX `rental_inquiries_submitted_at_idx` ON `rental_inquiries` (`submitted_at`);
--> statement-breakpoint
CREATE INDEX `rental_inquiries_mail_status_submitted_at_idx` ON `rental_inquiries` (`mail_status`,`submitted_at`);
--> statement-breakpoint
CREATE INDEX `rental_inquiries_status_submitted_at_idx` ON `rental_inquiries` (`status`,`submitted_at`);
--> statement-breakpoint
CREATE INDEX `rental_inquiries_source_submitted_at_idx` ON `rental_inquiries` (`source`,`submitted_at`);
