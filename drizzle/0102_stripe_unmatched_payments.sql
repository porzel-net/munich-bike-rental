CREATE TABLE `stripe_unmatched_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stripe_session_id` text NOT NULL,
	`stripe_payment_intent_id` text,
	`amount_cents` integer,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`customer_email` text,
	`booking_offer_id` integer,
	`booking_id` integer,
	`reason` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`detected_at` integer NOT NULL,
	CONSTRAINT `stripe_unmatched_payments_amount_positive` CHECK(`stripe_unmatched_payments`.`amount_cents` is null or `stripe_unmatched_payments`.`amount_cents` > 0),
	CONSTRAINT `stripe_unmatched_payments_currency_check` CHECK(length(`stripe_unmatched_payments`.`currency`) = 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_unmatched_payments_session_unique` ON `stripe_unmatched_payments` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `stripe_unmatched_payments_occurred_idx` ON `stripe_unmatched_payments` (`occurred_at`);
