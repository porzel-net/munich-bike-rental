ALTER TABLE `financial_accounts` ADD COLUMN `provider_balance_cents` integer;
--> statement-breakpoint
ALTER TABLE `financial_accounts` ADD COLUMN `provider_balance_at` text;
