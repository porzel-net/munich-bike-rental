-- Store separate weekday and weekend prices for every catalog bike and booking asset.
-- The legacy single daily price remains synchronized to the weekday price.
ALTER TABLE rental_location_bikes ADD COLUMN weekday_price_cents_per_day INTEGER NOT NULL DEFAULT 4900;
--> statement-breakpoint
ALTER TABLE rental_location_bikes ADD COLUMN weekend_price_cents_per_day INTEGER NOT NULL DEFAULT 6900;
--> statement-breakpoint
ALTER TABLE rental_assets ADD COLUMN weekday_price_cents INTEGER NOT NULL DEFAULT 4900;
--> statement-breakpoint
ALTER TABLE rental_assets ADD COLUMN weekend_price_cents INTEGER NOT NULL DEFAULT 6900;
--> statement-breakpoint
UPDATE rental_location_bikes
SET price_cents_per_day = 4900,
    weekday_price_cents_per_day = 4900,
    weekend_price_cents_per_day = 6900;
--> statement-breakpoint
UPDATE rental_assets
SET daily_price_cents = 4900,
    weekday_price_cents = 4900,
    weekend_price_cents = 6900;
--> statement-breakpoint
DELETE FROM rental_location_discounts;
--> statement-breakpoint
INSERT INTO rental_location_discounts
  (location, discount_key, label_de, label_en, percentage, minimum_rental_days, display_order, requires_student)
VALUES
  ('munich', 'long-term', 'Ab 3 Tagen', 'From 3 days', 15, 3, 1, 0),
  ('munich', 'student', 'Studentenrabatt', 'Student discount', 10, NULL, 2, 1),
  ('regensburg', 'long-term', 'Ab 3 Tagen', 'From 3 days', 15, 3, 1, 0),
  ('regensburg', 'student', 'Studentenrabatt', 'Student discount', 10, NULL, 2, 1),
  ('lindau', 'long-term', 'Ab 3 Tagen', 'From 3 days', 15, 3, 1, 0),
  ('lindau', 'student', 'Studentenrabatt', 'Student discount', 10, NULL, 2, 1),
  ('friedrichshafen', 'long-term', 'Ab 3 Tagen', 'From 3 days', 15, 3, 1, 0),
  ('friedrichshafen', 'student', 'Studentenrabatt', 'Student discount', 10, NULL, 2, 1),
  ('konstanz', 'long-term', 'Ab 3 Tagen', 'From 3 days', 15, 3, 1, 0),
  ('konstanz', 'student', 'Studentenrabatt', 'Student discount', 10, NULL, 2, 1);
