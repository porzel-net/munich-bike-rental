import { and, eq, gt, sql } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  accessoryInventory,
  bookingAccessoryAllocations,
  bookingAssetAllocations,
  bookingOfferItems,
  bookingOffers,
  bookingRequestedItems,
  bookings,
} from "../db/schema";
import type { OfferAccessorySelection } from "./quotes";
import { normalizeComputerMountType, normalizePedalType } from "../inquiries/catalog";

import { BookingCommandError } from "./errors";

type AccessoryAllocationOptions = {
  /**
   * Manual payment assignment confirms an already paid offer even when the
   * current accessory inventory no longer matches the sent offer. In that
   * case the missing reservation is returned to the caller as a warning.
   */
  allowUnavailable?: boolean;
};

export type AssetAvailabilityBlocker = {
  assetId: number;
  bookingId: number;
  customerName: string;
  orderNumber: string;
  kind: "booking" | "offer";
  /** A sent offer expires automatically; confirmed allocations do not. */
  expiresAt: Date | null;
};

function assetIntervalConflict(fromDate: string, fromTime: string, toDate: string, toTime: string) {
  return sql`NOT ((${bookingAssetAllocations.periodTo} || 'T' || ${bookingAssetAllocations.dropoffTime}) <= ${`${fromDate}T${fromTime}`} OR (${bookingAssetAllocations.periodFrom} || 'T' || ${bookingAssetAllocations.pickupTime}) >= ${`${toDate}T${toTime}`})`;
}

function accessoryIntervalConflict(fromDate: string, fromTime: string, toDate: string, toTime: string) {
  return sql`NOT ((${bookingAccessoryAllocations.periodTo} || 'T' || ${bookingAccessoryAllocations.dropoffTime}) <= ${`${fromDate}T${fromTime}`} OR (${bookingAccessoryAllocations.periodFrom} || 'T' || ${bookingAccessoryAllocations.pickupTime}) >= ${`${toDate}T${toTime}`})`;
}

function offerIntervalConflict(fromDate: string, fromTime: string, toDate: string, toTime: string) {
  return sql`NOT ((${bookings.periodTo} || 'T' || ${bookings.dropoffTime}) <= ${`${fromDate}T${fromTime}`} OR (${bookings.periodFrom} || 'T' || ${bookings.pickupTime}) >= ${`${toDate}T${toTime}`})`;
}

/** `[pickup, return)` permits a return and the following pickup at the same time. */
export function hasAssetConflict(db: AppDatabase, booking: typeof bookings.$inferSelect, assetId: number) {
  return Boolean(
    db
      .select({ id: bookingAssetAllocations.id })
      .from(bookingAssetAllocations)
      .where(
        and(
          eq(bookingAssetAllocations.assetId, assetId),
          sql`${bookingAssetAllocations.releasedAt} is null`,
          assetIntervalConflict(booking.periodFrom, booking.pickupTime, booking.periodTo, booking.dropoffTime),
        ),
      )
      .get(),
  );
}

function getConfirmedAllocationBlockers(
  db: AppDatabase,
  booking: typeof bookings.$inferSelect,
  assetId: number,
): AssetAvailabilityBlocker[] {
  return db
    .select({
      assetId: bookingAssetAllocations.assetId,
      bookingId: bookings.id,
      customerName: bookings.customerName,
      orderNumber: bookings.orderNumber,
    })
    .from(bookingAssetAllocations)
    .innerJoin(bookings, eq(bookingAssetAllocations.bookingId, bookings.id))
    .where(
      and(
        eq(bookingAssetAllocations.assetId, assetId),
        sql`${bookingAssetAllocations.releasedAt} is null`,
        assetIntervalConflict(booking.periodFrom, booking.pickupTime, booking.periodTo, booking.dropoffTime),
      ),
    )
    .all()
    .map((blocker) => ({ ...blocker, kind: "booking" as const, expiresAt: null }));
}

function getOfferReservationBlockers(
  db: AppDatabase,
  booking: typeof bookings.$inferSelect,
  assetId: number,
): AssetAvailabilityBlocker[] {
  return db
    .select({
      assetId: bookingOfferItems.assetId,
      bookingId: bookings.id,
      customerName: bookings.customerName,
      orderNumber: bookings.orderNumber,
      expiresAt: bookingOffers.expiresAt,
    })
    .from(bookingOfferItems)
    .innerJoin(bookingOffers, eq(bookingOfferItems.offerId, bookingOffers.id))
    .innerJoin(bookings, eq(bookingOffers.bookingId, bookings.id))
    .where(
      and(
        eq(bookingOfferItems.assetId, assetId),
        eq(bookingOffers.status, "sent"),
        gt(bookingOffers.expiresAt, new Date()),
        sql`${bookingOffers.bookingId} <> ${booking.id}`,
        offerIntervalConflict(booking.periodFrom, booking.pickupTime, booking.periodTo, booking.dropoffTime),
      ),
    )
    .all()
    .map((blocker) => ({ ...blocker, kind: "offer" as const }));
}

