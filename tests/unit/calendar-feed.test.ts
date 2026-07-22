import { describe, expect, it } from "vitest";

import { buildBookingCalendarFeed } from "../../lib/calendar/booking-feed";

const booking = {
  id: 12,
  orderNumber: "#20260721135924",
  name: "Peter Huch",
  email: "peter@example.com",
  phone: "+49 123 456",
  location: "munich",
  periodFrom: "2026-07-24",
  periodTo: "2026-07-25",
  pickupTime: "08:00",
  dropoffTime: "18:00",
  message: "Bitte Sattel einstellen.",
  totalPriceCents: 6400,
  status: "confirmed" as const,
  source: "automatic" as const,
  submittedAt: new Date("2026-07-21T12:00:00.000Z"),
  bikes: ["Endurace CF SL 8 - M"],
  locationAddress: "Gabelsbergerstraße 79a, 80333 München, Maxvorstadt",
};

describe("booking calendar feed", () => {
  it("publishes booking details with a stable event uid", () => {
    const feed = buildBookingCalendarFeed([booking]);
    const unfoldedFeed = feed.body.replace(/\r\n /g, "");

    expect(unfoldedFeed).toContain("UID:booking-12@munich-bike-rental.de");
    expect(unfoldedFeed).toContain("SUMMARY:Bestätigt - Endurace CF SL 8 - M: Peter Huch #20260721135924");
    expect(unfoldedFeed).toContain("DTSTART;TZID=Europe/Berlin:20260724T080000");
    expect(unfoldedFeed).toContain("DTEND;TZID=Europe/Berlin:20260725T180000");
    expect(unfoldedFeed).toContain("E-Mail: peter@example.com");
    expect(unfoldedFeed).toContain("Bitte Sattel einstellen.");
  });

  it("changes the feed etag when a booking is removed", () => {
    const withBooking = buildBookingCalendarFeed([booking]);
    const withoutBooking = buildBookingCalendarFeed([]);

    expect(withoutBooking.body).not.toContain("booking-12@munich-bike-rental.de");
    expect(withoutBooking.etag).not.toBe(withBooking.etag);
  });
});
