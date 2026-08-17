import { describe, expect, it } from "vitest";

import { renderInvoicePdf } from "../../lib/bookings/invoice-pdf";

describe("invoice PDF rendering", () => {
  it("renders a non-empty PDF", async () => {
    const pdf = await renderInvoicePdf({
      invoiceNumber: "YBR-2026-0001",
      issuedAt: new Date("2026-08-17T10:00:00+02:00"),
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+49 89 123456",
      orderNumber: "#20260817100000",
      periodFrom: "2026-08-20",
      periodTo: "2026-08-22",
      pickupTime: "10:00",
      dropoffTime: "18:00",
      location: "München",
      quote: {
        totalCents: 12_000,
        bikeSubtotalCents: 10_000,
        equipmentSubtotalCents: 2_500,
        discountCents: 500,
        rentalDays: 2,
        appliedDiscountKeys: [],
        offeredItems: [
          {
            requestedItemId: 1,
            requestedLabel: "Rennrad",
            heightCm: 180,
            assetId: 1,
            assetName: "Road Bike",
            frameNumber: "RB-1",
            dailyPriceCents: 5_000,
            accessories: {
              needsPedals: false,
              pedalType: null,
              needsComputerMount: false,
              computerMountType: null,
              needsHelmet: false,
              needsClothing: false,
            },
          },
        ],
      },
      paidAmountCents: 12_000,
    });

    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
