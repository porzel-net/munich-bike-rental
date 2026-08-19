-- Manually entered, already posted transactions may be moved to another
-- financial account. Imported transaction source data remains immutable.
DROP TRIGGER `financial_transactions_immutable_fields_update`;
--> statement-breakpoint
CREATE TRIGGER `financial_transactions_immutable_fields_update`
BEFORE UPDATE ON `financial_transactions`
WHEN (
  OLD.`financial_account_id` IS NOT NEW.`financial_account_id`
  AND NOT (OLD.`source` IN ('cash', 'manual') AND OLD.`status` = 'posted')
)
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
