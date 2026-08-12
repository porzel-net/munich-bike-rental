import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "../../lib/db/client";
import { eq } from "drizzle-orm";
import { rentalLocationBikes } from "../../lib/db/schema";
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
    expect(munich.bikeOptions).toHaveLength(4);
    expect(munich.bikeOptions).toContain("Aeroad CF SL 8");
    expect(munich.portfolioItems.find((bike) => bike.title === "Endurace CF SL 8")?.discountText).toEqual({
      de: "",
      en: "",
    });
    expect(regensburg.portfolioItems.find((bike) => bike.title === "Endurace CF SL 8")?.discountText).toEqual({
      de: "",
      en: "",
    });
    expect(regensburg.portfolioItems.map((bike) => bike.title)).toEqual(["Endurace CF SL 8", "Grail CF SL 7"]);
    expect(regensburg.bikeOptions).toHaveLength(0);
    expect(munich.pedalTypes.map((item) => item.value)).toEqual(["platform", "spdSl", "lookKeo2Max", "other"]);
    expect(munich.computerMountTypes.map((item) => item.value)).toEqual(["garmin", "wahoo", "other"]);
    expect(munich.helmetAvailable).toBe(true);
    expect(munich.clothingAvailable).toBe(true);
    expect(munich.bikepackingBagAvailable).toBe(true);
    expect(munich.glassesAvailable).toBe(true);
    expect(munich.bottleHolderIncluded).toBe(true);
    expect(munich.repairKitIncluded).toBe(true);
    expect(munich.equipmentPrices).toEqual(
      expect.arrayContaining([
        { key: "bikepacking-bag", priceCents: 2_500 },
        { key: "glasses", priceCents: 500 },
        { key: "bottle-holder", priceCents: 0 },
        { key: "repair-kit", priceCents: 0 },
      ]),
    );
    expect(munich.discounts.map((discount) => [discount.key, discount.percentage])).toEqual([
      ["weekday", 10],
      ["long-term", 20],
      ["student", 10],
    ]);
  });

  it("accepts only bikes and equipment available at the selected location", () => {
    const db = createTestDatabase();
    const bike = {
      bikeSize: "Endurace CF SL 8",
      needsPedals: true,
      pedalType: "spdSl",
      needsComputerMount: true,
      computerMountType: "garmin",
      needsHelmet: true,
      needsClothing: true,
    };

    expect(isRequestAvailable(db, "regensburg", [bike])).toBe(false);
    expect(isRequestAvailable(db, "regensburg", [{ ...bike, bikeSize: "Aeroad CF SL 8 - M" }])).toBe(false);
    expect(isRequestAvailable(db, "regensburg", [{ ...bike, pedalType: "nonexistent" }])).toBe(false);
  });

  it("uses the configured location discounts for future rental calculations", () => {
    const db = createTestDatabase();
    const inventory = getLocationInventory(db, "munich");

    expect(
      calculateRentalPrice(inventory, {
        dailyPriceCents: 5900,
        rentalDays: 3,
        pickupDate: new Date("2026-07-20T12:00:00Z"),
        isStudent: true,
      }),
    ).toMatchObject({ subtotalCents: 17700, discountPercentage: 20, discountCents: 3540, totalCents: 14160 });
  });

  it("handles malformed catalog JSON without crashing and keeps the real minimum bike price", () => {
    const db = createTestDatabase();
    db.update(rentalLocationBikes)
      .set({ galleryJson: "not-json", factsJson: "{}", equipmentJson: '{"de":"broken"}' })
      .where(eq(rentalLocationBikes.location, "munich"))
      .run();

    const inventory = getLocationInventory(db, "munich");
    expect(inventory.portfolioItems[0]).toMatchObject({ gallery: [], facts: [], equipment: { de: [], en: [] } });
    expect(inventory.minimumBikePriceCents).toBeGreaterThan(0);
  });

  it("prices each selected asset once and applies discounts to every qualifying rental day", () => {
    const db = createTestDatabase();
    const inventory = getLocationInventory(db, "munich");

    expect(
      calculateInquiryPrice(inventory, {
        name: "Max Mustermann",
        contact: "max@example.com",
        phone: "+49 123456789",
        location: "munich",
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
            needsBikepackingBag: false,
            needsGlasses: false,
            bottleHolderIncluded: true,
            repairKitIncluded: true,
          },
        ],
      }),
    ).toMatchObject({
      rentalDays: 5,
      bikeSubtotalCents: 29_500,
      equipmentSubtotalCents: 3_500,
      // Long-term discount (20%) wins over the non-stackable weekday discount on all five days.
      discountCents: 5_900,
      totalCents: 27_100,
      appliedDiscountKeys: ["long-term"],
    });
  });

  it("charges paid new extras once and never charges included equipment", () => {
    const db = createTestDatabase();
    const inventory = getLocationInventory(db, "munich");

    expect(
      calculateInquiryPrice(inventory, {
        name: "Max Mustermann",
        contact: "max@example.com",
        phone: "+49 123456789",
        location: "munich",
        periodFrom: "2026-07-20",
        periodTo: "2026-07-20",
        pickupTime: "10:00",
        dropoffTime: "16:00",
        message: "Bitte mit Tasche und Brille.",
        bikeTitle: "",
        affiliateKey: "",
        locale: "de",
        website: "",
        bikes: [
          {
            height: "180",
            bikeSize: "Endurace CF SL 8 - M",
            needsPedals: false,
            pedalType: "",
            needsComputerMount: false,
            computerMountType: "",
            needsHelmet: false,
            needsClothing: false,
            needsBikepackingBag: true,
            needsGlasses: true,
            bottleHolderIncluded: true,
            repairKitIncluded: true,
          },
        ],
      }),
    ).toMatchObject({
      rentalDays: 1,
      bikeSubtotalCents: 5_900,
      equipmentSubtotalCents: 3_000,
      discountCents: 590,
      totalCents: 8_310,
    });
  });
});
