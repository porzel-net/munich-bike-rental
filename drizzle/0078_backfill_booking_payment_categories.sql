-- Booking payments are EÜR-relevant rental revenue and must keep their
-- category alongside the booking-payment allocation kind.
UPDATE financial_transaction_allocations
SET category_id = (
  SELECT id
  FROM financial_categories
  WHERE code = 'rental_revenue'
)
WHERE allocation_kind = 'booking_payment'
  AND category_id IS NULL;
