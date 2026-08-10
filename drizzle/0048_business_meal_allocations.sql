INSERT OR IGNORE INTO `accounting_accounts`
  (`code`, `name`, `account_type`, `is_system`, `is_active`, `notes`, `created_at`, `updated_at`)
VALUES
  ('private_withdrawal', 'Privatentnahmen / private Anteile', 'equity', 1, 1, 'Private Anteile von betrieblich bezahlten Vorgängen.', strftime('%s','now') * 1000, strftime('%s','now') * 1000);
--> statement-breakpoint

INSERT OR IGNORE INTO `financial_categories`
  (`code`, `name`, `category_type`, `account_code`, `euer_treatment`, `euer_line`, `is_system`, `is_active`, `notes`, `created_at`, `updated_at`)
VALUES
  ('business_meal', 'Geschäftsessen / Bewirtungskosten', 'expense', 'expense', 'expense', 'other_operating_expense', 1, 1, 'Angemessene geschäftliche Bewirtung; die Anwendung teilt automatisch in 70 % abzugsfähig und 30 % nicht abzugsfähig.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('business_meal_non_deductible', 'Bewirtungskosten nicht abzugsfähig', 'other', 'private_withdrawal', 'excluded', 'not_applicable', 1, 1, '30-%-Anteil geschäftlicher Bewirtung; nicht als EÜR-Betriebsausgabe abziehbar.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('private_meal_share', 'Privatanteil Geschäftsessen', 'other', 'private_withdrawal', 'excluded', 'not_applicable', 1, 1, 'Privat veranlasster Anteil; nicht EÜR-relevant und als Privatentnahme dokumentiert.', strftime('%s','now') * 1000, strftime('%s','now') * 1000);
