CREATE TABLE `accounting_revenues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inquiry_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_amount_cents` integer DEFAULT 0 NOT NULL,
	`payment_received_at` text,
	`payer_name` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`inquiry_id`) REFERENCES `rental_inquiries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "accounting_revenues_amount_cents_check" CHECK("accounting_revenues"."amount_cents" >= 0),
	CONSTRAINT "accounting_revenues_paid_amount_cents_check" CHECK("accounting_revenues"."paid_amount_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounting_revenues_inquiry_id_unique` ON `accounting_revenues` (`inquiry_id`);