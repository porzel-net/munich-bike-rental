-- A repayment of an earlier rental receipt is a negative operating receipt,
-- not a new operating expense. Keep it selectable for imported bank debits.
INSERT OR IGNORE INTO `financial_categories`
  (`code`, `name`, `category_type`, `account_code`, `euer_treatment`, `euer_line`, `is_system`, `is_active`, `notes`, `created_at`, `updated_at`)
VALUES
  ('refund', 'Rückerstattung von Mieterträgen', 'income', 'rental_revenue', 'income', 'rental_income', 1, 1,
   'Rückzahlung einer bereits vereinnahmten Mieterzahlung; wird in der EÜR als negative Einnahme erfasst.',
   strftime('%s','now') * 1000, strftime('%s','now') * 1000);
