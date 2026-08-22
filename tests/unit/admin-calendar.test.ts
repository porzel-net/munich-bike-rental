import { describe, expect, it } from "vitest";

import { toCalendarBookingEvent } from "../../lib/calendar/admin-calendar";

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
});
