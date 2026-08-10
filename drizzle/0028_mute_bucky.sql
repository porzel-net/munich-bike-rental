CREATE TABLE `accounting_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`account_type` text NOT NULL,
	`parent_code` text,
	`is_system` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounting_accounts_code_unique` ON `accounting_accounts` (`code`);--> statement-breakpoint
CREATE INDEX `accounting_accounts_type_active_idx` ON `accounting_accounts` (`account_type`,`is_active`);--> statement-breakpoint
CREATE TABLE `financial_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`provider` text,
	`provider_account_id` text,
	`opening_balance_cents` integer DEFAULT 0 NOT NULL,
	`opening_balance_date` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "financial_accounts_currency_check" CHECK(length("financial_accounts"."currency") = 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_accounts_code_unique` ON `financial_accounts` (`code`);--> statement-breakpoint
CREATE INDEX `financial_accounts_status_type_idx` ON `financial_accounts` (`status`,`type`);--> statement-breakpoint
CREATE TABLE `financial_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`category_type` text NOT NULL,
	`account_code` text NOT NULL,
	`parent_id` integer,
	`is_system` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `financial_categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_categories_code_unique` ON `financial_categories` (`code`);--> statement-breakpoint
CREATE INDEX `financial_categories_type_active_idx` ON `financial_categories` (`category_type`,`is_active`);--> statement-breakpoint
CREATE INDEX `financial_categories_parent_idx` ON `financial_categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `financial_counterparties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`display_name` text NOT NULL,
	`legal_name` text,
	`email` text,
	`phone` text,
	`iban_last4` text,
	`tax_number` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `financial_counterparties_name_idx` ON `financial_counterparties` (`display_name`);--> statement-breakpoint
CREATE TABLE `financial_document_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`transaction_id` integer,
	`allocation_id` integer,
	`journal_entry_id` integer,
	`booking_id` integer,
	`link_type` text DEFAULT 'evidence' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `financial_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `financial_transactions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`allocation_id`) REFERENCES `financial_transaction_allocations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "financial_document_links_target_check" CHECK("financial_document_links"."transaction_id" is not null or "financial_document_links"."allocation_id" is not null or "financial_document_links"."journal_entry_id" is not null or "financial_document_links"."booking_id" is not null)
);
--> statement-breakpoint
CREATE INDEX `financial_document_links_document_idx` ON `financial_document_links` (`document_id`);--> statement-breakpoint
CREATE INDEX `financial_document_links_transaction_idx` ON `financial_document_links` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `financial_document_links_booking_idx` ON `financial_document_links` (`booking_id`);--> statement-breakpoint
CREATE TABLE `financial_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_type` text NOT NULL,
	`original_file_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`document_date` text,
	`description` text DEFAULT '' NOT NULL,
	`uploaded_by_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "financial_documents_size_nonnegative" CHECK("financial_documents"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_documents_sha256_unique` ON `financial_documents` (`sha256`);--> statement-breakpoint
CREATE INDEX `financial_documents_date_idx` ON `financial_documents` (`document_date`);--> statement-breakpoint
CREATE TABLE `financial_reconciliation_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`external_id` text,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`expected_amount_cents` integer DEFAULT 0 NOT NULL,
	`actual_amount_cents` integer DEFAULT 0 NOT NULL,
	`difference_cents` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`matched_at` integer,
	`matched_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`matched_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "financial_reconciliation_groups_currency_check" CHECK(length("financial_reconciliation_groups"."currency") = 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_reconciliation_groups_kind_external_unique` ON `financial_reconciliation_groups` (`kind`,`external_id`);--> statement-breakpoint
CREATE INDEX `financial_reconciliation_groups_status_idx` ON `financial_reconciliation_groups` (`status`);--> statement-breakpoint
CREATE TABLE `financial_reconciliation_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`transaction_id` integer NOT NULL,
	`role` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `financial_reconciliation_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `financial_transactions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "financial_reconciliation_members_amount_nonzero" CHECK("financial_reconciliation_members"."amount_cents" <> 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_reconciliation_members_group_transaction_unique` ON `financial_reconciliation_members` (`group_id`,`transaction_id`);--> statement-breakpoint
