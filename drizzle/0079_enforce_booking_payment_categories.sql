-- Booking payments and refunds are EÜR rental revenue. Enforce the complete
-- domain relationship at the database boundary so future write paths cannot
-- create a booking allocation that the EÜR query cannot classify.
UPDATE `financial_transaction_allocations`
SET `category_id` = (
  SELECT `id`
  FROM `financial_categories`
  WHERE `code` = 'rental_revenue'
)
WHERE `allocation_kind` = 'booking_refund'
  AND `category_id` IS NULL;
--> statement-breakpoint
CREATE TRIGGER `financial_booking_payment_allocation_insert_check`
BEFORE INSERT ON `financial_transaction_allocations`
WHEN NEW.`allocation_kind` IN ('booking_payment', 'booking_refund')
  AND (
    NEW.`booking_id` IS NULL
    OR NEW.`category_id` IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM `financial_categories`
      WHERE `id` = NEW.`category_id`
        AND `code` = 'rental_revenue'
        AND `is_active` = 1
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'booking payment allocations require a booking and active rental_revenue category');
END;
--> statement-breakpoint
CREATE TRIGGER `financial_booking_payment_allocation_update_check`
BEFORE UPDATE OF `allocation_kind`, `booking_id`, `category_id` ON `financial_transaction_allocations`
WHEN NEW.`allocation_kind` IN ('booking_payment', 'booking_refund')
  AND (
    NEW.`booking_id` IS NULL
    OR NEW.`category_id` IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM `financial_categories`
      WHERE `id` = NEW.`category_id`
        AND `code` = 'rental_revenue'
        AND `is_active` = 1
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'booking payment allocations require a booking and active rental_revenue category');
END;
