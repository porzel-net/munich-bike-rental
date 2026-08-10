-- Attach only fully mappable historic bookings to concrete assets. Any active
-- booking left without all required mappings is reported by the preflight API
-- and must be resolved before a production cut-over.
INSERT OR IGNORE INTO `booking_offer_items` (`offer_id`,`requested_item_id`,`asset_id`,`item_price_cents`)
SELECT o.`id`, i.`id`, a.`id`, a.`daily_price_cents`
FROM `booking_offers` o
JOIN `bookings` b ON b.`id` = o.`booking_id`
JOIN `booking_requested_items` i ON i.`booking_id` = b.`id`
JOIN `rental_assets` a ON a.`location` = b.`location` AND a.`display_name` = i.`requested_label`
WHERE b.`status` IN ('confirmed','checked_out','completed');
--> statement-breakpoint
INSERT INTO `booking_asset_allocations` (`booking_id`,`offer_id`,`asset_id`,`period_from`,`period_to`,`pickup_time`,`dropoff_time`,`created_at`)
SELECT b.`id`, o.`id`, oi.`asset_id`, b.`period_from`, b.`period_to`, b.`pickup_time`, b.`dropoff_time`, b.`created_at`
FROM `bookings` b
JOIN `booking_offers` o ON o.`booking_id` = b.`id` AND o.`status` = 'accepted'
JOIN `booking_offer_items` oi ON oi.`offer_id` = o.`id`
WHERE b.`status` IN ('confirmed','checked_out','completed')
  AND NOT EXISTS (SELECT 1 FROM `booking_requested_items` i WHERE i.`booking_id` = b.`id` AND NOT EXISTS (SELECT 1 FROM `booking_offer_items` x WHERE x.`offer_id` = o.`id` AND x.`requested_item_id` = i.`id`))
  AND NOT EXISTS (SELECT 1 FROM `booking_asset_allocations` x WHERE x.`booking_id` = b.`id` AND x.`asset_id` = oi.`asset_id`);
--> statement-breakpoint
INSERT INTO `journal_entries` (`booking_id`,`kind`,`reason`,`occurred_at`,`created_at`)
SELECT b.`id`, 'legacy_import', 'Historischer Mietumsatz #' || r.`id`, r.`created_at`, r.`created_at`
FROM `accounting_revenues` r JOIN `bookings` b ON b.`legacy_inquiry_id` = r.`inquiry_id`
WHERE NOT EXISTS (SELECT 1 FROM `journal_entries` e WHERE e.`reason` = 'Historischer Mietumsatz #' || r.`id`);
--> statement-breakpoint
INSERT INTO `journal_lines` (`entry_id`,`account`,`amount_cents`)
SELECT e.`id`, 'accounts_receivable', r.`amount_cents`
FROM `accounting_revenues` r JOIN `bookings` b ON b.`legacy_inquiry_id` = r.`inquiry_id`
JOIN `journal_entries` e ON e.`reason` = 'Historischer Mietumsatz #' || r.`id`
WHERE NOT EXISTS (SELECT 1 FROM `journal_lines` l WHERE l.`entry_id` = e.`id`);
--> statement-breakpoint
INSERT INTO `journal_lines` (`entry_id`,`account`,`amount_cents`)
SELECT e.`id`, 'rental_revenue', -r.`amount_cents`
FROM `accounting_revenues` r JOIN `bookings` b ON b.`legacy_inquiry_id` = r.`inquiry_id`
JOIN `journal_entries` e ON e.`reason` = 'Historischer Mietumsatz #' || r.`id`
WHERE NOT EXISTS (SELECT 1 FROM `journal_lines` l WHERE l.`entry_id` = e.`id` AND l.`account` = 'rental_revenue');
--> statement-breakpoint
INSERT INTO `journal_entries` (`booking_id`,`kind`,`reason`,`occurred_at`,`created_at`)
SELECT b.`id`, 'legacy_import', 'Historische Zahlung #' || p.`id`, p.`created_at`, p.`created_at`
FROM `accounting_revenue_payments` p JOIN `accounting_revenues` r ON r.`id` = p.`revenue_id` JOIN `bookings` b ON b.`legacy_inquiry_id` = r.`inquiry_id`
WHERE NOT EXISTS (SELECT 1 FROM `journal_entries` e WHERE e.`reason` = 'Historische Zahlung #' || p.`id`);
--> statement-breakpoint
INSERT INTO `journal_lines` (`entry_id`,`account`,`amount_cents`)
SELECT e.`id`, 'bank_or_cash', p.`amount_cents`
FROM `accounting_revenue_payments` p JOIN `journal_entries` e ON e.`reason` = 'Historische Zahlung #' || p.`id`
WHERE NOT EXISTS (SELECT 1 FROM `journal_lines` l WHERE l.`entry_id` = e.`id`);
--> statement-breakpoint
INSERT INTO `journal_lines` (`entry_id`,`account`,`amount_cents`)
SELECT e.`id`, 'accounts_receivable', -p.`amount_cents`
FROM `accounting_revenue_payments` p JOIN `journal_entries` e ON e.`reason` = 'Historische Zahlung #' || p.`id`
WHERE NOT EXISTS (SELECT 1 FROM `journal_lines` l WHERE l.`entry_id` = e.`id` AND l.`account` = 'accounts_receivable');
--> statement-breakpoint
INSERT INTO `journal_entries` (`kind`,`reason`,`occurred_at`,`created_at`)
SELECT 'legacy_import', 'Historischer Aufwand #' || x.`id`, x.`created_at`, x.`created_at`
FROM `accounting_expenses` x
WHERE NOT EXISTS (SELECT 1 FROM `journal_entries` e WHERE e.`reason` = 'Historischer Aufwand #' || x.`id`);
--> statement-breakpoint
INSERT INTO `journal_lines` (`entry_id`,`account`,`amount_cents`)
SELECT e.`id`, 'expense', x.`sum_cents`
FROM `accounting_expenses` x JOIN `journal_entries` e ON e.`reason` = 'Historischer Aufwand #' || x.`id`
WHERE NOT EXISTS (SELECT 1 FROM `journal_lines` l WHERE l.`entry_id` = e.`id`);
--> statement-breakpoint
INSERT INTO `journal_lines` (`entry_id`,`account`,`amount_cents`)
SELECT e.`id`, 'bank_or_cash', -x.`sum_cents`
FROM `accounting_expenses` x JOIN `journal_entries` e ON e.`reason` = 'Historischer Aufwand #' || x.`id`
WHERE NOT EXISTS (SELECT 1 FROM `journal_lines` l WHERE l.`entry_id` = e.`id` AND l.`account` = 'bank_or_cash');
