import { createHash, timingSafeEqual } from "node:crypto";

import { inArray } from "drizzle-orm";

import { getDatabase } from "../../../../lib/db/client";
import { rentalInquiryBikes, rentalInquiries } from "../../../../lib/db/schema";
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
  const inquiries = db
    .select({
      id: rentalInquiries.id,
      orderNumber: rentalInquiries.orderNumber,
      name: rentalInquiries.name,
      email: rentalInquiries.email,
      phone: rentalInquiries.phone,
      location: rentalInquiries.location,
      periodFrom: rentalInquiries.periodFrom,
      periodTo: rentalInquiries.periodTo,
      pickupTime: rentalInquiries.pickupTime,
      dropoffTime: rentalInquiries.dropoffTime,
      message: rentalInquiries.message,
      totalPriceCents: rentalInquiries.totalPriceCents,
      status: rentalInquiries.status,
      source: rentalInquiries.source,
      submittedAt: rentalInquiries.submittedAt,
    })
    .from(rentalInquiries)
    .where(inArray(rentalInquiries.status, calendarBookingStatuses))
    .all();

  const bikes = inquiries.length
    ? db
        .select({ inquiryId: rentalInquiryBikes.inquiryId, bikeSize: rentalInquiryBikes.bikeSize })
        .from(rentalInquiryBikes)
        .where(inArray(rentalInquiryBikes.inquiryId, inquiries.map((inquiry) => inquiry.id)))
        .all()
    : [];
  const bikesByInquiry = new Map<number, string[]>();
  for (const bike of bikes) bikesByInquiry.set(bike.inquiryId, [...(bikesByInquiry.get(bike.inquiryId) ?? []), bike.bikeSize]);

  const feed = buildBookingCalendarFeed(
    inquiries.map((inquiry) => ({
      ...inquiry,
      status: inquiry.status as (typeof calendarBookingStatuses)[number],
      source: inquiry.source as "automatic" | "manual",
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