CREATE INDEX `financial_reconciliation_members_transaction_idx` ON `financial_reconciliation_members` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `financial_transaction_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer NOT NULL,
	`booking_id` integer,
	`booking_requested_item_id` integer,
	`rental_asset_id` integer,
	`category_id` integer,
	`counterparty_id` integer,
	`destination_account_id` integer,
	`journal_entry_id` integer,
	`allocation_kind` text NOT NULL,
	`match_method` text DEFAULT 'unmatched' NOT NULL,
	`match_score` integer,
	`amount_cents` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`matched_by_user_id` text,
	`matched_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `financial_transactions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`booking_requested_item_id`) REFERENCES `booking_requested_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`rental_asset_id`) REFERENCES `rental_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `financial_categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`counterparty_id`) REFERENCES `financial_counterparties`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`destination_account_id`) REFERENCES `financial_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`matched_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "financial_transaction_allocations_amount_nonzero" CHECK("financial_transaction_allocations"."amount_cents" <> 0),
	CONSTRAINT "financial_transaction_allocations_target_check" CHECK("financial_transaction_allocations"."booking_id" is not null or "financial_transaction_allocations"."category_id" is not null or "financial_transaction_allocations"."destination_account_id" is not null)
);
--> statement-breakpoint
CREATE INDEX `financial_transaction_allocations_transaction_idx` ON `financial_transaction_allocations` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `financial_transaction_allocations_booking_idx` ON `financial_transaction_allocations` (`booking_id`);--> statement-breakpoint
CREATE INDEX `financial_transaction_allocations_category_idx` ON `financial_transaction_allocations` (`category_id`);--> statement-breakpoint
CREATE INDEX `financial_transaction_allocations_journal_idx` ON `financial_transaction_allocations` (`journal_entry_id`);--> statement-breakpoint
CREATE TABLE `financial_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`financial_account_id` integer NOT NULL,
	`source` text NOT NULL,
	`provider` text,
	`external_id` text,
	`external_parent_id` text,
	`kind` text DEFAULT 'other' NOT NULL,
	`status` text DEFAULT 'imported' NOT NULL,
	`amount_cents` integer NOT NULL,
	`gross_amount_cents` integer,
	`fee_amount_cents` integer,
	`net_amount_cents` integer,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`booked_at` text NOT NULL,
	`value_date` text,
	`counterparty_id` integer,
	`counterparty_name_snapshot` text,
	`counterparty_email_snapshot` text,
	`counterparty_iban_last4` text,
	`reference` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`bank_transaction_code` text,
	`provider_payload_json` text DEFAULT '{}' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`reconciled_at` integer,
	`reconciled_by_user_id` text,
	`imported_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`financial_account_id`) REFERENCES `financial_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`counterparty_id`) REFERENCES `financial_counterparties`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reconciled_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "financial_transactions_amount_nonzero" CHECK("financial_transactions"."amount_cents" <> 0),
	CONSTRAINT "financial_transactions_currency_check" CHECK(length("financial_transactions"."currency") = 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_transactions_source_account_external_unique` ON `financial_transactions` (`source`,`financial_account_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `financial_transactions_account_booked_idx` ON `financial_transactions` (`financial_account_id`,`booked_at`);--> statement-breakpoint
CREATE INDEX `financial_transactions_status_booked_idx` ON `financial_transactions` (`status`,`booked_at`);--> statement-breakpoint
CREATE INDEX `financial_transactions_kind_idx` ON `financial_transactions` (`kind`);--> statement-breakpoint
CREATE INDEX `financial_transactions_counterparty_idx` ON `financial_transactions` (`counterparty_id`);--> statement-breakpoint
ALTER TABLE `journal_entries` ADD `financial_transaction_id` integer;--> statement-breakpoint
CREATE INDEX `journal_entries_financial_transaction_idx` ON `journal_entries` (`financial_transaction_id`);
--> statement-breakpoint

-- Seed stable system accounts used by existing and future journal postings.
-- The user's real bank account is intentionally not guessed here and can be
-- configured later in financial_accounts.
INSERT OR IGNORE INTO `accounting_accounts`
  (`code`, `name`, `account_type`, `is_system`, `is_active`, `notes`, `created_at`, `updated_at`)
VALUES
  ('accounts_receivable', 'Forderungen aus Vermietung', 'asset', 1, 1, 'Offene Forderungen je Buchung', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('bank_or_cash', 'Bank / Kasse (Legacy)', 'asset', 1, 1, 'Bestehendes Sammelkonto für historische Buchungen', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('cash_on_hand', 'Bargeldbestand', 'asset', 1, 1, 'Bargeldkasse; Abhebungen sind zunächst Umbuchungen und noch kein Aufwand', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('stripe_clearing', 'Stripe-Verrechnungskonto', 'clearing', 1, 1, 'Bruttozahlungen, Gebühren und Auszahlungen von Stripe', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('rental_revenue', 'Mieterträge', 'revenue', 1, 1, 'Umsatz aus Fahrrad- und Zubehörvermietung', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('cancellation_fee_revenue', 'Stornogebühren', 'revenue', 1, 1, 'Erträge aus Stornogebühren', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('expense', 'Sonstige Aufwendungen', 'expense', 1, 1, 'Bestehendes Sammelkonto für historische Aufwendungen', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('stripe_fees', 'Stripe-Gebühren', 'expense', 1, 1, 'Gebühren des Zahlungsdienstleisters', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('bank_fees', 'Bankgebühren', 'expense', 1, 1, 'Gebühren des Bankkontos', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('tax_input', 'Vorsteuer', 'asset', 1, 1, 'Nur verwenden, wenn steuerlich konfiguriert', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('tax_output', 'Umsatzsteuer', 'liability', 1, 1, 'Nur verwenden, wenn steuerlich konfiguriert', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('unclassified', 'Ungeklärte Transaktionen', 'clearing', 1, 1, 'Temporäres Konto für noch nicht zugeordnete Bewegungen', strftime('%s','now') * 1000, strftime('%s','now') * 1000);
--> statement-breakpoint

INSERT OR IGNORE INTO `financial_accounts`
  (`code`, `name`, `type`, `status`, `currency`, `provider`, `opening_balance_cents`, `notes`, `created_at`, `updated_at`)
VALUES
  ('cash_main', 'Bargeldkasse', 'cash', 'active', 'EUR', 'internal', 0, 'Für Barabhebungen und spätere Barausgaben', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('stripe_main', 'Stripe-Verrechnungskonto', 'stripe_clearing', 'active', 'EUR', 'stripe', 0, 'Provider-Konto nach Einrichtung mit der Stripe-Konto-ID ergänzen', strftime('%s','now') * 1000, strftime('%s','now') * 1000);
--> statement-breakpoint

-- User-facing categories. They can later be renamed or extended without
-- changing the underlying journal account codes.
INSERT OR IGNORE INTO `financial_categories`
  (`code`, `name`, `category_type`, `account_code`, `is_system`, `is_active`, `notes`, `created_at`, `updated_at`)
VALUES
  ('rental_revenue', 'Fahrrad- und Zubehörvermietung', 'income', 'rental_revenue', 1, 1, '', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('cancellation_fee', 'Stornogebühren', 'income', 'cancellation_fee_revenue', 1, 1, '', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('stripe_fee', 'Stripe-Gebühren', 'fee', 'stripe_fees', 1, 1, '', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('bank_fee', 'Bankgebühren', 'fee', 'bank_fees', 1, 1, '', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('maintenance', 'Wartung und Reparaturen', 'expense', 'expense', 1, 1, '', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('bike_purchase', 'Fahrradanschaffung', 'expense', 'expense', 1, 1, '', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('accessory_purchase', 'Zubehör und Ersatzteile', 'expense', 'expense', 1, 1, '', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('insurance', 'Versicherungen', 'expense', 'expense', 1, 1, '', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('office', 'Büro und Verwaltung', 'expense', 'expense', 1, 1, '', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('travel', 'Fahrt- und Reisekosten', 'expense', 'expense', 1, 1, '', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('tax_payment', 'Steuerzahlungen', 'tax', 'tax_output', 1, 1, '', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('cash_withdrawal', 'Bargeldabhebung noch nicht verwendet', 'transfer', 'cash_on_hand', 1, 1, 'Bis zur Dokumentation einer Barausgabe kein Aufwand', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('unclassified', 'Noch zu klären', 'other', 'unclassified', 1, 1, 'Temporäre Kategorie für die Abstimmungs-Inbox', strftime('%s','now') * 1000, strftime('%s','now') * 1000);
