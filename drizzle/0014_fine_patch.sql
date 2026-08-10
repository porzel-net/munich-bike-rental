CREATE TABLE `accounting_revenue_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`revenue_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`received_at` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`revenue_id`) REFERENCES `accounting_revenues`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "accounting_revenue_payments_amount_cents_check" CHECK("accounting_revenue_payments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `accounting_revenue_payments_revenue_id_idx` ON `accounting_revenue_payments` (`revenue_id`);