import { describe, expect, it } from "vitest";

import {
  addCalendarBookingBike,
  toCalendarBookingEvent,
  type CalendarBookingBike,
} from "../../lib/calendar/admin-calendar";

describe("admin calendar booking events", () => {
  it("uses the bike nickname as the event label and keeps the full bike name in the tooltip", () => {
    const event = toCalendarBookingEvent({
      id: 12,
      orderNumber: "#20260721135924",
      customerName: "Peter Huch",
      location: "munich",
      periodFrom: "2026-07-24",
      periodTo: "2026-07-25",
      status: "confirmed",
      requestedItems: ["Endurace CF SL 8 - M"],
      selectedItems: ["Endurace CF SL 8 - M"],
      selectedBikes: [{ displayName: "Endurace CF SL 8 - M", nickname: "Blitz" }],
      customerPhone: "+49 170 1234567",
      pickupTime: "08:00",
      dropoffTime: "18:00",
      requestedEquipment: [],
    });

    expect(event.displayLabel).toBe("MUC · Blitz");
    expect(event.tooltip).toContain("Bike: Endurace CF SL 8 - M");
    expect(event.tooltip).toContain("Spitzname: Blitz");
    expect(event.selectedItems).toEqual(["Endurace CF SL 8 - M"]);
  });

  it("keeps two physical bikes with the same display name", () => {
    const bikesByBooking = new Map<number, CalendarBookingBike[]>();
    const assetIdsByBooking = new Map<number, Set<number>>();
    const bike: CalendarBookingBike = { displayName: "Endurace CF SL 8 - M", nickname: null };

    addCalendarBookingBike(bikesByBooking, assetIdsByBooking, 13, 101, bike);
    addCalendarBookingBike(bikesByBooking, assetIdsByBooking, 13, 102, bike);
    addCalendarBookingBike(bikesByBooking, assetIdsByBooking, 13, 101, bike);

    expect(bikesByBooking.get(13)).toHaveLength(2);
    expect(assetIdsByBooking.get(13)).toEqual(new Set([101, 102]));
  });

  it("uses a slate tone when the current offer was revoked", () => {
    const event = toCalendarBookingEvent({
      id: 14,
      orderNumber: "#20260721135925",
      customerName: "Erika Mustermann",
      location: "munich",
      periodFrom: "2099-07-24",
      periodTo: "2099-07-25",
      status: "offer_sent",
      latestOfferStatus: "revoked",
      latestOfferExpiresAt: new Date("2099-07-25T12:00:00.000Z"),
      requestedItems: ["Endurace CF SL 8 - M"],
      customerPhone: "",
      pickupTime: "08:00",
      dropoffTime: "18:00",
      requestedEquipment: [],
    });

    expect(event.tone).toBe("slate");
    expect(event.statusLabel).toBe("Angebot zurückgezogen");
  });

  it("uses a slate tone when an offer's rental period has already started", () => {
    const event = toCalendarBookingEvent({
      id: 15,
      orderNumber: "#20260721135926",
      customerName: "Erika Mustermann",
      location: "munich",
      periodFrom: "2020-07-24",
      periodTo: "2020-07-25",
      status: "offer_sent",
      latestOfferStatus: "sent",
      latestOfferExpiresAt: new Date("2099-07-25T12:00:00.000Z"),
      requestedItems: ["Endurace CF SL 8 - M"],
      customerPhone: "",
      pickupTime: "08:00",
      dropoffTime: "18:00",
      requestedEquipment: [],
    });

    expect(event.tone).toBe("slate");
    expect(event.statusLabel).toBe("Angebot abgelaufen");
  });

  it("uses a slate tone as soon as the offer expiry is reached", () => {
    const event = toCalendarBookingEvent({
      id: 16,
      orderNumber: "#20260721135927",
      customerName: "Erika Mustermann",
      location: "munich",
      periodFrom: "2099-07-24",
      periodTo: "2099-07-25",
      status: "offer_sent",
      latestOfferStatus: "sent",
      latestOfferExpiresAt: new Date("2020-07-25T12:00:00.000Z"),
      requestedItems: ["Endurace CF SL 8 - M"],
      customerPhone: "",
      pickupTime: "08:00",
      dropoffTime: "18:00",
      requestedEquipment: [],
    });

    expect(event.tone).toBe("slate");
    expect(event.statusLabel).toBe("Angebot abgelaufen");
  });
});
