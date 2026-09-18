-- Repair legacy asset labels and conservative booking allocations after the
-- final catalog normalization. Earlier migrations could leave an asset label
-- stale after relinking its variant, or attach one asset more than once when
-- a historic offer was ambiguous. Never guess in ambiguous cases: remove
-- only the generated allocation rows and leave the booking for preflight.
UPDATE `rental_assets`
SET `display_name` = (
  SELECT m.`title` || CASE WHEN v.`size` = 'Standard' THEN '' ELSE ' - ' || v.`size` END
  FROM `bike_variants` v
  JOIN `bike_models` m ON m.`id` = v.`model_id`
  WHERE v.`id` = `rental_assets`.`variant_id`
)
WHERE `asset_code` GLOB 'legacy-[0-9]*'
  AND EXISTS (
    SELECT 1
    FROM `bike_variants` v
    JOIN `bike_models` m ON m.`id` = v.`model_id`
    WHERE v.`id` = `rental_assets`.`variant_id`
      AND m.`model_key` GLOB 'legacy-[0-9]*'
  );
--> statement-breakpoint
DELETE FROM `booking_asset_allocations`
WHERE `booking_id` IN (
  SELECT b.`id`
  FROM `bookings` b
  WHERE b.`status` IN ('confirmed','checked_out','completed')
    AND (
      (SELECT COUNT(*) FROM `booking_offers` o
       WHERE o.`booking_id` = b.`id` AND o.`status` = 'accepted') <> 1
      OR EXISTS (
        SELECT 1
        FROM `booking_requested_items` i
        WHERE i.`booking_id` = b.`id`
          AND (
            (SELECT COUNT(*) FROM `booking_requested_items` same_label
             WHERE same_label.`booking_id` = b.`id` AND same_label.`requested_label` = i.`requested_label`) <> 1
            OR (SELECT COUNT(*) FROM `rental_assets` same_asset
                WHERE same_asset.`location` = b.`location` AND same_asset.`display_name` = i.`requested_label`) <> 1
          )
      )
    )
);
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_offer_items` (`offer_id`,`requested_item_id`,`asset_id`,`item_price_cents`)
SELECT o.`id`, i.`id`, a.`id`, a.`weekday_price_cents`
FROM `booking_offers` o
JOIN `bookings` b ON b.`id` = o.`booking_id`
JOIN `booking_requested_items` i ON i.`booking_id` = b.`id`
JOIN `rental_assets` a ON a.`location` = b.`location` AND a.`display_name` = i.`requested_label`
WHERE b.`status` IN ('confirmed','checked_out','completed')
  AND o.`status` = 'accepted'
  AND (SELECT COUNT(*) FROM `booking_offers` accepted
       WHERE accepted.`booking_id` = b.`id` AND accepted.`status` = 'accepted') = 1
  AND (SELECT COUNT(*) FROM `booking_requested_items` same_label
       WHERE same_label.`booking_id` = b.`id` AND same_label.`requested_label` = i.`requested_label`) = 1
  AND (SELECT COUNT(*) FROM `rental_assets` same_asset
       WHERE same_asset.`location` = b.`location` AND same_asset.`display_name` = i.`requested_label`) = 1;
--> statement-breakpoint
INSERT INTO `booking_asset_allocations` (`booking_id`,`offer_id`,`asset_id`,`period_from`,`period_to`,`pickup_time`,`dropoff_time`,`created_at`)
SELECT b.`id`, o.`id`, oi.`asset_id`, b.`period_from`, b.`period_to`, b.`pickup_time`, b.`dropoff_time`, b.`created_at`
FROM `bookings` b
JOIN `booking_offers` o ON o.`booking_id` = b.`id` AND o.`status` = 'accepted'
JOIN `booking_offer_items` oi ON oi.`offer_id` = o.`id`
WHERE b.`status` IN ('confirmed','checked_out','completed')
  AND (SELECT COUNT(*) FROM `booking_offers` accepted
       WHERE accepted.`booking_id` = b.`id` AND accepted.`status` = 'accepted') = 1
  AND NOT EXISTS (
    SELECT 1
    FROM `booking_requested_items` ambiguous
    WHERE ambiguous.`booking_id` = b.`id`
      AND (
        (SELECT COUNT(*) FROM `booking_requested_items` same_label
         WHERE same_label.`booking_id` = b.`id` AND same_label.`requested_label` = ambiguous.`requested_label`) <> 1
        OR (SELECT COUNT(*) FROM `rental_assets` same_asset
            WHERE same_asset.`location` = b.`location` AND same_asset.`display_name` = ambiguous.`requested_label`) <> 1
      )
  )
  AND NOT EXISTS (SELECT 1 FROM `booking_requested_items` i WHERE i.`booking_id` = b.`id` AND NOT EXISTS (SELECT 1 FROM `booking_offer_items` x WHERE x.`offer_id` = o.`id` AND x.`requested_item_id` = i.`id`))
  AND NOT EXISTS (SELECT 1 FROM `booking_asset_allocations` x WHERE x.`booking_id` = b.`id` AND x.`asset_id` = oi.`asset_id`);
