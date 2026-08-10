ALTER TABLE booking_offers ADD COLUMN total_cents integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE booking_offers ADD COLUMN price_snapshot_json text NOT NULL DEFAULT '{}';
--> statement-breakpoint

-- Existing offer versions did not retain a separate commercial snapshot. Their
-- last known booking total is the only historically available value.
UPDATE booking_offers
SET total_cents = COALESCE(
  (SELECT quoted_total_cents FROM bookings WHERE bookings.id = booking_offers.booking_id),
  0
)
WHERE total_cents = 0;
