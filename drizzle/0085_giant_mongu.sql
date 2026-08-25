DROP TABLE `rental_booking_confirmation_tokens`;--> statement-breakpoint
DROP TABLE `rental_inquiries`;--> statement-breakpoint
DROP TABLE `rental_inquiry_bikes`;--> statement-breakpoint
DROP TABLE `rental_inquiry_mail_actions`;--> statement-breakpoint
DROP TABLE `rental_location_equipment`;--> statement-breakpoint
DROP TABLE `accounting_revenue_payments`;--> statement-breakpoint
DROP TABLE `accounting_revenues`;--> statement-breakpoint
DROP INDEX `accessory_inventory_legacy_equipment_id_unique`;--> statement-breakpoint
ALTER TABLE `accessory_inventory` DROP COLUMN `legacy_equipment_id`;--> statement-breakpoint
ALTER TABLE `booking_offers` ADD `stripe_session_id` text;--> statement-breakpoint
ALTER TABLE `booking_offers` ADD `stripe_payment_intent_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `booking_offers_stripe_session_unique` ON `booking_offers` (`stripe_session_id`);