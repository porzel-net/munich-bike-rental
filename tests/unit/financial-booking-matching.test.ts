import { describe, expect, it } from "vitest";

import { extractOrderNumberCandidates, findBookingOrderNumber } from "@/lib/financial/booking-matching";

describe("financial booking matching", () => {
  it("finds order numbers in a Nevlo reference", () => {
    expect(extractOrderNumberCandidates("Überweisung für Auftrag #202608080000")).toEqual(["202608080000"]);
  });

  it("matches only an existing booking", () => {
    const bookings = [
      { id: 7, orderNumber: "#20260808000000" },
      { id: 8, orderNumber: "#20260809000000" },
    ];

    expect(findBookingOrderNumber(["Zahlung 20260808000000"], bookings)).toEqual(bookings[0]);
    expect(findBookingOrderNumber(["Zahlung 20260808999999"], bookings)).toBeNull();
  });
});
