ALTER TABLE `financial_categories` ADD `euer_treatment` text DEFAULT 'needs_review' NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_categories` ADD `euer_line` text DEFAULT 'not_applicable' NOT NULL;
--> statement-breakpoint

UPDATE `financial_categories`
SET `euer_treatment` = 'income', `euer_line` = 'rental_income'
WHERE `code` = 'rental_revenue';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'income', `euer_line` = 'other_operating_income'
WHERE `code` = 'cancellation_fee';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'other_operating_expense'
WHERE `code` IN ('stripe_fee', 'bank_fee', 'office');
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'repairs'
WHERE `code` = 'maintenance';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'asset_acquisition', `euer_line` = 'asset_acquisition',
    `notes` = 'Nicht direkt als EÜR-Aufwand buchen; in Anlageverzeichnis und AfA übernehmen.'
WHERE `code` = 'bike_purchase';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'needs_review', `euer_line` = 'not_applicable',
    `notes` = 'Je nach Gegenstand als Ersatzteil/Aufwand, GWG oder Anlagegut zu prüfen.'
WHERE `code` = 'accessory_purchase';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'expense', `euer_line` = 'insurance'
WHERE `code` = 'insurance';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'excluded', `euer_line` = 'not_applicable',
    `notes` = 'Steuerzahlung bzw. interne Bewegung; nicht als normale EÜR-Betriebsausgabe behandeln.'
WHERE `code` = 'tax_payment';
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'transfer', `euer_line` = 'not_applicable',
    `notes` = 'Umbuchung zwischen eigenen Konten; niemals als EÜR-Einnahme oder EÜR-Ausgabe.'
WHERE `code` = 'cash_withdrawal';
--> statement-breakpoint

INSERT OR IGNORE INTO `financial_categories`
  (`code`, `name`, `category_type`, `account_code`, `euer_treatment`, `euer_line`, `is_system`, `is_active`, `notes`, `created_at`, `updated_at`)
VALUES
  ('other_operating_income', 'Sonstige Betriebseinnahmen', 'income', 'rental_revenue', 'income', 'other_operating_income', 1, 1, 'Sonstige betriebliche Einnahmen, die nicht direkt aus der Fahrradvermietung stammen.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('rent_storage', 'Miete und Lager', 'expense', 'expense', 'expense', 'rent', 1, 1, 'Miete für Lager, Werkstatt oder Abholstation.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('professional_services', 'Fremdleistungen und Beratung', 'expense', 'expense', 'expense', 'services', 1, 1, 'Steuerberatung, Rechtsberatung, freie Mitarbeit und sonstige Fremdleistungen.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('advertising', 'Werbung und Marketing', 'expense', 'expense', 'expense', 'advertising', 1, 1, 'Werbung, Marketing, Fotos, Drucksachen und Vermittlungsprovisionen.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('wages', 'Löhne und Gehälter', 'expense', 'expense', 'expense', 'wages', 1, 1, 'Bruttolöhne, Gehälter und Arbeitgeberanteile.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('depreciation', 'Abschreibungen (AfA)', 'expense', 'expense', 'expense', 'depreciation', 1, 1, 'Jährliche AfA aus dem Anlageverzeichnis; kein Zahlungsabfluss.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('spare_parts_consumables', 'Ersatzteile und Verbrauchsmaterial', 'expense', 'expense', 'expense', 'repairs', 1, 1, 'Laufende Ersatzteile, Reinigungsmittel und Verbrauchsmaterial.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('equipment_asset_purchase', 'Betriebsausstattung und Anlagegüter', 'expense', 'expense', 'asset_acquisition', 'asset_acquisition', 1, 1, 'Nicht direkt als EÜR-Aufwand buchen; je Wirtschaftsgut GWG, Sammelposten oder AfA prüfen.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('vat_payment', 'Umsatzsteuerzahlung an Finanzamt', 'tax', 'tax_output', 'tax_payment', 'vat', 1, 1, 'Separat von Einkommensteuer und Gewerbesteuer; EÜR-Zuordnung nach Umsatzsteuerstatus.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('input_vat', 'Abziehbare Vorsteuer', 'tax', 'tax_input', 'input_vat', 'vat', 1, 1, 'Vorsteuer wird separat ausgewiesen und nicht als normale Betriebsausgabe gebucht.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('output_vat', 'Vereinnahmte Umsatzsteuer', 'tax', 'tax_output', 'output_vat', 'vat', 1, 1, 'Umsatzsteuer ist keine Betriebseinnahme im eigentlichen Sinn und wird separat ausgewiesen.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('income_tax_payment', 'Einkommensteuer und Solidaritätszuschlag', 'tax', 'tax_output', 'excluded', 'not_applicable', 1, 1, 'Privat bzw. nicht als Betriebsausgabe abziehbar.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('trade_tax_payment', 'Gewerbesteuer', 'tax', 'tax_output', 'excluded', 'not_applicable', 1, 1, 'Nicht als Betriebsausgabe für die Einkommensteuer abziehbar.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('internal_transfer', 'Interne Umbuchung / Stripe-Auszahlung', 'transfer', 'stripe_clearing', 'transfer', 'not_applicable', 1, 1, 'Umbuchung zwischen eigenen Konten; erscheint nicht in der EÜR.', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('private_payment', 'Privat veranlasste Zahlung', 'other', 'unclassified', 'excluded', 'not_applicable', 1, 1, 'Nicht betrieblich veranlasst; getrennt dokumentieren.', strftime('%s','now') * 1000, strftime('%s','now') * 1000);
--> statement-breakpoint
UPDATE `financial_categories`
SET `euer_treatment` = 'needs_review', `euer_line` = 'not_applicable'
WHERE `code` = 'unclassified';
