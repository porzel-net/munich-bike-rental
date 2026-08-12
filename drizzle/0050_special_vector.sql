ALTER TABLE `fixed_assets` ADD `disposal_transaction_id` integer REFERENCES financial_transactions(id);--> statement-breakpoint
CREATE UNIQUE INDEX `fixed_assets_disposal_transaction_unique` ON `fixed_assets` (`disposal_transaction_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `accounting_accounts`
  (`code`, `name`, `account_type`, `is_system`, `is_active`, `notes`, `created_at`, `updated_at`)
VALUES
  ('fixed_assets_bikes', 'Anlagevermögen Fahrräder', 'asset', 1, 1, 'Aktivkonto für kapitalisierte Fahrräder und Ausstattung.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('accumulated_depreciation', 'Kumulierte Abschreibungen', 'asset', 1, 1, 'Gegenkonto zu den gebuchten AfA-Beträgen.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('equity', 'Privateinlage / Eigenkapital', 'equity', 1, 1, 'Gegenkonto für private Einlagen.', strftime('%s','now') * 1000, strftime('%s','now') * 1000);
--> statement-breakpoint
UPDATE `financial_categories`
SET `account_code` = 'private_withdrawal',
    `updated_at` = strftime('%s','now') * 1000
WHERE `code` = 'private_payment';
--> statement-breakpoint
CREATE TRIGGER `financial_transactions_immutable_fields_update`
BEFORE UPDATE ON `financial_transactions`
WHEN OLD.`financial_account_id` IS NOT NEW.`financial_account_id`
  OR OLD.`source` IS NOT NEW.`source`
  OR OLD.`provider` IS NOT NEW.`provider`
  OR OLD.`external_id` IS NOT NEW.`external_id`
  OR OLD.`external_parent_id` IS NOT NEW.`external_parent_id`
  OR OLD.`kind` IS NOT NEW.`kind`
  OR OLD.`amount_cents` IS NOT NEW.`amount_cents`
  OR OLD.`gross_amount_cents` IS NOT NEW.`gross_amount_cents`
  OR OLD.`fee_amount_cents` IS NOT NEW.`fee_amount_cents`
  OR OLD.`net_amount_cents` IS NOT NEW.`net_amount_cents`
  OR OLD.`currency` IS NOT NEW.`currency`
  OR OLD.`booked_at` IS NOT NEW.`booked_at`
  OR OLD.`value_date` IS NOT NEW.`value_date`
  OR OLD.`counterparty_id` IS NOT NEW.`counterparty_id`
  OR OLD.`counterparty_name_snapshot` IS NOT NEW.`counterparty_name_snapshot`
  OR OLD.`counterparty_email_snapshot` IS NOT NEW.`counterparty_email_snapshot`
  OR OLD.`counterparty_iban_last4` IS NOT NEW.`counterparty_iban_last4`
  OR OLD.`reference` IS NOT NEW.`reference`
  OR OLD.`description` IS NOT NEW.`description`
  OR OLD.`bank_transaction_code` IS NOT NEW.`bank_transaction_code`
  OR OLD.`provider_payload_json` IS NOT NEW.`provider_payload_json`
  OR OLD.`metadata_json` IS NOT NEW.`metadata_json`
  OR OLD.`imported_at` IS NOT NEW.`imported_at`
  OR OLD.`created_at` IS NOT NEW.`created_at`
BEGIN
  SELECT RAISE(ABORT, 'financial transaction source data is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `financial_transactions_posted_balance_check`
BEFORE UPDATE OF `status` ON `financial_transactions`
WHEN NEW.`status` = 'posted'
  AND COALESCE((SELECT SUM(`amount_cents`) FROM `financial_transaction_allocations` WHERE `transaction_id` = NEW.`id`), 0) <> NEW.`amount_cents`
BEGIN
  SELECT RAISE(ABORT, 'posted financial transactions must be fully allocated');
END;
--> statement-breakpoint
CREATE TRIGGER `financial_allocations_immutable_identity_update`
BEFORE UPDATE ON `financial_transaction_allocations`
WHEN OLD.`transaction_id` IS NOT NEW.`transaction_id`
  OR OLD.`booking_id` IS NOT NEW.`booking_id`
  OR OLD.`booking_requested_item_id` IS NOT NEW.`booking_requested_item_id`
  OR OLD.`rental_asset_id` IS NOT NEW.`rental_asset_id`
  OR OLD.`fixed_asset_id` IS NOT NEW.`fixed_asset_id`
  OR OLD.`amount_cents` IS NOT NEW.`amount_cents`
  OR OLD.`journal_entry_id` IS NOT NEW.`journal_entry_id`
BEGIN
  SELECT RAISE(ABORT, 'financial allocation identity is immutable');
END;