/**
 * Explains why an asset is unavailable. The admin UI uses this to surface the
 * booking that owns a concrete offer hold instead of showing a generic block.
 */
export function getAssetAvailabilityBlockers(db: AppDatabase, booking: typeof bookings.$inferSelect, assetId: number) {
  return [
    ...getConfirmedAllocationBlockers(db, booking, assetId),
    ...getOfferReservationBlockers(db, booking, assetId),
  ];
}

/**
 * A sent offer is an exclusive, time-bounded hold on its concrete bike. The
 * current booking is excluded so replacing an offer can retain a bike while
 * its prior offer is revoked in the same transaction.
 */
export function hasActiveOfferReservationConflict(
  db: AppDatabase,
  booking: typeof bookings.$inferSelect,
  assetId: number,
) {
  return getOfferReservationBlockers(db, booking, assetId).length > 0;
}

/** Includes confirmed allocations and time-bounded holds from sent offers. */
export function hasAssetAvailabilityConflict(db: AppDatabase, booking: typeof bookings.$inferSelect, assetId: number) {
  return getAssetAvailabilityBlockers(db, booking, assetId).length > 0;
}

export function allocateRequestedAccessories(
  db: AppDatabase,
  booking: typeof bookings.$inferSelect,
  accessoriesByRequestedItem: Record<number, OfferAccessorySelection> = {},
  stamp = new Date(),
  options: AccessoryAllocationOptions = {},
) {
  const requested = db
    .select()
    .from(bookingRequestedItems)
    .where(eq(bookingRequestedItems.bookingId, booking.id))
    .all();
  const quantities = new Map<string, number>();
  const add = (key: string | null) => {
    if (key) quantities.set(key, (quantities.get(key) ?? 0) + 1);
  };
  const unavailableAccessoryKeys: string[] = [];
  for (const item of requested) {
    const accessories = accessoriesByRequestedItem[item.id] ?? item;
    if (accessories.needsPedals) {
      const pedalType = normalizePedalType(accessories.pedalType);
      add(pedalType ? `pedal-${pedalType}` : null);
    }
    if (accessories.needsComputerMount) {
      const computerMountType = normalizeComputerMountType(accessories.computerMountType);
      add(computerMountType ? `mount-${computerMountType}` : null);
    }
    if (accessories.needsHelmet) add("helmet");
    if (accessories.needsClothing) add("clothing");
    if (accessories.needsBikepackingBag) add("bikepacking-bag");
    if (accessories.needsGlasses) add("glasses");
  }
  for (const [accessoryKey, quantity] of quantities) {
    const accessory = db
      .select()
      .from(accessoryInventory)
      .where(
        and(
          eq(accessoryInventory.location, booking.location),
          eq(accessoryInventory.accessoryKey, accessoryKey),
          eq(accessoryInventory.state, "active"),
        ),
      )
      .get();
    if (!accessory)
      if (options.allowUnavailable) {
        unavailableAccessoryKeys.push(accessoryKey);
        continue;
      } else throw new BookingCommandError(`Das Zubehör „${accessoryKey}“ ist an diesem Standort nicht verfügbar.`);
    // Non-counted equipment is attached to the selected bike (for example a
    // bottle holder) and must not consume a shared stock quantity.
    if (!accessory.quantityRelevant) continue;
    const allocated =
      db
        .select({ quantity: sql<number>`coalesce(sum(${bookingAccessoryAllocations.quantity}), 0)` })
        .from(bookingAccessoryAllocations)
        .where(
          and(
            eq(bookingAccessoryAllocations.accessoryId, accessory.id),
            sql`${bookingAccessoryAllocations.releasedAt} is null`,
            accessoryIntervalConflict(booking.periodFrom, booking.pickupTime, booking.periodTo, booking.dropoffTime),
          ),
        )
        .get()?.quantity ?? 0;
    if (accessory.availableQuantity - allocated < quantity)
      if (options.allowUnavailable) {
        unavailableAccessoryKeys.push(accessoryKey);
        continue;
      } else
        throw new BookingCommandError(
          `Das Zubehör „${accessoryKey}“ ist im gewählten Zeitraum nicht mehr verfügbar. Wähle eine kleinere Menge oder einen anderen Zeitraum.`,
        );
    db.insert(bookingAccessoryAllocations)
      .values({
        bookingId: booking.id,
        accessoryId: accessory.id,
        quantity,
        periodFrom: booking.periodFrom,
        periodTo: booking.periodTo,
        pickupTime: booking.pickupTime,
        dropoffTime: booking.dropoffTime,
        createdAt: stamp,
      })
      .run();
  }
  return unavailableAccessoryKeys;
}
