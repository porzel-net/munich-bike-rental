CREATE TABLE `accessory_inventory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location` text NOT NULL,
	`accessory_key` text NOT NULL,
	`category` text NOT NULL,
	`label_de` text NOT NULL,
	`label_en` text NOT NULL,
	`price_cents` integer NOT NULL,
	`available_quantity` integer DEFAULT 0 NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`legacy_equipment_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "accessory_inventory_price_nonnegative" CHECK("accessory_inventory"."price_cents" >= 0),
	CONSTRAINT "accessory_inventory_quantity_nonnegative" CHECK("accessory_inventory"."available_quantity" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accessory_inventory_legacy_equipment_id_unique` ON `accessory_inventory` (`legacy_equipment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `accessory_inventory_location_key_unique` ON `accessory_inventory` (`location`,`accessory_key`);--> statement-breakpoint
CREATE INDEX `accessory_inventory_location_state_idx` ON `accessory_inventory` (`location`,`state`);--> statement-breakpoint
CREATE TABLE `bike_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location` text NOT NULL,
	`model_key` text NOT NULL,
	`title` text NOT NULL,
	`description_de` text DEFAULT '' NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`image` text DEFAULT '/assets/img/svg/placeholder.svg' NOT NULL,
	`gallery_json` text DEFAULT '[]' NOT NULL,
	`facts_json` text DEFAULT '[]' NOT NULL,
	`equipment_json` text DEFAULT '{"de":[],"en":[]}' NOT NULL,
	`created_at` integer NOT NULL,
	`retired_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bike_models_location_key_unique` ON `bike_models` (`location`,`model_key`);--> statement-breakpoint
CREATE INDEX `bike_models_location_idx` ON `bike_models` (`location`);--> statement-breakpoint
CREATE TABLE `bike_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_id` integer NOT NULL,
	`size` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `bike_models`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bike_variants_model_size_unique` ON `bike_variants` (`model_id`,`size`);--> statement-breakpoint
CREATE TABLE `booking_asset_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`offer_id` integer NOT NULL,
	`asset_id` integer NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`pickup_time` text NOT NULL,
	`dropoff_time` text NOT NULL,
	`released_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`offer_id`) REFERENCES `booking_offers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`asset_id`) REFERENCES `rental_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `booking_asset_allocations_asset_period_idx` ON `booking_asset_allocations` (`asset_id`,`period_from`,`period_to`);--> statement-breakpoint
