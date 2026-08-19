-- Persist the per-bike insurance protection choice from the landing-page
-- inquiry form. Existing and imported bookings keep the protected default.
ALTER TABLE rental_inquiry_bikes
ADD COLUMN insurance_protection_selected INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE booking_requested_items
ADD COLUMN insurance_protection_selected INTEGER NOT NULL DEFAULT 1;
