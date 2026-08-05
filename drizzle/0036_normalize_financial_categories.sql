-- Normalize legacy categories that were created before the EÜR mapping was
-- persisted. The UI only offers categories with a concrete EÜR treatment.
UPDATE `financial_categories`
SET `euer_treatment` = 'income', `euer_line` = 'rental_income', `updated_at` = strftime('%s','now') * 1000
WHERE `code` = 'rental_revenue';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'income', `euer_line` = 'other_operating_income', `updated_at` = strftime('%s','now') * 1000
WHERE `code` = 'cancellation_fee';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'other_operating_expense', `updated_at` = strftime('%s','now') * 1000
WHERE `code` IN ('stripe_fee', 'bank_fee');
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'office', `updated_at` = strftime('%s','now') * 1000
WHERE `code` = 'office';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'repairs', `updated_at` = strftime('%s','now') * 1000
WHERE `code` IN ('maintenance', 'spare_parts_consumables');
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'insurance', `updated_at` = strftime('%s','now') * 1000
WHERE `code` = 'insurance';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'travel', `updated_at` = strftime('%s','now') * 1000
WHERE `code` = 'travel';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'advertising', `updated_at` = strftime('%s','now') * 1000
WHERE `code` IN ('advertising');
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'services', `updated_at` = strftime('%s','now') * 1000
WHERE `code` IN ('professional_services');
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'rent', `updated_at` = strftime('%s','now') * 1000
WHERE `code` IN ('rent_storage');
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'wages', `updated_at` = strftime('%s','now') * 1000
WHERE `code` IN ('wages');
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'depreciation', `updated_at` = strftime('%s','now') * 1000
WHERE `code` IN ('depreciation');
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'asset_acquisition', `euer_line` = 'asset_acquisition', `updated_at` = strftime('%s','now') * 1000
WHERE `code` IN ('bike_purchase', 'equipment_asset_purchase');
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'tax_payment', `euer_line` = 'vat', `updated_at` = strftime('%s','now') * 1000
WHERE `code` = 'vat_payment';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'input_vat', `euer_line` = 'vat', `updated_at` = strftime('%s','now') * 1000
WHERE `code` = 'input_vat';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'output_vat', `euer_line` = 'vat', `updated_at` = strftime('%s','now') * 1000
WHERE `code` = 'output_vat';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'excluded', `euer_line` = 'not_applicable', `updated_at` = strftime('%s','now') * 1000
WHERE `code` IN ('tax_payment', 'income_tax_payment', 'trade_tax_payment', 'private_payment');
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'transfer', `euer_line` = 'not_applicable', `updated_at` = strftime('%s','now') * 1000
WHERE `code` IN ('cash_withdrawal', 'internal_transfer');
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'needs_review', `euer_line` = 'not_applicable', `updated_at` = strftime('%s','now') * 1000
WHERE `code` IN ('accessory_purchase', 'unclassified');
--> statement-breakpoint

INSERT OR IGNORE INTO `financial_categories`
  (`code`, `name`, `category_type`, `account_code`, `euer_treatment`, `euer_line`, `is_system`, `is_active`, `notes`, `created_at`, `updated_at`)
VALUES
  ('other_operating_income', 'Sonstige Betriebseinnahmen', 'income', 'rental_revenue', 'income', 'other_operating_income', 1, 1, 'Sonstige betriebliche Einnahmen.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('rent_storage', 'Miete und Lager', 'expense', 'expense', 'expense', 'rent', 1, 1, 'Miete für Lager, Werkstatt oder Abholstation.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('professional_services', 'Fremdleistungen und Beratung', 'expense', 'expense', 'expense', 'services', 1, 1, 'Steuerberatung, Rechtsberatung und Fremdleistungen.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('advertising', 'Werbung und Marketing', 'expense', 'expense', 'expense', 'advertising', 1, 1, 'Werbung und Marketing.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('wages', 'Löhne und Gehälter', 'expense', 'expense', 'expense', 'wages', 1, 1, 'Bruttolöhne, Gehälter und Arbeitgeberanteile.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('depreciation', 'Abschreibungen (AfA)', 'expense', 'expense', 'expense', 'depreciation', 1, 1, 'Jährliche Abschreibungen aus dem Anlageverzeichnis.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('spare_parts_consumables', 'Ersatzteile und Verbrauchsmaterial', 'expense', 'expense', 'expense', 'repairs', 1, 1, 'Laufende Ersatzteile und Verbrauchsmaterial.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('equipment_asset_purchase', 'Betriebsausstattung und Anlagegüter', 'expense', 'expense', 'asset_acquisition', 'asset_acquisition', 1, 1, 'Anschaffungen, die im Anlageverzeichnis geprüft werden müssen.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('vat_payment', 'Umsatzsteuerzahlung an Finanzamt', 'tax', 'tax_output', 'tax_payment', 'vat', 1, 1, 'An das Finanzamt gezahlte Umsatzsteuer.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('input_vat', 'Abziehbare Vorsteuer', 'tax', 'tax_input', 'input_vat', 'vat', 1, 1, 'Abziehbare Vorsteuerbeträge.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('output_vat', 'Vereinnahmte Umsatzsteuer', 'tax', 'tax_output', 'output_vat', 'vat', 1, 1, 'Vereinnahmte Umsatzsteuer.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('income_tax_payment', 'Einkommensteuer und Solidaritätszuschlag', 'tax', 'tax_output', 'excluded', 'not_applicable', 1, 1, 'Nicht als Betriebsausgabe abziehbar.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('trade_tax_payment', 'Gewerbesteuer', 'tax', 'tax_output', 'excluded', 'not_applicable', 1, 1, 'Nicht als Betriebsausgabe abziehbar.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('internal_transfer', 'Interne Umbuchung / Stripe-Auszahlung', 'transfer', 'stripe_clearing', 'transfer', 'not_applicable', 1, 1, 'Umbuchung zwischen eigenen Konten.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('private_payment', 'Privat veranlasste Zahlung', 'other', 'unclassified', 'excluded', 'not_applicable', 1, 1, 'Nicht betrieblich veranlasst.', strftime('%s','now') * 1000, strftime('%s','now') * 1000);
