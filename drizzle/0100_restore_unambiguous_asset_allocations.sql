-- Restore only unambiguous allocation rows removed by 0099.
--
-- booking_offer_items is the authoritative concrete-bike choice for an
-- accepted offer. Do not infer the asset from requested_label: alternatives,
-- sizes and imported labels deliberately do not have to match display_name.
-- Ambiguous historical rows remain visible to the preflight instead of being
-- guessed here.
WITH eligible_bookings AS (
  SELECT
    b.id AS booking_id,
    b.period_from,
    b.period_to,
    b.pickup_time,
    b.dropoff_time,
    b.created_at,
    o.id AS offer_id
  FROM bookings b
  JOIN booking_offers o
    ON o.booking_id = b.id
   AND o.status = 'accepted'
  WHERE b.status IN ('confirmed', 'checked_out', 'completed')
    AND (
      SELECT COUNT(*)
      FROM booking_offers accepted
      WHERE accepted.booking_id = b.id
        AND accepted.status = 'accepted'
    ) = 1
    AND (
      SELECT COUNT(*)
      FROM booking_asset_allocations existing
      WHERE existing.booking_id = b.id
    ) = 0
    AND (
      SELECT COUNT(*)
      FROM booking_requested_items requested
      WHERE requested.booking_id = b.id
    ) = (
      SELECT COUNT(*)
      FROM booking_offer_items offered
      WHERE offered.offer_id = o.id
    )
    AND (
      SELECT COUNT(DISTINCT offered.asset_id)
      FROM booking_offer_items offered
      WHERE offered.offer_id = o.id
    ) = (
      SELECT COUNT(*)
      FROM booking_requested_items requested
      WHERE requested.booking_id = b.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM booking_requested_items requested
      WHERE requested.booking_id = b.id
        AND NOT EXISTS (
          SELECT 1
          FROM booking_offer_items offered
          WHERE offered.offer_id = o.id
            AND offered.requested_item_id = requested.id
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM booking_offer_items offered
      WHERE offered.offer_id = o.id
        AND NOT EXISTS (
          SELECT 1
          FROM booking_requested_items requested
          WHERE requested.id = offered.requested_item_id
            AND requested.booking_id = b.id
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM booking_offer_items offered
      LEFT JOIN rental_assets asset ON asset.id = offered.asset_id
      WHERE offered.offer_id = o.id
        AND (asset.id IS NULL OR asset.location <> b.location)
    )
),
candidate_items AS (
  SELECT
    eligible.booking_id,
    eligible.period_from,
    eligible.period_to,
    eligible.pickup_time,
    eligible.dropoff_time,
    eligible.created_at,
    eligible.offer_id,
    offered.asset_id
  FROM eligible_bookings eligible
  JOIN booking_offer_items offered ON offered.offer_id = eligible.offer_id
),
safe_bookings AS (
  SELECT eligible.booking_id
  FROM eligible_bookings eligible
  WHERE NOT EXISTS (
    SELECT 1
    FROM candidate_items candidate
    JOIN booking_asset_allocations existing
      ON existing.asset_id = candidate.asset_id
     AND existing.booking_id <> candidate.booking_id
     AND existing.released_at IS NULL
    WHERE candidate.booking_id = eligible.booking_id
      AND NOT (
        (existing.period_to || 'T' || existing.dropoff_time)
          <= (candidate.period_from || 'T' || candidate.pickup_time)
        OR
        (existing.period_from || 'T' || existing.pickup_time)
          >= (candidate.period_to || 'T' || candidate.dropoff_time)
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM candidate_items first_candidate
    JOIN candidate_items second_candidate
      ON second_candidate.asset_id = first_candidate.asset_id
     AND second_candidate.booking_id > first_candidate.booking_id
    WHERE (
        first_candidate.booking_id = eligible.booking_id
        OR second_candidate.booking_id = eligible.booking_id
      )
      AND NOT (
        (second_candidate.period_to || 'T' || second_candidate.dropoff_time)
          <= (first_candidate.period_from || 'T' || first_candidate.pickup_time)
        OR
        (second_candidate.period_from || 'T' || second_candidate.pickup_time)
          >= (first_candidate.period_to || 'T' || first_candidate.dropoff_time)
      )
  )
)
INSERT INTO booking_asset_allocations (
  booking_id,
  offer_id,
  asset_id,
  period_from,
  period_to,
  pickup_time,
  dropoff_time,
  created_at
)
SELECT
  candidate.booking_id,
  candidate.offer_id,
  candidate.asset_id,
  candidate.period_from,
  candidate.period_to,
  candidate.pickup_time,
  candidate.dropoff_time,
  candidate.created_at
FROM candidate_items candidate
JOIN safe_bookings safe ON safe.booking_id = candidate.booking_id;
