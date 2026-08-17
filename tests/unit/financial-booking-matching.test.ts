import { describe, expect, it } from "vitest";

import { extractOrderNumberCandidates, findBookingOrderNumber } from "@/lib/financial/booking-matching";

describe("financial booking matching", () => {
  it("finds order numbers in a Nevlo reference", () => {
    expect(extractOrderNumberCandidates("Überweisung für Auftrag #202608080000")).toEqual(["202608080000"]);
  });

  it("finds an order number next to bank protocol data", () => {
    expect(extractOrderNumberCandidates("20260806080840 /INS/CTBAAU2SXXX")).toEqual(["20260806080840"]);
    expect(extractOrderNumberCandidates("REF20260806080840/INS/CTBAAU2SXXX")).toEqual(["20260806080840"]);
  });

  it("matches only an existing booking", () => {
    const bookings = [
      { id: 7, orderNumber: "#20260808000000" },
      { id: 8, orderNumber: "#20260809000000" },
    ];

    expect(findBookingOrderNumber(["Zahlung 20260808000000"], bookings)).toEqual(bookings[0]);
    expect(
      findBookingOrderNumber(["20260806080840 /INS/CTBAAU2SXXX"], [{ id: 9, orderNumber: "#20260806080840" }]),
    ).toEqual({
      id: 9,
      orderNumber: "#20260806080840",
    });
    expect(findBookingOrderNumber(["Zahlung 20260808999999"], bookings)).toBeNull();
  });
});
