-- Confirmed bookings already represent binding customer transactions and need
-- the same invoice number format as completed bookings.
WITH missing_confirmed AS (
  SELECT
    id,
    strftime('%Y', updated_at / 1000, 'unixepoch') AS invoice_year,
    updated_at,
    row_number() OVER (
      PARTITION BY strftime('%Y', updated_at / 1000, 'unixepoch')
      ORDER BY updated_at, id
    ) AS sequence_in_missing
  FROM bookings
  WHERE status IN ('confirmed', 'completed') AND invoice_number IS NULL
), generated AS (
  SELECT
    missing_confirmed.id,
    printf(
      'YBR-%s-%04d',
      missing_confirmed.invoice_year,
      COALESCE(
        (
          SELECT MAX(CAST(substr(existing.invoice_number, 10) AS INTEGER))
          FROM bookings AS existing
          WHERE existing.invoice_number LIKE 'YBR-' || missing_confirmed.invoice_year || '-%'
        ),
        0
      ) + missing_confirmed.sequence_in_missing
    ) AS invoice_number,
    missing_confirmed.updated_at AS invoice_issued_at
  FROM missing_confirmed
)
UPDATE bookings
SET invoice_number = (SELECT generated.invoice_number FROM generated WHERE generated.id = bookings.id),
    invoice_issued_at = (SELECT generated.invoice_issued_at FROM generated WHERE generated.id = bookings.id)
WHERE id IN (SELECT id FROM generated);
