ALTER TABLE `financial_transactions` ADD `suggested_category_id` integer REFERENCES financial_categories(id);--> statement-breakpoint
ALTER TABLE `financial_transactions` ADD `suggested_at` integer;