CREATE INDEX `booking_asset_allocations_booking_idx` ON `booking_asset_allocations` (`booking_id`);--> statement-breakpoint
CREATE TABLE `booking_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`actor_user_id` text,
	`reason` text,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `booking_events_booking_occurred_idx` ON `booking_events` (`booking_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `booking_offer_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`offer_id` integer NOT NULL,
	`requested_item_id` integer NOT NULL,
	`asset_id` integer NOT NULL,
	`item_price_cents` integer NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `booking_offers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`requested_item_id`) REFERENCES `booking_requested_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`asset_id`) REFERENCES `rental_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "booking_offer_items_price_nonnegative" CHECK("booking_offer_items"."item_price_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_offer_items_offer_requested_unique` ON `booking_offer_items` (`offer_id`,`requested_item_id`);--> statement-breakpoint
CREATE INDEX `booking_offer_items_asset_idx` ON `booking_offer_items` (`asset_id`);--> statement-breakpoint
CREATE TABLE `booking_offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`offer_number` integer NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`sent_at` integer,
	`accepted_at` integer,
	`revoked_at` integer,
	`replaces_offer_id` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_offers_booking_number_unique` ON `booking_offers` (`booking_id`,`offer_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_offers_token_hash_unique` ON `booking_offers` (`token_hash`);--> statement-breakpoint
CREATE INDEX `booking_offers_booking_status_idx` ON `booking_offers` (`booking_id`,`status`);--> statement-breakpoint
CREATE INDEX `booking_offers_expiry_idx` ON `booking_offers` (`expires_at`);--> statement-breakpoint
CREATE TABLE `booking_requested_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`position` integer NOT NULL,
	`requested_label` text NOT NULL,
	`height_cm` integer NOT NULL,
	`needs_pedals` integer NOT NULL,
	`pedal_type` text,
	`needs_computer_mount` integer NOT NULL,
	`computer_mount_type` text,
	`needs_helmet` integer NOT NULL,
	`needs_clothing` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_requested_items_position_unique` ON `booking_requested_items` (`booking_id`,`position`);--> statement-breakpoint
CREATE INDEX `booking_requested_items_booking_idx` ON `booking_requested_items` (`booking_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legacy_inquiry_id` integer,
	`order_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_phone` text NOT NULL,
	`location` text NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`pickup_time` text NOT NULL,
	`dropoff_time` text NOT NULL,
	`customer_message` text DEFAULT '' NOT NULL,
	`communication_locale` text DEFAULT 'de' NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'inquiry_received' NOT NULL,
	`quoted_total_cents` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "bookings_total_nonnegative" CHECK("bookings"."quoted_total_cents" >= 0),
	CONSTRAINT "bookings_version_positive" CHECK("bookings"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_legacy_inquiry_id_unique` ON `bookings` (`legacy_inquiry_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_order_number_unique` ON `bookings` (`order_number`);--> statement-breakpoint
CREATE INDEX `bookings_location_status_idx` ON `bookings` (`location`,`status`);--> statement-breakpoint
CREATE INDEX `bookings_created_at_idx` ON `bookings` (`created_at`);--> statement-breakpoint
CREATE TABLE `communication_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`direction` text NOT NULL,
	`rfc_message_id` text,
	`in_reply_to` text,
	`sender` text NOT NULL,
	`recipients` text NOT NULL,
	`subject` text NOT NULL,
	`plain_text` text NOT NULL,
	`sent_at` integer NOT NULL,
	`archived_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `communication_messages_rfc_message_unique` ON `communication_messages` (`rfc_message_id`);--> statement-breakpoint
CREATE INDEX `communication_messages_booking_sent_idx` ON `communication_messages` (`booking_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer,
	`kind` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`reverses_entry_id` integer,
	`actor_user_id` text,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `journal_entries_booking_occurred_idx` ON `journal_entries` (`booking_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `journal_entries_reversal_idx` ON `journal_entries` (`reverses_entry_id`);--> statement-breakpoint
CREATE TABLE `journal_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`account` text NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "journal_lines_nonzero" CHECK("journal_lines"."amount_cents" <> 0)
);
--> statement-breakpoint
CREATE INDEX `journal_lines_entry_idx` ON `journal_lines` (`entry_id`);--> statement-breakpoint
CREATE TABLE `mail_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`offer_id` integer,
	`idempotency_key` text NOT NULL,
	`kind` text NOT NULL,
	`locale` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`plain_text` text NOT NULL,
	`in_reply_to` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`leased_at` integer,
	`sent_at` integer,
	`provider_message_id` text,
	`last_error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`offer_id`) REFERENCES `booking_offers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mail_outbox_idempotency_unique` ON `mail_outbox` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `mail_outbox_status_due_idx` ON `mail_outbox` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `rental_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variant_id` integer NOT NULL,
	`location` text NOT NULL,
	`asset_code` text NOT NULL,
	`display_name` text NOT NULL,
	`daily_price_cents` integer NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`legacy_location_bike_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `bike_variants`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "rental_assets_daily_price_nonnegative" CHECK("rental_assets"."daily_price_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_assets_legacy_location_bike_id_unique` ON `rental_assets` (`legacy_location_bike_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rental_assets_location_code_unique` ON `rental_assets` (`location`,`asset_code`);--> statement-breakpoint
CREATE INDEX `rental_assets_location_state_idx` ON `rental_assets` (`location`,`state`);
--> statement-breakpoint
-- The pre-existing tables intentionally remain untouched as a read-only archive.  The
-- copy below is idempotent, so a restored backup can safely be migrated again.
INSERT OR IGNORE INTO `bike_models` (`location`,`model_key`,`title`,`description_de`,`description_en`,`image`,`gallery_json`,`facts_json`,`equipment_json`,`created_at`)
SELECT `location`, 'legacy-' || `id`, `title`, `description_de`, `description_en`, `image`, `gallery_json`, `facts_json`, `equipment_json`, CAST(strftime('%s','now') AS INTEGER) * 1000
FROM `rental_location_bikes`;
--> statement-breakpoint
INSERT OR IGNORE INTO `bike_variants` (`model_id`,`size`,`created_at`)
SELECT m.`id`, COALESCE(s.`size`, 'Standard'), CAST(strftime('%s','now') AS INTEGER) * 1000
FROM `rental_location_bikes` b
JOIN `bike_models` m ON m.`location` = b.`location` AND m.`model_key` = 'legacy-' || b.`id`
LEFT JOIN `rental_location_bike_sizes` s ON s.`location_bike_id` = b.`id`;
--> statement-breakpoint
INSERT OR IGNORE INTO `rental_assets` (`variant_id`,`location`,`asset_code`,`display_name`,`daily_price_cents`,`state`,`legacy_location_bike_id`,`created_at`,`updated_at`)
SELECT v.`id`, b.`location`, 'legacy-' || b.`id`, b.`title` || CASE WHEN s.`size` IS NULL THEN '' ELSE ' - ' || s.`size` END,
       b.`price_cents_per_day`, CASE WHEN b.`is_available` = 1 THEN 'active' ELSE 'maintenance' END, b.`id`,
       CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000
FROM `rental_location_bikes` b
JOIN `bike_models` m ON m.`location` = b.`location` AND m.`model_key` = 'legacy-' || b.`id`
JOIN `bike_variants` v ON v.`model_id` = m.`id`
LEFT JOIN `rental_location_bike_sizes` s ON s.`location_bike_id` = b.`id` AND v.`size` = s.`size`;
--> statement-breakpoint
INSERT OR IGNORE INTO `accessory_inventory` (`location`,`accessory_key`,`category`,`label_de`,`label_en`,`price_cents`,`available_quantity`,`state`,`legacy_equipment_id`,`created_at`,`updated_at`)
SELECT `location`, `equipment_key`, `category`, `label_de`, `label_en`, `price_cents`, CASE WHEN `is_available` = 1 THEN 1 ELSE 0 END,
       CASE WHEN `is_available` = 1 THEN 'active' ELSE 'maintenance' END, `id`, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000
FROM `rental_location_equipment`;
--> statement-breakpoint
INSERT OR IGNORE INTO `bookings` (`id`,`legacy_inquiry_id`,`order_number`,`customer_name`,`customer_email`,`customer_phone`,`location`,`period_from`,`period_to`,`pickup_time`,`dropoff_time`,`customer_message`,`communication_locale`,`source`,`status`,`quoted_total_cents`,`created_at`,`updated_at`)
SELECT i.`id`, i.`id`, i.`order_number`, i.`name`, i.`email`, i.`phone`, i.`location`, i.`period_from`, i.`period_to`, i.`pickup_time`, i.`dropoff_time`, i.`message`, i.`locale`,
       CASE WHEN i.`source` = 'manual' THEN 'manual' ELSE 'web' END,
       CASE i.`status` WHEN 'unanswered' THEN 'inquiry_received' WHEN 'pending' THEN 'offer_sent' WHEN 'confirmed' THEN 'confirmed' WHEN 'executed' THEN 'completed' WHEN 'rejected' THEN 'rejected' WHEN 'cancelled' THEN 'cancelled' ELSE 'inquiry_received' END,
       i.`total_price_cents`, i.`submitted_at`, i.`submitted_at`
FROM `rental_inquiries` i;
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_requested_items` (`booking_id`,`position`,`requested_label`,`height_cm`,`needs_pedals`,`pedal_type`,`needs_computer_mount`,`computer_mount_type`,`needs_helmet`,`needs_clothing`)
SELECT b.`id`, i.`position`, i.`bike_size`, i.`height_cm`, i.`needs_pedals`, i.`pedal_type`, i.`needs_computer_mount`, i.`computer_mount_type`, i.`needs_helmet`, i.`needs_clothing`
FROM `rental_inquiry_bikes` i JOIN `bookings` b ON b.`legacy_inquiry_id` = i.`inquiry_id`;
--> statement-breakpoint
INSERT INTO `booking_events` (`booking_id`,`event_type`,`to_status`,`reason`,`payload_json`,`occurred_at`)
SELECT b.`id`, 'legacy_import', b.`status`, 'Historische Buchung migriert', json_object('legacyInquiryId', b.`legacy_inquiry_id`), b.`created_at`
FROM `bookings` b WHERE NOT EXISTS (SELECT 1 FROM `booking_events` e WHERE e.`booking_id` = b.`id` AND e.`event_type` = 'legacy_import');
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_offers` (`booking_id`,`offer_number`,`status`,`token_hash`,`expires_at`,`sent_at`,`accepted_at`,`created_at`)
SELECT b.`id`, 1,
       CASE WHEN b.`status` IN ('confirmed','checked_out','completed') THEN 'accepted' WHEN b.`status` = 'expired' THEN 'expired' ELSE 'sent' END,
       COALESCE((SELECT t.`token_hash` FROM `rental_booking_confirmation_tokens` t WHERE t.`inquiry_id` = b.`legacy_inquiry_id` ORDER BY t.`created_at` DESC LIMIT 1), 'legacy-offer-' || b.`id`),
       COALESCE((SELECT t.`expires_at` FROM `rental_booking_confirmation_tokens` t WHERE t.`inquiry_id` = b.`legacy_inquiry_id` ORDER BY t.`created_at` DESC LIMIT 1), b.`created_at` + 86400000),
       b.`created_at`, CASE WHEN b.`status` IN ('confirmed','checked_out','completed') THEN b.`created_at` END, b.`created_at`
FROM `bookings` b WHERE b.`status` IN ('offer_sent','confirmed','checked_out','completed');
--> statement-breakpoint
INSERT OR IGNORE INTO `communication_messages` (`booking_id`,`direction`,`rfc_message_id`,`sender`,`recipients`,`subject`,`plain_text`,`sent_at`,`archived_at`)
SELECT b.`id`, 'outbound', a.`message_id`, 'system', i.`email`,
       'Historische ' || a.`action`, 'Historische Mailaktion: ' || a.`action`, a.`sent_at`, a.`sent_at`
FROM `rental_inquiry_mail_actions` a JOIN `rental_inquiries` i ON i.`id` = a.`inquiry_id` JOIN `bookings` b ON b.`legacy_inquiry_id` = i.`id`;
