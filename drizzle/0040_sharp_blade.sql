CREATE TABLE `admin_audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admin_audit_events_actor_created_idx` ON `admin_audit_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TRIGGER `admin_audit_events_append_only_update` BEFORE UPDATE ON `admin_audit_events` BEGIN SELECT RAISE(ABORT, 'admin_audit_events are append-only'); END;--> statement-breakpoint
CREATE TRIGGER `admin_audit_events_append_only_delete` BEFORE DELETE ON `admin_audit_events` BEGIN SELECT RAISE(ABORT, 'admin_audit_events are append-only'); END;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_booking_asset_allocations` (
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
	FOREIGN KEY (`asset_id`) REFERENCES `rental_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "booking_asset_allocations_period_order_check" CHECK("__new_booking_asset_allocations"."period_from" <= "__new_booking_asset_allocations"."period_to")
);
--> statement-breakpoint
INSERT INTO `__new_booking_asset_allocations`("id", "booking_id", "offer_id", "asset_id", "period_from", "period_to", "pickup_time", "dropoff_time", "released_at", "created_at") SELECT "id", "booking_id", "offer_id", "asset_id", "period_from", "period_to", "pickup_time", "dropoff_time", "released_at", "created_at" FROM `booking_asset_allocations`;--> statement-breakpoint
DROP TABLE `booking_asset_allocations`;--> statement-breakpoint
ALTER TABLE `__new_booking_asset_allocations` RENAME TO `booking_asset_allocations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `booking_asset_allocations_asset_period_idx` ON `booking_asset_allocations` (`asset_id`,`period_from`,`period_to`);--> statement-breakpoint
CREATE INDEX `booking_asset_allocations_booking_idx` ON `booking_asset_allocations` (`booking_id`);--> statement-breakpoint
CREATE TABLE `__new_bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legacy_inquiry_id` integer,
	`order_number` text NOT NULL,
	`assigned_user_id` text,
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
	`invoice_number` text,
	`invoice_issued_at` integer,
	`quoted_total_cents` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`assigned_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "bookings_location_check" CHECK("__new_bookings"."location" in ('munich', 'regensburg', 'lindau', 'friedrichshafen', 'konstanz')),
	CONSTRAINT "bookings_source_check" CHECK("__new_bookings"."source" in ('web', 'manual', 'legacy')),
	CONSTRAINT "bookings_status_check" CHECK("__new_bookings"."status" in ('inquiry_received', 'offer_sent', 'confirmed', 'checked_out', 'completed', 'rejected', 'cancelled', 'expired')),
	CONSTRAINT "bookings_locale_check" CHECK("__new_bookings"."communication_locale" in ('de', 'en')),
	CONSTRAINT "bookings_period_order_check" CHECK("__new_bookings"."period_from" <= "__new_bookings"."period_to"),
	CONSTRAINT "bookings_total_nonnegative" CHECK("__new_bookings"."quoted_total_cents" >= 0),
	CONSTRAINT "bookings_version_positive" CHECK("__new_bookings"."version" > 0)
);
--> statement-breakpoint
-- Normalize the German labels used by legacy bookings before applying the enum CHECK constraint.
INSERT INTO `__new_bookings`("id", "legacy_inquiry_id", "order_number", "assigned_user_id", "customer_name", "customer_email", "customer_phone", "location", "period_from", "period_to", "pickup_time", "dropoff_time", "customer_message", "communication_locale", "source", "status", "invoice_number", "invoice_issued_at", "quoted_total_cents", "version", "created_at", "updated_at") SELECT "id", "legacy_inquiry_id", "order_number", "assigned_user_id", "customer_name", "customer_email", "customer_phone", CASE "location" WHEN 'München' THEN 'munich' WHEN 'Regensburg' THEN 'regensburg' ELSE "location" END, "period_from", "period_to", "pickup_time", "dropoff_time", "customer_message", "communication_locale", "source", "status", "invoice_number", "invoice_issued_at", "quoted_total_cents", "version", "created_at", "updated_at" FROM `bookings`;--> statement-breakpoint
DROP TABLE `bookings`;--> statement-breakpoint
ALTER TABLE `__new_bookings` RENAME TO `bookings`;--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_legacy_inquiry_id_unique` ON `bookings` (`legacy_inquiry_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_order_number_unique` ON `bookings` (`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_invoice_number_unique` ON `bookings` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `bookings_assigned_user_idx` ON `bookings` (`assigned_user_id`);--> statement-breakpoint
CREATE INDEX `bookings_location_status_idx` ON `bookings` (`location`,`status`);--> statement-breakpoint
CREATE INDEX `bookings_created_at_idx` ON `bookings` (`created_at`);
