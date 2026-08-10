import { createHash, timingSafeEqual } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDatabase } from "../../../../lib/db/client";
import {
  accessoryInventory,
  bookingAccessoryAllocations,
  bookingAssetAllocations,
  bookingOfferItems,
  bookingOffers,
  bookingRequestedItems,
  bookings,
  rentalAssets,
} from "../../../../lib/db/schema";
import { calendarBookingStatuses, buildBookingCalendarFeed } from "../../../../lib/calendar/booking-feed";
import { hasValidCalendarBasicAuth } from "../../../../lib/calendar/basic-auth";
import { rentalLocationConfigs } from "../../../../lib/rental-locations";
import { rentalLocationLabels, rentalLocations, type RentalLocation } from "../../../../lib/inquiries/catalog";

export const runtime = "nodejs";

function isValidToken(value: string, expected: string) {
  const actualHash = createHash("sha256").update(value).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const expectedToken = process.env.CALENDAR_FEED_TOKEN?.trim();
  const routeToken = (await params).token;
  const token = routeToken.endsWith(".ics") ? routeToken.slice(0, -4) : routeToken;
  const requestedLocation = new URL(request.url).searchParams.get("location")?.trim() ?? "";
  const location = rentalLocations.includes(requestedLocation as RentalLocation)
    ? (requestedLocation as RentalLocation)
    : null;
  if (
    !expectedToken ||
    expectedToken.length < 32 ||
    expectedToken === "replace-with-a-long-random-token" ||
    !isValidToken(token, expectedToken)
  ) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  if (!hasValidCalendarBasicAuth(request)) {
    return new Response("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Munich Bike Rental Kalender", charset="UTF-8"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (!location) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }

  const db = getDatabase();
  const bookingsForCalendar = db
    .select({
      id: bookings.id,
      orderNumber: bookings.orderNumber,
      name: bookings.customerName,
      location: bookings.location,
      periodFrom: bookings.periodFrom,
      periodTo: bookings.periodTo,
      pickupTime: bookings.pickupTime,
      dropoffTime: bookings.dropoffTime,
      status: bookings.status,
      source: bookings.source,
      version: bookings.version,
      submittedAt: bookings.createdAt,
      updatedAt: bookings.updatedAt,
    })
    .from(bookings)
    .where(and(inArray(bookings.status, calendarBookingStatuses), eq(bookings.location, location)))
    .all();

  const bookingIds = bookingsForCalendar.map((booking) => booking.id);
  const items = bookingIds.length
    ? db.select().from(bookingRequestedItems).where(inArray(bookingRequestedItems.bookingId, bookingIds)).all()
    : [];
  const itemsByBooking = new Map<number, typeof items>();
  for (const item of items) itemsByBooking.set(item.bookingId, [...(itemsByBooking.get(item.bookingId) ?? []), item]);

  const offers = bookingIds.length
    ? db
        .select()
        .from(bookingOffers)
        .where(inArray(bookingOffers.bookingId, bookingIds))
        .orderBy(desc(bookingOffers.offerNumber))
        .all()
    : [];
  const latestOfferIds: number[] = [];
  const latestOfferBookings = new Set<number>();
  for (const offer of offers) {
    if (latestOfferBookings.has(offer.bookingId)) continue;
    latestOfferBookings.add(offer.bookingId);
    latestOfferIds.push(offer.id);
  }
  const offerItems = latestOfferIds.length
    ? db.select().from(bookingOfferItems).where(inArray(bookingOfferItems.offerId, latestOfferIds)).all()
    : [];
  const allocations = bookingIds.length
    ? db.select().from(bookingAssetAllocations).where(inArray(bookingAssetAllocations.bookingId, bookingIds)).all()
    : [];
  const accessoryAllocations = bookingIds.length
    ? db
        .select()
        .from(bookingAccessoryAllocations)
        .where(inArray(bookingAccessoryAllocations.bookingId, bookingIds))
        .all()
    : [];

  const assetIds = [
    ...new Set([...offerItems.map((item) => item.assetId), ...allocations.map((item) => item.assetId)]),
  ];
  const assets = assetIds.length
    ? db
        .select({ id: rentalAssets.id, displayName: rentalAssets.displayName })
        .from(rentalAssets)
        .where(inArray(rentalAssets.id, assetIds))
        .all()
    : [];
  const assetNames = new Map(assets.map((asset) => [asset.id, asset.displayName]));
  const accessoryIds = [...new Set(accessoryAllocations.map((item) => item.accessoryId))];
  const accessories = accessoryIds.length
    ? db
        .select({ id: accessoryInventory.id, label: accessoryInventory.labelDe })
        .from(accessoryInventory)
        .where(inArray(accessoryInventory.id, accessoryIds))
        .all()
    : [];
  const accessoryNames = new Map(accessories.map((accessory) => [accessory.id, accessory.label]));

  const allocatedBikesByBooking = new Map<number, string[]>();
  for (const allocation of allocations) {
    const name = assetNames.get(allocation.assetId);
    if (name)
      allocatedBikesByBooking.set(allocation.bookingId, [
        ...(allocatedBikesByBooking.get(allocation.bookingId) ?? []),
        name,
      ]);
  }
  const offeredBikesByBooking = new Map<number, string[]>();
  for (const item of offerItems) {
    const offer = offers.find((candidate) => candidate.id === item.offerId);
    const name = assetNames.get(item.assetId);
    if (offer && name)
      offeredBikesByBooking.set(offer.bookingId, [...(offeredBikesByBooking.get(offer.bookingId) ?? []), name]);
  }
  const accessoriesByBooking = new Map<number, string[]>();
  for (const allocation of accessoryAllocations) {
    const name = accessoryNames.get(allocation.accessoryId);
    if (name)
      accessoriesByBooking.set(allocation.bookingId, [
        ...(accessoriesByBooking.get(allocation.bookingId) ?? []),
        `${name} (${allocation.quantity}x)`,
      ]);
  }

  const feed = buildBookingCalendarFeed(
    bookingsForCalendar.map((booking) => ({
      ...booking,
      bookingUrl: new URL(`/admin/bookings/${booking.id}`, request.url).toString(),
      status: booking.status as (typeof calendarBookingStatuses)[number],
      items: (itemsByBooking.get(booking.id) ?? []).map((item) => ({
        requestedLabel: item.requestedLabel,
        heightCm: item.heightCm,
        needsPedals: item.needsPedals,
        pedalType: item.pedalType,
        needsComputerMount: item.needsComputerMount,
        computerMountType: item.computerMountType,
        needsHelmet: item.needsHelmet,
        needsClothing: item.needsClothing,
        needsBikepackingBag: item.needsBikepackingBag,
        needsGlasses: item.needsGlasses,
        bottleHolderIncluded: item.bottleHolderIncluded,
        repairKitIncluded: item.repairKitIncluded,
      })),
      bikes:
        allocatedBikesByBooking.get(booking.id) ??
        offeredBikesByBooking.get(booking.id) ??
        (itemsByBooking.get(booking.id) ?? []).map((item) => item.requestedLabel),
      accessories: accessoriesByBooking.get(booking.id) ?? [],
      locationAddress:
        rentalLocationConfigs.find((location) => location.key === booking.location)?.address ?? booking.location,
    })),
    { calendarName: `Munich Bike Rental – ${rentalLocationLabels.de[location]}` },
  );

  if (request.headers.get("if-none-match") === feed.etag) {
    return new Response(null, {
      status: 304,
      headers: {
        "Cache-Control": "private, max-age=300, must-revalidate",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
        "X-Content-Type-Options": "nosniff",
        ETag: feed.etag,
      },
    });
  }

  return new Response(feed.body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=munich-bike-rental.ics",
      "Cache-Control": "private, max-age=300, must-revalidate",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      "X-Content-Type-Options": "nosniff",
      ETag: feed.etag,
    },
  });
}
