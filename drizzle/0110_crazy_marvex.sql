ALTER TABLE `financial_transaction_allocations` ADD `internal_person_id` text REFERENCES user(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `financial_transaction_allocations_internal_person_idx` ON `financial_transaction_allocations` (`internal_person_id`);--> statement-breakpoint
ALTER TABLE `fixed_assets` ADD `internal_person_id` text REFERENCES user(id) ON DELETE set null;
