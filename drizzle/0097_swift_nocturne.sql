ALTER TABLE `fixed_assets` ADD `original_acquisition_cost_cents` integer;--> statement-breakpoint
ALTER TABLE `fixed_assets` ADD `original_useful_life_months` integer;--> statement-breakpoint
ALTER TABLE `fixed_assets` ADD `private_use_type` text;--> statement-breakpoint
ALTER TABLE `fixed_assets` ADD `pre_entry_depreciation_cents` integer DEFAULT 0 NOT NULL;