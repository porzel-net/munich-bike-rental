import { and, eq, sql } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  accessoryInventory,
  bookingAccessoryAllocations,
  bookingAssetAllocations,
  bookingRequestedItems,
  bookings,
} from "../db/schema";
import type { OfferAccessorySelection } from "./quotes";

import { BookingCommandError } from "./errors";

function assetIntervalConflict(fromDate: string, fromTime: string, toDate: string, toTime: string) {
  return sql`NOT ((${bookingAssetAllocations.periodTo} || 'T' || ${bookingAssetAllocations.dropoffTime}) <= ${`${fromDate}T${fromTime}`} OR (${bookingAssetAllocations.periodFrom} || 'T' || ${bookingAssetAllocations.pickupTime}) >= ${`${toDate}T${toTime}`})`;
}

function accessoryIntervalConflict(fromDate: string, fromTime: string, toDate: string, toTime: string) {
  return sql`NOT ((${bookingAccessoryAllocations.periodTo} || 'T' || ${bookingAccessoryAllocations.dropoffTime}) <= ${`${fromDate}T${fromTime}`} OR (${bookingAccessoryAllocations.periodFrom} || 'T' || ${bookingAccessoryAllocations.pickupTime}) >= ${`${toDate}T${toTime}`})`;
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

export function allocateRequestedAccessories(
  db: AppDatabase,
  booking: typeof bookings.$inferSelect,
  accessoriesByRequestedItem: Record<number, OfferAccessorySelection> = {},
  stamp = new Date(),
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
  for (const item of requested) {
    const accessories = accessoriesByRequestedItem[item.id] ?? item;
    if (accessories.needsPedals) add(accessories.pedalType ? `pedal-${accessories.pedalType}` : null);
    if (accessories.needsComputerMount)
      add(accessories.computerMountType ? `mount-${accessories.computerMountType}` : null);
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
    if (!accessory) throw new BookingCommandError(`Requested accessory ${accessoryKey} is unavailable`);
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
      throw new BookingCommandError(`Requested accessory ${accessoryKey} is no longer available`);
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
}
