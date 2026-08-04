import { createHash, timingSafeEqual } from "node:crypto";

import { inArray } from "drizzle-orm";

import { getDatabase } from "../../../../lib/db/client";
import { bookingRequestedItems, bookings } from "../../../../lib/db/schema";
import { calendarBookingStatuses, buildBookingCalendarFeed } from "../../../../lib/calendar/booking-feed";
import { rentalLocationConfigs } from "../../../../lib/rental-locations";

export const runtime = "nodejs";

function isValidToken(value: string, expected: string) {
  const actualHash = createHash("sha256").update(value).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const expectedToken = process.env.CALENDAR_FEED_TOKEN?.trim();
  const routeToken = (await params).token;
  const token = routeToken.endsWith(".ics") ? routeToken.slice(0, -4) : routeToken;
  if (!expectedToken || !isValidToken(token, expectedToken)) {
    return new Response("Not found", { status: 404 });
  }

  const db = getDatabase();
  const bookingsForCalendar = db
    .select({
      id: bookings.id, orderNumber: bookings.orderNumber, name: bookings.customerName, email: bookings.customerEmail, phone: bookings.customerPhone,
      location: bookings.location, periodFrom: bookings.periodFrom, periodTo: bookings.periodTo, pickupTime: bookings.pickupTime, dropoffTime: bookings.dropoffTime,
      message: bookings.customerMessage, totalPriceCents: bookings.quotedTotalCents, status: bookings.status, source: bookings.source, submittedAt: bookings.createdAt,
    })
    .from(bookings)
    .where(inArray(bookings.status, calendarBookingStatuses))
    .all();

  const bikes = bookingsForCalendar.length
    ? db
        .select({ inquiryId: bookingRequestedItems.bookingId, bikeSize: bookingRequestedItems.requestedLabel })
        .from(bookingRequestedItems)
        .where(inArray(bookingRequestedItems.bookingId, bookingsForCalendar.map((booking) => booking.id)))
        .all()
    : [];
  const bikesByInquiry = new Map<number, string[]>();
  for (const bike of bikes) bikesByInquiry.set(bike.inquiryId, [...(bikesByInquiry.get(bike.inquiryId) ?? []), bike.bikeSize]);

  const feed = buildBookingCalendarFeed(
    bookingsForCalendar.map((inquiry) => ({
      ...inquiry,
      status: inquiry.status as (typeof calendarBookingStatuses)[number],
      source: inquiry.source === "manual" ? "manual" : "automatic",
      bikes: bikesByInquiry.get(inquiry.id) ?? [],
      locationAddress: rentalLocationConfigs.find((location) => location.key === inquiry.location)?.address ?? inquiry.location,
    })),
  );
  if (request.headers.get("if-none-match") === feed.etag) return new Response(null, { status: 304 });

  return new Response(feed.body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=munich-bike-rental.ics",
      "Cache-Control": "private, no-cache, must-revalidate",
      ETag: feed.etag,
    },
  });
}
