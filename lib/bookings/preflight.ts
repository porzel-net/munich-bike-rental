import { sql } from "drizzle-orm";

import type { AppDatabase } from "../db/client";

export type UnmappedActiveBooking = {
  id: number;
  orderNumber: string;
  location: string;
  status: string;
  requestedItems: number;
  allocatedAssets: number;
};

export type ConflictingHistoricAllocation = { assetId: number; firstBookingId: number; secondBookingId: number };

/**
 * Production migration gate: a confirmed historic booking must have an asset
 * for every requested bike before legacy booking writes are retired.
 */
export function getBookingMigrationPreflight(db: AppDatabase) {
  const unmapped = db.all<UnmappedActiveBooking>(sql`
    SELECT b.id, b.order_number AS orderNumber, b.location, b.status,
      (SELECT count(*) FROM booking_requested_items i WHERE i.booking_id = b.id) AS requestedItems,
      (SELECT count(*) FROM booking_asset_allocations a WHERE a.booking_id = b.id AND a.released_at IS NULL) AS allocatedAssets
    FROM bookings b
    WHERE b.status IN ('confirmed', 'checked_out')
      AND (SELECT count(*) FROM booking_requested_items i WHERE i.booking_id = b.id) !=
          (SELECT count(*) FROM booking_asset_allocations a WHERE a.booking_id = b.id AND a.released_at IS NULL)
    ORDER BY b.order_number
  `);
  const allocationConflicts = db.all<ConflictingHistoricAllocation>(sql`
    SELECT a.asset_id AS assetId, a.booking_id AS firstBookingId, b.booking_id AS secondBookingId
    FROM booking_asset_allocations a
    JOIN booking_asset_allocations b ON b.asset_id = a.asset_id AND b.id > a.id
    WHERE a.released_at IS NULL AND b.released_at IS NULL
      AND NOT ((a.period_to || 'T' || a.dropoff_time) <= (b.period_from || 'T' || b.pickup_time)
        OR (a.period_from || 'T' || a.pickup_time) >= (b.period_to || 'T' || b.dropoff_time))
  `);
  return { ok: unmapped.length === 0 && allocationConflicts.length === 0, unmapped, allocationConflicts };
}
