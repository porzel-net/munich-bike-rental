import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "../../lib/db/client";
import { seedRentalInventoryIfEmpty } from "../../lib/inventory/seed";
import { calculateInquiryPrice, calculateRentalPrice } from "../../lib/inventory/pricing";
import { getLocationInventory, isRequestAvailable } from "../../lib/inventory/repository";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function createTestDatabase() {
  const connection = createDatabaseConnection(":memory:");
  seedRentalInventoryIfEmpty(connection.db);
  connections.push(connection);
  return connection.db;
}

describe("location inventory", () => {
  it("seeds the current bike, size and equipment offering by location", () => {
    const db = createTestDatabase();
    const munich = getLocationInventory(db, "munich");
    const regensburg = getLocationInventory(db, "regensburg");

    expect(munich.portfolioItems).toHaveLength(4);
    expect(munich.bikeOptions).toHaveLength(11);
    expect(munich.bikeOptions).toContain("Aeroad CF SL 8 - M");
    expect(regensburg.portfolioItems.map((bike) => bike.title)).toEqual(["Endurace CF SL 8", "Grail CF SL 7"]);
    expect(regensburg.bikeOptions).toHaveLength(7);
    expect(munich.pedalTypes.map((item) => item.value)).toEqual(["platform", "spdSl", "lookKeo2Max", "other"]);
    expect(munich.computerMountTypes.map((item) => item.value)).toEqual(["garmin", "wahoo", "other"]);
    expect(munich.helmetAvailable).toBe(true);
    expect(munich.clothingAvailable).toBe(true);
    expect(munich.discounts.map((discount) => [discount.key, discount.percentage])).toEqual([
      ["weekday", 10],
      ["long-term", 20],
      ["student", 10],
    ]);
  });

  it("accepts only bikes and equipment available at the selected location", () => {
    const db = createTestDatabase();
    const bike = {
      bikeSize: "Endurace CF SL 8 - M",
      needsPedals: true,
      pedalType: "spdSl",
      needsComputerMount: true,
      computerMountType: "garmin",
      needsHelmet: true,
      needsClothing: true,
    };

    expect(isRequestAvailable(db, "regensburg", [bike])).toBe(true);
    expect(isRequestAvailable(db, "regensburg", [{ ...bike, bikeSize: "Aeroad CF SL 8 - M" }])).toBe(false);
    expect(isRequestAvailable(db, "regensburg", [{ ...bike, pedalType: "nonexistent" }])).toBe(false);
  });

  it("uses the configured location discounts for future rental calculations", () => {
    const db = createTestDatabase();
    const inventory = getLocationInventory(db, "regensburg");

    expect(
      calculateRentalPrice(inventory, {
        dailyPriceCents: 4900,
        rentalDays: 3,
        pickupDate: new Date("2026-07-20T12:00:00Z"),
        isStudent: true,
      }),
    ).toMatchObject({ subtotalCents: 14700, discountPercentage: 20, discountCents: 2940, totalCents: 11760 });
  });

  it("prices each selected asset once and applies discounts to every qualifying rental day", () => {
    const db = createTestDatabase();
    const inventory = getLocationInventory(db, "regensburg");

    expect(
      calculateInquiryPrice(inventory, {
        name: "Max Mustermann",
        contact: "max@example.com",
        phone: "+49 123456789",
        location: "regensburg",
        periodFrom: "2026-07-20", // Monday
        periodTo: "2026-07-24", // Friday: five rental days, both dates included
        pickupTime: "10:00",
        dropoffTime: "16:00",
        message: "Bitte Verfügbarkeit bestätigen.",
        bikeTitle: "",
        affiliateKey: "",
        locale: "de",
        website: "",
        bikes: [
          {
            height: "180",
            bikeSize: "Endurace CF SL 8 - M",
            needsPedals: true,
            pedalType: "spdSl",
            needsComputerMount: true,
            computerMountType: "garmin",
            needsHelmet: true,
            needsClothing: true,
          },
        ],
      }),
    ).toMatchObject({
      rentalDays: 5,
      bikeSubtotalCents: 24_500,
      equipmentSubtotalCents: 2_000,
      // Long-term discount (20%) wins over the non-stackable weekday discount on all five days.
      discountCents: 4_900,
      totalCents: 21_600,
      appliedDiscountKeys: ["long-term"],
    });
  });
});
