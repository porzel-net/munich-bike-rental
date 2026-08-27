-- Preserve the old expense rows as reviewable manual transactions before
-- removing the obsolete table. The old form had no account/category fields,
-- therefore cash_main is only a neutral source-account placeholder; the
-- transaction stays needs_review until an admin assigns the correct category.
INSERT INTO `financial_transactions` (
  `financial_account_id`,
  `source`,
  `provider`,
  `external_id`,
  `kind`,
  `status`,
  `amount_cents`,
  `gross_amount_cents`,
  `net_amount_cents`,
  `currency`,
  `booked_at`,
  `counterparty_name_snapshot`,
  `reference`,
  `description`,
  `provider_payload_json`,
  `metadata_json`,
  `imported_at`,
  `created_at`,
  `updated_at`
)
SELECT
  (SELECT `id` FROM `financial_accounts` WHERE `code` = 'cash_main'),
  'manual',
  'legacy_accounting_expense',
  'accounting-expense-' || `id`,
  'expense',
  'needs_review',
  -`sum_cents`,
  -`sum_cents`,
  -`sum_cents`,
  'EUR',
  COALESCE(`payment_date`, strftime('%Y-%m-%d', `created_at` / 1000, 'unixepoch')),
  `payee_name`,
  'accounting-expense-' || `id`,
  `description`,
  json_object('legacyAccountingExpenseId', `id`, 'depreciationDurationMonths', `depreciation_duration_months`),
  json_object(
    'legacyAccountingExpenseId', `id`,
    'createdBy', `created_by`,
    'depreciationDurationMonths', `depreciation_duration_months`,
    'migration', '0088_loving_cardiac'
  ),
  `created_at`,
  `created_at`,
  `updated_at`
FROM `accounting_expenses`
WHERE NOT EXISTS (
    SELECT 1
    FROM `financial_transactions` AS `existing`
    WHERE `existing`.`source` = 'manual'
      AND `existing`.`financial_account_id` = (SELECT `id` FROM `financial_accounts` WHERE `code` = 'cash_main')
      AND `existing`.`external_id` = 'accounting-expense-' || `accounting_expenses`.`id`
  );

--> statement-breakpoint
DROP TABLE `accounting_expenses`;
