CREATE TABLE `fixed_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_number` text NOT NULL,
	`name` text NOT NULL,
	`asset_type` text DEFAULT 'other' NOT NULL,
	`serial_number` text,
	`acquisition_date` text NOT NULL,
	`in_service_date` text NOT NULL,
	`acquisition_cost_cents` integer NOT NULL,
	`input_vat_cents` integer DEFAULT 0 NOT NULL,
	`useful_life_months` integer NOT NULL,
	`method` text DEFAULT 'straight_line' NOT NULL,
	`residual_value_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`disposed_at` text,
	`disposal_reason` text,
	`disposal_proceeds_cents` integer,
	`asset_account_code` text DEFAULT 'fixed_assets_bikes' NOT NULL,
	`accumulated_depreciation_account_code` text DEFAULT 'accumulated_depreciation' NOT NULL,
	`source_transaction_id` integer REFERENCES `financial_transactions`(`id`) ON DELETE restrict,
	`notes` text DEFAULT '' NOT NULL,
	`created_by_user_id` text REFERENCES `user`(`id`) ON DELETE set null,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fixed_assets_asset_number_unique` ON `fixed_assets` (`asset_number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `fixed_assets_source_transaction_unique` ON `fixed_assets` (`source_transaction_id`);
--> statement-breakpoint
CREATE INDEX `fixed_assets_status_idx` ON `fixed_assets` (`status`);
--> statement-breakpoint
CREATE INDEX `fixed_assets_acquisition_date_idx` ON `fixed_assets` (`acquisition_date`);
--> statement-breakpoint
CREATE TABLE `fixed_asset_depreciation_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fixed_asset_id` integer NOT NULL REFERENCES `fixed_assets`(`id`) ON DELETE restrict,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`journal_entry_id` integer NOT NULL REFERENCES `journal_entries`(`id`) ON DELETE restrict,
	`created_by_user_id` text REFERENCES `user`(`id`) ON DELETE set null,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fixed_asset_depreciation_asset_period_unique` ON `fixed_asset_depreciation_entries` (`fixed_asset_id`,`period_start`);
--> statement-breakpoint
CREATE INDEX `fixed_asset_depreciation_period_idx` ON `fixed_asset_depreciation_entries` (`period_start`);
--> statement-breakpoint
ALTER TABLE `financial_transaction_allocations` ADD `fixed_asset_id` integer REFERENCES `fixed_assets`(`id`) ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX `financial_transaction_allocations_fixed_asset_idx` ON `financial_transaction_allocations` (`fixed_asset_id`);
