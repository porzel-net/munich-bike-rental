import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "../../lib/db/client";
import { eq } from "drizzle-orm";
import { accessoryInventory, bikeModels, rentalAssets } from "../../lib/db/schema";
import { seedRentalInventoryIfEmpty } from "../../lib/inventory/seed";
import {
  calculateEquipmentSubtotalCents,
  calculateInquiryPrice,
  calculatePrice,
  getDailyBikePriceCents,
} from "../../lib/inventory/pricing";
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
  it("seeds the normalized physical rental assets used by bookings", () => {
    const db = createTestDatabase();

    expect(db.select().from(rentalAssets).where(eq(rentalAssets.location, "munich")).all()).toHaveLength(13);
  });

  it("seeds the current bike, size and equipment offering by location", () => {
    const db = createTestDatabase();
    const munich = getLocationInventory(db, "munich");
    const regensburg = getLocationInventory(db, "regensburg");

    expect(munich.portfolioItems).toHaveLength(4);
    expect(munich.portfolioItems.find((bike) => bike.title === "Endurace CF SL 8")?.subtitle).toEqual({
      de: "XS / S / M / L",
      en: "XS / S / M / L",
    });
    expect(munich.bikeOptions).toHaveLength(4);
    expect(munich.bikeOptions).toContain("Aeroad CF SL 8");
    expect(munich.requestBikeOptions).toEqual(munich.bikeOptions);
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
    expect(regensburg.requestBikeOptions).toEqual(["Endurace CF SL 8", "Grail CF SL 7"]);
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
      ["long-term", 15],
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

  it("normalizes legacy accessory aliases for availability and pricing", () => {
    const db = createTestDatabase();
    const inventory = getLocationInventory(db, "munich");
    const bike = {
      bikeSize: "Endurace CF SL 8",
      needsPedals: true,
      pedalType: "flat",
      needsComputerMount: true,
      computerMountType: "unknown",
      needsHelmet: false,
      needsClothing: false,
    };

    expect(isRequestAvailable(db, "munich", [bike])).toBe(true);
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
        message: "",
        bikeTitle: "",
        affiliateKey: "",
        locale: "de",
        website: "",
        bikes: [
          {
            height: "180",
            bikeSize: bike.bikeSize,
            needsPedals: bike.needsPedals,
            pedalType: bike.pedalType,
            needsComputerMount: bike.needsComputerMount,
            computerMountType: bike.computerMountType,
            needsHelmet: bike.needsHelmet,
            needsClothing: bike.needsClothing,
            needsBikepackingBag: false,
            needsGlasses: false,
            bottleHolderIncluded: true,
            repairKitIncluded: true,
          },
        ],
      }),
    ).toMatchObject({ equipmentSubtotalCents: 1_000 });
  });

  it("normalizes the persisted pedal-platform alias", () => {
    const db = createTestDatabase();
    const inventory = getLocationInventory(db, "munich");
    const bike = {
      bikeSize: "Endurace CF SL 8",
      needsPedals: true,
      pedalType: "pedal-platform",
      needsComputerMount: false,
      computerMountType: "",
      needsHelmet: false,
      needsClothing: false,
    };

    expect(isRequestAvailable(db, "munich", [bike])).toBe(true);
    expect(inventory.pedalTypes.map((item) => item.value)).toContain("platform");
  });

  it("uses the normalized accessory inventory as the single equipment source", () => {
    const db = createTestDatabase();
    const counted = db
      .select()
      .from(accessoryInventory)
      .where(eq(accessoryInventory.accessoryKey, "pedal-platform"))
      .get()!;

    expect(counted).toMatchObject({
      accessoryKey: "pedal-platform",
      availableQuantity: 1,
      state: "active",
    });
  });

  it("calculates paid equipment centrally for every booking flow", () => {
    const db = createTestDatabase();
    const inventory = getLocationInventory(db, "munich");

    expect(
      calculateEquipmentSubtotalCents(inventory, [
        {
          needsPedals: true,
          pedalType: "spdSl",
          needsComputerMount: true,
          computerMountType: "garmin",
          needsHelmet: true,
          needsClothing: true,
          needsBikepackingBag: true,
          needsGlasses: true,
        },
      ]),
    ).toBe(6_500);
  });

  it("applies the configured location discounts to future rental calculations", () => {
    const db = createTestDatabase();
    const inventory = getLocationInventory(db, "munich");

    expect(
      calculatePrice(inventory, {
        bikes: [{ dailyPriceCents: 4900 }],
        periodFrom: "2026-07-20",
        rentalDays: 3,
        isStudent: true,
      }),
    ).toMatchObject({ bikeSubtotalCents: 14700, discountCents: 1470, totalCents: 13230 });
  });

  it("uses the configured weekday and weekend bike prices for each rental date", () => {
    const db = createTestDatabase();
    const inventory = getLocationInventory(db, "munich");
    const bike = inventory.portfolioItems.find((item) => item.title === "Endurace CF SL 8");

    expect(bike?.weekdayPrice?.de).toBe("Mo-Fr: 49€/Tag");
    expect(bike?.weekendPrice?.de).toBe("Sa-So: 69€/Tag");
    expect(
      calculatePrice(inventory, {
        bikes: [{ weekdayPriceCents: 4_900, weekendPriceCents: 6_900 }],
        periodFrom: "2026-07-24",
        rentalDays: 3,
      }),
    ).toMatchObject({ bikeSubtotalCents: 18_700, discountCents: 0, totalCents: 18_700 });
  });

  it("returns the date-specific daily price used by the canonical calculation", () => {
    const db = createTestDatabase();
    const inventory = getLocationInventory(db, "munich");

    expect(getDailyBikePriceCents(inventory, "Endurace CF SL 8", "2026-07-24")).toBe(4_900);
    expect(getDailyBikePriceCents(inventory, "Endurace CF SL 8", "2026-07-25")).toBe(6_900);
  });

  it("handles malformed catalog JSON without crashing and keeps the real minimum bike price", () => {
    const db = createTestDatabase();
    db.update(bikeModels)
      .set({ galleryJson: "not-json", factsJson: "{}", equipmentJson: '{"de":"broken"}' })
      .where(eq(bikeModels.location, "munich"))
      .run();

    const inventory = getLocationInventory(db, "munich");
    expect(inventory.portfolioItems[0]).toMatchObject({ gallery: [], facts: [], equipment: { de: [], en: [] } });
    expect(inventory.minimumBikePriceCents).toBeGreaterThan(0);
  });

  it("prices each selected asset once with the long-term discount", () => {
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
      bikeSubtotalCents: 24_500,
      equipmentSubtotalCents: 3_500,
      discountCents: 1_470,
      totalCents: 26_530,
      appliedDiscountKeys: ["long-term"],
    });
  });

  it("starts duration discounts on the day after the threshold and caps combined daily discounts at 25%", () => {
    const inventory = {
      discounts: [
        {
          key: "long-term",
          percentage: 15,
          weekdayFrom: null,
          weekdayTo: null,
          minimumRentalDays: 3,
          requiresStudent: false,
          isStackable: false,
        },
        {
          key: "student",
          percentage: 10,
          weekdayFrom: null,
          weekdayTo: null,
          minimumRentalDays: null,
          requiresStudent: true,
          isStackable: true,
        },
        {
          key: "campaign",
          percentage: 20,
          weekdayFrom: null,
          weekdayTo: null,
          minimumRentalDays: null,
          requiresStudent: true,
          isStackable: true,
        },
      ],
    };

    const result = calculatePrice(inventory, {
      bikes: [{ weekdayPriceCents: 10_000, weekendPriceCents: 12_000 }],
      periodFrom: "2026-07-20",
      rentalDays: 4,
      isStudent: true,
    });

    expect(result.dailyBreakdown.map((day) => day.discountPercentage)).toEqual([25, 25, 25, 25]);
    expect(result.dailyBreakdown[0]?.appliedDiscountKeys).toEqual(["student", "campaign"]);
    expect(result.dailyBreakdown[3]?.appliedDiscountKeys).toEqual(["long-term", "student", "campaign"]);
    expect(result.discountCents).toBe(10_000);
    expect(result.totalCents).toBe(30_000);
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
      bikeSubtotalCents: 4_900,
      equipmentSubtotalCents: 3_000,
      discountCents: 0,
      totalCents: 7_900,
    });
  });
});
