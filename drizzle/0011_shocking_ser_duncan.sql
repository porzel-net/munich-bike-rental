CREATE TABLE `accounting_expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`payee_name` text NOT NULL,
	`depreciation_duration_months` integer,
	`sum_cents` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
