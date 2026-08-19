-- Booking payments were historically posted directly to rental revenue when
-- the booking had no receivable yet. If the rental charge was created later,
-- that produced both a duplicate revenue entry and an open receivable.
-- Reclassify those immutable historical payments against receivables. The
-- idempotency key makes this safe if migration recovery is ever retried.
INSERT INTO `journal_entries`
  (`booking_id`, `financial_transaction_id`, `kind`, `reason`, `idempotency_key`,
   `reverses_entry_id`, `actor_user_id`, `due_at`, `occurred_at`, `created_at`)
SELECT DISTINCT
  payment.`booking_id`,
  payment.`financial_transaction_id`,
  'correction',
  'Zeitversetzte Zahlungszuordnung: Zahlung gegen Forderung umgebucht',
  'booking_payment_ar_reclassification:' || payment.`id`,
  NULL,
  NULL,
  NULL,
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000
FROM `journal_entries` payment
JOIN `financial_transaction_allocations` allocation
  ON allocation.`journal_entry_id` = payment.`id`
 AND allocation.`booking_id` = payment.`booking_id`
 AND allocation.`allocation_kind` = 'booking_payment'
JOIN `journal_lines` revenue_line
  ON revenue_line.`entry_id` = payment.`id`
 AND revenue_line.`account` = 'rental_revenue'
 AND revenue_line.`amount_cents` < 0
WHERE payment.`kind` = 'payment_received'
  AND payment.`booking_id` IS NOT NULL
  AND payment.`financial_transaction_id` IS NOT NULL
  AND allocation.`amount_cents` = -revenue_line.`amount_cents`
  AND NOT EXISTS (
    SELECT 1
    FROM `journal_lines` existing_receivable_line
    WHERE existing_receivable_line.`entry_id` = payment.`id`
      AND existing_receivable_line.`account` = 'accounts_receivable'
      AND existing_receivable_line.`amount_cents` < 0
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `journal_entries` correction
    WHERE correction.`idempotency_key` = 'booking_payment_ar_reclassification:' || payment.`id`
  );
--> statement-breakpoint
INSERT INTO `journal_lines` (`entry_id`, `account`, `amount_cents`)
SELECT
  correction.`id`,
  'rental_revenue',
  -revenue_line.`amount_cents`
FROM `journal_entries` correction
JOIN `journal_entries` payment
  ON correction.`idempotency_key` = 'booking_payment_ar_reclassification:' || payment.`id`
JOIN `journal_lines` revenue_line
  ON revenue_line.`entry_id` = payment.`id`
 AND revenue_line.`account` = 'rental_revenue'
 AND revenue_line.`amount_cents` < 0
WHERE NOT EXISTS (
  SELECT 1
  FROM `journal_lines` existing_line
  WHERE existing_line.`entry_id` = correction.`id`
    AND existing_line.`account` = 'rental_revenue'
);
--> statement-breakpoint
INSERT INTO `journal_lines` (`entry_id`, `account`, `amount_cents`)
SELECT
  correction.`id`,
  'accounts_receivable',
  revenue_line.`amount_cents`
FROM `journal_entries` correction
JOIN `journal_entries` payment
  ON correction.`idempotency_key` = 'booking_payment_ar_reclassification:' || payment.`id`
JOIN `journal_lines` revenue_line
  ON revenue_line.`entry_id` = payment.`id`
 AND revenue_line.`account` = 'rental_revenue'
 AND revenue_line.`amount_cents` < 0
WHERE NOT EXISTS (
  SELECT 1
  FROM `journal_lines` existing_line
  WHERE existing_line.`entry_id` = correction.`id`
    AND existing_line.`account` = 'accounts_receivable'
);
