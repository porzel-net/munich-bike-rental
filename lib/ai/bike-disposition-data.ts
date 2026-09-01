import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/client";
import {
  bikeModels,
  bikeVariants,
  bookingAssetAllocations,
  bookingOfferItems,
  bookingRequestedItems,
  bookings,
  rentalAssets,
} from "@/lib/db/schema";
import { inferBikeCategory, type BikeDispositionInput, type DispositionBooking } from "@/lib/ai/bike-disposition";

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Builds a point-in-time read model for the disposition agent. This helper
 * deliberately contains no insert/update/delete call so the analysis route
 * cannot mutate calendar data by accident.
 */
export function getBikeDispositionInput(db: AppDatabase, targetBookingId: number): BikeDispositionInput | null {
  const target = db.select().from(bookings).where(eq(bookings.id, targetBookingId)).get();
  if (!target) return null;

  const bookingRows = db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.location, target.location),
        lte(bookings.periodFrom, shiftDate(target.periodTo, 7)),
        gte(bookings.periodTo, shiftDate(target.periodFrom, -7)),
      ),
    )
    .all();
  const bookingIds = [...new Set([target.id, ...bookingRows.map((booking) => booking.id)])];
  const requestedRows = bookingIds.length
    ? db.select().from(bookingRequestedItems).where(inArray(bookingRequestedItems.bookingId, bookingIds)).all()
    : [];
  const requestedByBooking = new Map<number, typeof requestedRows>();
  for (const item of requestedRows) {
    requestedByBooking.set(item.bookingId, [...(requestedByBooking.get(item.bookingId) ?? []), item]);
  }

  const allocationRows = bookingIds.length
    ? db
        .select()
        .from(bookingAssetAllocations)
        .where(and(inArray(bookingAssetAllocations.bookingId, bookingIds), isNull(bookingAssetAllocations.releasedAt)))
        .all()
    : [];
  const offerIds = [...new Set(allocationRows.map((allocation) => allocation.offerId))];
  const offerItems = offerIds.length
    ? db.select().from(bookingOfferItems).where(inArray(bookingOfferItems.offerId, offerIds)).all()
    : [];
  const requestedItemByAllocation = new Map(
    offerItems.map((item) => [`${item.offerId}:${item.assetId}`, item.requestedItemId]),
  );

  const assetRows = db
    .select({ asset: rentalAssets, model: bikeModels, variant: bikeVariants })
    .from(rentalAssets)
    .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
    .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
    .where(eq(rentalAssets.location, target.location))
    .all();

  const dispositionBookings: DispositionBooking[] = bookingRows.map((booking) => ({
    id: booking.id,
    orderNumber: booking.orderNumber,
    customerName: booking.customerName,
    status: booking.status,
    location: booking.location,
    periodFrom: booking.periodFrom,
    periodTo: booking.periodTo,
    pickupTime: booking.pickupTime,
    dropoffTime: booking.dropoffTime,
    quotedTotalCents: booking.quotedTotalCents,
    requestedItems: (requestedByBooking.get(booking.id) ?? []).map((item) => ({
      id: item.id,
      requestedLabel: item.requestedLabel,
      heightCm: item.heightCm,
    })),
    allocations: allocationRows
      .filter((allocation) => allocation.bookingId === booking.id)
      .map((allocation) => ({
        assetId: allocation.assetId,
        requestedItemId: requestedItemByAllocation.get(`${allocation.offerId}:${allocation.assetId}`) ?? null,
      })),
  }));

  // The target can be the only booking in the query even when it has no
  // requested item yet. Keep the input explicit so the UI gets a useful
  // "no request" result instead of a server error.
  if (!dispositionBookings.some((booking) => booking.id === target.id)) {
    dispositionBookings.push({
      id: target.id,
      orderNumber: target.orderNumber,
      customerName: target.customerName,
      status: target.status,
      location: target.location,
      periodFrom: target.periodFrom,
      periodTo: target.periodTo,
      pickupTime: target.pickupTime,
      dropoffTime: target.dropoffTime,
      quotedTotalCents: target.quotedTotalCents,
      requestedItems: [],
      allocations: [],
    });
  }

  return {
    targetBookingId,
    assets: assetRows.map(({ asset, model, variant }) => ({
      id: asset.id,
      displayName: asset.displayName,
      nickname: asset.nickname,
      modelKey: model.modelKey,
      modelTitle: model.title,
      category: inferBikeCategory(`${model.modelKey} ${model.title}`),
      size: variant.size,
      location: asset.location,
      state: asset.state,
      weekdayPriceCents: asset.weekdayPriceCents,
      weekendPriceCents: asset.weekendPriceCents,
    })),
    bookings: dispositionBookings,
  };
}
