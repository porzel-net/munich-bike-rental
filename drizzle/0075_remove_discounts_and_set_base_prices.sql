-- Remove the public rental discounts and align every location to the new
-- starting price. The discount table remains available for future catalog
-- changes, but no active discount rows remain.
DELETE FROM rental_location_discounts;
--> statement-breakpoint
UPDATE rental_location_bikes
SET price_cents_per_day = 4900;
