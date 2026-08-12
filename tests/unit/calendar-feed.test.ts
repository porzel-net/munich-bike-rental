import { describe, expect, it } from "vitest";

import { buildBookingCalendarFeed, calendarBookingStatuses } from "../../lib/calendar/booking-feed";

const booking = {
  id: 12,
  bookingUrl: "http://localhost:3000/admin/bookings/12",
  orderNumber: "#20260721135924",
  name: "Peter Huch",
  email: "peter@example.com",
  phone: "+49 170 1234567",
  location: "munich",
  periodFrom: "2026-07-24",
  periodTo: "2026-07-25",
  pickupTime: "08:00",
  dropoffTime: "18:00",
  status: "confirmed" as const,
  source: "automatic" as const,
  submittedAt: new Date("2026-07-21T12:00:00.000Z"),
  updatedAt: new Date("2026-07-21T12:00:00.000Z"),
  version: 1,
  items: [],
  bikes: ["Endurace CF SL 8 - M"],
  accessories: [],
  message: "Bitte Sattel einstellen.",
  totalPriceCents: 12300,
  invoiceNumber: null,
  locationAddress: "Gabelsbergerstraße 79a, 80333 München, Maxvorstadt",
};

describe("booking calendar feed", () => {
  it("publishes booking details with a stable event uid", () => {
    const feed = buildBookingCalendarFeed([booking]);
    const unfoldedFeed = feed.body.replace(/\r\n /g, "");

    expect(unfoldedFeed).toContain("UID:booking-12@munich-bike-rental.de");
    expect(unfoldedFeed).toContain("Buchung öffnen: http://localhost:3000/admin/bookings/12");
    expect(unfoldedFeed).toContain("SUMMARY:Bestätigt · Endurace CF SL 8 - M · Peter Huch · #20260721135924");
    expect(unfoldedFeed).toContain("DTSTART;TZID=Europe/Berlin:20260724T080000");
    expect(unfoldedFeed).toContain("DTEND;TZID=Europe/Berlin:20260725T180000");
    expect(unfoldedFeed).not.toContain("peter@example.com");
    expect(unfoldedFeed).not.toContain("Bitte Sattel einstellen.");
  });

  it("publishes only the four operational booking statuses", () => {
    expect(calendarBookingStatuses).toEqual(["inquiry_received", "offer_sent", "confirmed", "completed"]);
  });

  it("supports a distinct calendar name for each location feed", () => {
    const feed = buildBookingCalendarFeed([], { calendarName: "Munich Bike Rental – München" });

    expect(feed.body).toContain("X-WR-CALNAME:Munich Bike Rental – München");
  });

  it("changes the feed etag when a booking is removed", () => {
    const withBooking = buildBookingCalendarFeed([booking]);
    const withoutBooking = buildBookingCalendarFeed([]);

    expect(withoutBooking.body).not.toContain("booking-12@munich-bike-rental.de");
    expect(withoutBooking.etag).not.toBe(withBooking.etag);
  });

  it("publishes booking updates with a monotonic sequence", () => {
    const feed = buildBookingCalendarFeed([
      {
        ...booking,
        status: "offer_sent",
        version: 3,
        items: [
          {
            requestedLabel: "Gravelbike - L",
            heightCm: 182,
            needsPedals: true,
            pedalType: "SPD",
            needsComputerMount: false,
            computerMountType: null,
            needsHelmet: true,
            needsClothing: false,
          },
        ],
        accessories: ["Helm (1x)"],
      },
    ]);
    const unfoldedFeed = feed.body.replace(/\r\n /g, "");

    expect(unfoldedFeed).toContain("STATUS:TENTATIVE");
    expect(unfoldedFeed).toContain("LAST-MODIFIED:20260721T120000Z");
    expect(unfoldedFeed).toContain("SEQUENCE:2");
    expect(unfoldedFeed).toContain("Anfragen: Gravelbike - L · Körpergröße 182 cm · Pedale (SPD-SL)\\, Helm");
    expect(unfoldedFeed).toContain("Zubehör: Helm (1x)");
    expect(unfoldedFeed).not.toContain("Rechnungsnummer: RE-2026-12");
  });
});
