-- Restore only the discounts that remain part of the public pricing model:
-- 15% from three rental days and the existing 10% student discount.
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
