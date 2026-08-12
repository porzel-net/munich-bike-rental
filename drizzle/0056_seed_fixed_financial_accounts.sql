-- Keep the user-facing payment account choices stable across installations.
INSERT OR IGNORE INTO `financial_accounts`
  (`code`, `name`, `type`, `status`, `currency`, `provider`, `opening_balance_cents`, `notes`, `created_at`, `updated_at`)
VALUES
  ('operating_main', 'Betriebskonto Verleih', 'bank', 'active', 'EUR', 'nevlo', 0, 'Festes Zielkonto für alle Nevlo-Importe', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('private_main', 'Privat', 'other', 'active', 'EUR', 'internal', 0, 'Privates Gegenkonto für private Einlagen und Entnahmen', strftime('%s','now') * 1000, strftime('%s','now') * 1000);
