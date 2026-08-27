import { describe, expect, it } from "vitest";

import { getInvoicePriceSummary, renderInvoicePdf } from "../../lib/bookings/invoice-pdf";
import { applyCustomOfferPrice, getOfferItemPriceSchedule } from "../../lib/bookings/quotes";

describe("invoice PDF rendering", () => {
  it("keeps old single-rate offer snapshots readable without using them for new quotes", () => {
    expect(getOfferItemPriceSchedule({ weekdayPriceCents: 4_900, weekendPriceCents: 6_900 })).toEqual({
      weekdayPriceCents: 4_900,
      weekendPriceCents: 6_900,
    });
    expect(getOfferItemPriceSchedule({ dailyPriceCents: 5_000 })).toEqual({
      weekdayPriceCents: 5_000,
      weekendPriceCents: 5_000,
    });
    expect(getOfferItemPriceSchedule({ weekdayPriceCents: -1, weekendPriceCents: 6_900 })).toBeUndefined();
  });

  it("separates the canonical rental discount from an individual discount", () => {
    const summary = getInvoicePriceSummary({
      periodFrom: "2026-08-20",
      quote: {
        totalCents: 12_000,
        standardTotalCents: 15_000,
        bikeSubtotalCents: 14_000,
        equipmentSubtotalCents: 2_000,
        discountCents: 1_000,
        customDiscountCents: 3_000,
        customSurchargeCents: 0,
        rentalDays: 3,
        appliedDiscountKeys: ["long-term"],
        bikePriceLines: [{ assetId: 1, baseCents: 14_000, discountCents: 1_000, totalCents: 13_000 }],
        offeredItems: [],
      },
    });

    expect(summary).toEqual({
      bikeSubtotalCents: 14_000,
      equipmentSubtotalCents: 2_000,
      standardDiscountCents: 1_000,
      customDiscountCents: 3_000,
      customSurchargeCents: 0,
      standardTotalCents: 15_000,
      totalCents: 12_000,
    });
  });

  it("derives an individual surcharge when an imported quote is above standard price", () => {
    const summary = getInvoicePriceSummary({
      periodFrom: "2026-08-20",
      quote: {
        totalCents: 17_000,
        standardTotalCents: 15_000,
        bikeSubtotalCents: 14_000,
        equipmentSubtotalCents: 2_000,
        discountCents: 1_000,
        rentalDays: 3,
        appliedDiscountKeys: ["long-term"],
        offeredItems: [],
      },
    });

    expect(summary).toMatchObject({
      standardDiscountCents: 1_000,
      customDiscountCents: 0,
      customSurchargeCents: 2_000,
      standardTotalCents: 15_000,
      totalCents: 17_000,
    });
  });

  it("derives the negotiated discount from the line-item subtotal", () => {
    const quote = applyCustomOfferPrice(
      {
        totalCents: 28_320,
        bikeSubtotalCents: 35_400,
        equipmentSubtotalCents: 0,
        discountCents: 7_080,
        rentalDays: 6,
        appliedDiscountKeys: ["long-term"],
        offeredItems: [],
      },
      12_000,
    );

    expect(quote).toMatchObject({
      totalCents: 12_000,
      calculatedTotalCents: 28_320,
      discountCents: 7_080,
      customPriceCents: 12_000,
      standardTotalCents: 28_320,
      customDiscountCents: 16_320,
      customSurchargeCents: 0,
    });
  });

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
            weekdayPriceCents: 5_000,
            weekendPriceCents: 5_000,
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
        bikePriceLines: [{ assetId: 1, baseCents: 10_000, discountCents: 500, totalCents: 9_500 }],
      },
      paidAmountCents: 12_000,
    });

    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
