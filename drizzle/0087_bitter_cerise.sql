CREATE TABLE `stripe_refund_operations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`offer_id` integer NOT NULL,
	`payment_intent_id` text NOT NULL,
	`stripe_refund_id` text,
	`idempotency_key` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text NOT NULL,
	`failure_message` text,
	`financial_transaction_id` integer,
	`journal_entry_id` integer,
	`actor_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`offer_id`) REFERENCES `booking_offers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`financial_transaction_id`) REFERENCES `financial_transactions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "stripe_refund_operations_amount_positive" CHECK("stripe_refund_operations"."amount_cents" > 0),
	CONSTRAINT "stripe_refund_operations_currency_check" CHECK(length("stripe_refund_operations"."currency") = 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_refund_operations_idempotency_unique` ON `stripe_refund_operations` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_refund_operations_stripe_refund_unique` ON `stripe_refund_operations` (`stripe_refund_id`);--> statement-breakpoint
CREATE INDEX `stripe_refund_operations_booking_status_idx` ON `stripe_refund_operations` (`booking_id`,`status`);--> statement-breakpoint
CREATE INDEX `stripe_refund_operations_payment_intent_idx` ON `stripe_refund_operations` (`payment_intent_id`);