ALTER TABLE `bookings` ADD `invoice_number` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `invoice_issued_at` integer;--> statement-breakpoint
WITH completed_bookings AS (
  SELECT
    id,
    printf(
      'YBR-%s-%04d',
      strftime('%Y', updated_at / 1000, 'unixepoch'),
      row_number() OVER (
        PARTITION BY strftime('%Y', updated_at / 1000, 'unixepoch')
        ORDER BY updated_at, id
      )
    ) AS generated_invoice_number,
    updated_at AS generated_invoice_issued_at
  FROM bookings
  WHERE status = 'completed'
)
UPDATE bookings
SET invoice_number = (SELECT generated_invoice_number FROM completed_bookings WHERE completed_bookings.id = bookings.id),
    invoice_issued_at = (SELECT generated_invoice_issued_at FROM completed_bookings WHERE completed_bookings.id = bookings.id)
WHERE status = 'completed';--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_invoice_number_unique` ON `bookings` (`invoice_number`);
