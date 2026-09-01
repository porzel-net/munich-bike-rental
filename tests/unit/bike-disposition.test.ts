import { describe, expect, it } from "vitest";

import {
  evaluateBikeDisposition,
  inferBikeCategory,
  type BikeDispositionInput,
  type DispositionAsset,
  type DispositionBooking,
} from "@/lib/ai/bike-disposition";

const asset = (
  id: number,
  modelTitle: string,
  size: string,
  overrides: Partial<DispositionAsset> = {},
): DispositionAsset => ({
  id,
  displayName: `${modelTitle} - ${size}`,
  modelKey: modelTitle.toLocaleLowerCase().replaceAll(" ", "-"),
  modelTitle,
  category: inferBikeCategory(modelTitle),
  size,
  location: "munich",
  state: "active",
  weekdayPriceCents: 5_000,
  weekendPriceCents: 7_000,
  ...overrides,
});

const booking = (
  id: number,
  requestedLabel: string,
  heightCm: number,
  overrides: Partial<DispositionBooking> = {},
): DispositionBooking => ({
  id,
  orderNumber: `#202608${String(id).padStart(2, "0")}`,
  customerName: `Kunde ${id}`,
  status: "inquiry_received",
  location: "munich",
  periodFrom: "2026-09-10",
  periodTo: "2026-09-12",
  pickupTime: "08:00",
  dropoffTime: "18:00",
  quotedTotalCents: 10_000,
  requestedItems: [{ id: id * 10, requestedLabel, heightCm }],
  allocations: [],
  ...overrides,
});

function input(
  target: DispositionBooking,
  assets: DispositionAsset[],
  others: DispositionBooking[] = [],
): BikeDispositionInput {
  return { targetBookingId: target.id, assets, bookings: [target, ...others] };
}

describe("bike disposition benchmark suite", () => {
  it.each([
    ["grail", "gravel"],
    ["Grail CF SL 7", "gravel"],
    ["Endurace CF SL 8", "road"],
    ["Aeroad CF SL 8", "road"],
    ["Urban City Bike", "city"],
    ["unbekanntes Modell", "unknown"],
  ] as const)("classifies bike category %s", (model, expected) => {
    expect(inferBikeCategory(model)).toBe(expected);
  });

  it("offers the exact requested model and size when it is free", () => {
    const target = booking(1, "Endurace CF SL 8 - M", 181);
    const result = evaluateBikeDisposition(input(target, [asset(11, "Endurace CF SL 8", "M")]));
    expect(result.suggestions[0]).toMatchObject({ kind: "exact_alternative", targetAssetId: 11, confidence: "high" });
  });

  it("does not mix weaker model or category fallbacks into an exact result", () => {
    const target = booking(101, "Endurace CF SL 8 - M", 181);
    const result = evaluateBikeDisposition(
      input(target, [asset(111, "Endurace CF SL 8", "M"), asset(112, "Grail CF SL 7", "L")]),
    );
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({ kind: "exact_alternative", targetAssetId: 111 });
  });

  it("offers both compatible boundary sizes and only one card per visible size", () => {
    const target = booking(102, "Endurace CF SL 8 - M", 178);
    const result = evaluateBikeDisposition(
      input(target, [
        asset(113, "Endurace CF SL 8", "S"),
        asset(114, "Endurace CF SL 8", "S"),
        asset(115, "Endurace CF SL 8", "M"),
        asset(116, "Endurace CF SL 8", "M"),
      ]),
    );

    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions.map((suggestion) => suggestion.targetAssetName)).toEqual([
      "Endurace CF SL 8 - M",
      "Endurace CF SL 8 - S",
    ]);
    expect(result.suggestions.map((suggestion) => suggestion.kind)).toEqual(["exact_alternative", "size_alternative"]);
  });

  it("offers a different size of the same model when the requested size is not available", () => {
    const target = booking(2, "Endurace CF SL 8 - M", 175);
    const result = evaluateBikeDisposition(
      input(target, [asset(12, "Endurace CF SL 8", "S"), asset(13, "Endurace CF SL 8", "L")]),
    );
    expect(result.suggestions[0]).toMatchObject({ kind: "size_alternative", targetAssetId: 12 });
    expect(result.suggestions[0].fitNote).toContain("passen");
  });

  it("does not suggest an adjacent size that fails the known height table", () => {
    const target = booking(3, "Endurace CF SL 8 - M", 181);
    const result = evaluateBikeDisposition(input(target, [asset(14, "Endurace CF SL 8", "2XS")]));
    expect(result.suggestions[0]?.kind).toBe("no_safe_option");
  });

  it("allows sizes within four centimetres of the published range", () => {
    const target = booking(103, "Endurace CF SL 8 - M", 181);
    const result = evaluateBikeDisposition(
      input(target, [
        asset(117, "Endurace CF SL 8", "S"),
        asset(118, "Endurace CF SL 8", "M"),
        asset(119, "Endurace CF SL 8", "L"),
      ]),
    );

    expect(result.suggestions.map((suggestion) => suggestion.targetAssetName)).toEqual([
      "Endurace CF SL 8 - M",
      "Endurace CF SL 8 - S",
      "Endurace CF SL 8 - L",
    ]);
  });

  it("suggests another model in the same category before a cross-category bike", () => {
    const target = booking(4, "Grail CF SL 7", 170);
    const result = evaluateBikeDisposition(
      input(target, [asset(15, "Gravel Pro", "M"), asset(16, "Endurace CF SL 8", "XS")]),
    );
    expect(result.suggestions[0]).toMatchObject({ kind: "model_alternative", targetAssetId: 15 });
  });

  it("marks road-for-gravel as a cautious category alternative", () => {
    const target = booking(5, "Grail CF SL 7", 170);
    const result = evaluateBikeDisposition(input(target, [asset(17, "Endurace CF SL 8", "XS")]));
    expect(result.suggestions[0]).toMatchObject({ kind: "category_alternative", confidence: "medium" });
    expect(result.suggestions[0].summary).toContain("andere Kategorie");
  });

  it("never offers maintenance or retired assets", () => {
    const target = booking(6, "Endurace CF SL 8 - M", 181);
    const result = evaluateBikeDisposition(
      input(target, [
        asset(18, "Endurace CF SL 8", "M", { state: "maintenance" }),
        asset(19, "Endurace CF SL 8", "M", { state: "retired" }),
      ]),
    );
    expect(result.suggestions[0]?.kind).toBe("no_safe_option");
    expect(
      result.suggestions.some((suggestion) => suggestion.targetAssetId === 18 || suggestion.targetAssetId === 19),
    ).toBe(false);
  });

  it("treats a return at pickup time as non-overlapping", () => {
    const target = booking(7, "Endurace CF SL 8 - M", 181);
    const other = booking(8, "Endurace CF SL 8 - M", 181, {
      status: "confirmed",
      periodFrom: "2026-09-08",
      periodTo: "2026-09-10",
      pickupTime: "10:00",
      dropoffTime: "08:00",
      allocations: [{ assetId: 20, requestedItemId: 80 }],
    });
    const result = evaluateBikeDisposition(input(target, [asset(20, "Endurace CF SL 8", "M")], [other]));
    expect(result.suggestions[0]).toMatchObject({ kind: "exact_alternative", targetAssetId: 20 });
  });

  it("ignores a conflict at another location", () => {
    const target = booking(9, "Endurace CF SL 8 - M", 181, { location: "munich" });
    const other = booking(10, "Endurace CF SL 8 - M", 181, {
      status: "confirmed",
      location: "regensburg",
      allocations: [{ assetId: 21, requestedItemId: 100 }],
    });
    const result = evaluateBikeDisposition(input(target, [asset(21, "Endurace CF SL 8", "M")], [other]));
    expect(result.suggestions[0]).toMatchObject({ kind: "exact_alternative", targetAssetId: 21 });
  });

  it("does not let the target booking block its own current allocation", () => {
    const target = booking(11, "Endurace CF SL 8 - M", 181, {
      status: "confirmed",
      allocations: [{ assetId: 22, requestedItemId: 110 }],
    });
    const result = evaluateBikeDisposition(input(target, [asset(22, "Endurace CF SL 8", "M")]));
    expect(result.suggestions[0]).toMatchObject({ kind: "exact_alternative", targetAssetId: 22 });
  });

  it("never assigns one physical asset twice for a two-bike request", () => {
    const target = booking(12, "Endurace CF SL 8 - M", 181, {
      requestedItems: [
        { id: 121, requestedLabel: "Endurace CF SL 8 - M", heightCm: 181 },
        { id: 122, requestedLabel: "Endurace CF SL 8 - M", heightCm: 181 },
      ],
    });
    const result = evaluateBikeDisposition(input(target, [asset(23, "Endurace CF SL 8", "M")]));
    expect(result.suggestions.filter((suggestion) => suggestion.targetAssetId === 23)).toHaveLength(1);
    expect(result.suggestions.filter((suggestion) => suggestion.kind === "no_safe_option")).toHaveLength(1);
  });

  it("collapses identical no-safe fallbacks for several requested bikes into one booking-level result", () => {
    const target = booking(120, "Endurace CF SL 8 - L", 197, {
      requestedItems: [
        { id: 1201, requestedLabel: "Endurace CF SL 8 - L", heightCm: 197 },
        { id: 1202, requestedLabel: "Endurace CF SL 8 - M", heightCm: 176 },
        { id: 1203, requestedLabel: "Endurace CF SL 8 - L", heightCm: 186 },
      ],
    });
    const result = evaluateBikeDisposition(input(target, []));

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      kind: "no_safe_option",
      title: "Keine sichere Alternative für die Buchung gefunden",
    });
    expect(result.suggestions[0].summary).toContain("3 angefragte Fahrräder");
    expect(result.suggestions[0].requestedLabel).toContain("2× Endurace CF SL 8 - L");
    expect(result.suggestions[0].requestedLabel).toContain("Endurace CF SL 8 - L");
    expect(result.suggestions[0].requestedLabel).toContain("Endurace CF SL 8 - M");
  });

  it("keeps a rejected request explainable while still collapsing repeated fallbacks", () => {
    const target = booking(121, "Endurace CF SL 8 - M", 181, {
      status: "rejected",
      requestedItems: [
        { id: 1211, requestedLabel: "Endurace CF SL 8 - M", heightCm: 181 },
        { id: 1212, requestedLabel: "Endurace CF SL 8 - L", heightCm: 197 },
      ],
    });
    const result = evaluateBikeDisposition(input(target, []));

    expect(result.targetStatus).toBe("rejected");
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.kind).toBe("no_safe_option");
  });

  it("proposes a safe reallocation of an existing customer instead of cancelling them", () => {
    const target = booking(13, "Endurace CF SL 8 - M", 181);
    const affected = booking(14, "Endurace CF SL 8 - S", 175, {
      status: "confirmed",
      quotedTotalCents: 8_000,
      allocations: [{ assetId: 24, requestedItemId: 140 }],
    });
    const result = evaluateBikeDisposition(
      input(target, [asset(24, "Endurace CF SL 8", "M"), asset(25, "Endurace CF SL 8", "S")], [affected]),
    );
    expect(result.suggestions).toContainEqual(
      expect.objectContaining({
        kind: "reallocation",
        affectedBookingId: 14,
        replacementAssetId: 25,
        targetAssetId: 24,
      }),
    );
    expect(result.suggestions.every((suggestion) => !/absag|kündig|cancel/i.test(suggestion.summary))).toBe(true);
  });

  it("does not propose reallocating to an asset that does not fit the affected rider", () => {
    const target = booking(15, "Endurace CF SL 8 - M", 181);
    const affected = booking(16, "Endurace CF SL 8 - S", 175, {
      status: "confirmed",
      allocations: [{ assetId: 26, requestedItemId: 160 }],
    });
    const result = evaluateBikeDisposition(
      input(target, [asset(26, "Endurace CF SL 8", "M"), asset(27, "Endurace CF SL 8", "L")], [affected]),
    );
    expect(result.suggestions.some((suggestion) => suggestion.kind === "reallocation")).toBe(false);
  });

  it("does not suggest moving an unrelated category bike out of another booking", () => {
    const target = booking(161, "Endurace CF SL 8 - M", 181);
    const affected = booking(162, "Grail CF SL 7 - M", 181, {
      status: "confirmed",
      allocations: [{ assetId: 261, requestedItemId: 1620 }],
    });
    const result = evaluateBikeDisposition(input(target, [asset(261, "Grail CF SL 7", "M")], [affected]));
    expect(result.suggestions.some((suggestion) => suggestion.kind === "reallocation")).toBe(false);
    expect(result.suggestions.some((suggestion) => suggestion.kind === "priority_review")).toBe(false);
  });

  it("does not show a reallocation when a safe target alternative is already available", () => {
    const target = booking(163, "Endurace CF SL 8 - M", 181);
    const affected = booking(164, "Endurace CF SL 8 - M", 181, {
      status: "confirmed",
      quotedTotalCents: 8_000,
      allocations: [{ assetId: 262, requestedItemId: 1640 }],
    });
    const result = evaluateBikeDisposition(
      input(target, [asset(262, "Endurace CF SL 8", "M"), asset(263, "Endurace CF SL 8", "M")], [affected]),
    );

    expect(result.suggestions.some((suggestion) => suggestion.kind === "exact_alternative")).toBe(true);
    expect(result.suggestions.some((suggestion) => suggestion.kind === "reallocation")).toBe(false);
  });

  it("treats an active offer with an allocation as a real conflict", () => {
    const target = booking(17, "Endurace CF SL 8 - M", 181);
    const affected = booking(18, "Endurace CF SL 8 - M", 181, {
      status: "offer_sent",
      allocations: [{ assetId: 28, requestedItemId: 180 }],
    });
    const result = evaluateBikeDisposition(input(target, [asset(28, "Endurace CF SL 8", "M")], [affected]));
    expect(result.suggestions.some((suggestion) => suggestion.kind === "date_alternative")).toBe(true);
  });

  it("suggests a nearby alternative period when the bike is only blocked on the requested dates", () => {
    const target = booking(181, "Endurace CF SL 8 - M", 181);
    const affected = booking(182, "Endurace CF SL 8 - M", 181, {
      status: "confirmed",
      allocations: [{ assetId: 281, requestedItemId: 1820 }],
    });
    const result = evaluateBikeDisposition(input(target, [asset(281, "Endurace CF SL 8", "M")], [affected]));
    expect(result.suggestions).toContainEqual(
      expect.objectContaining({
        kind: "date_alternative",
        targetAssetId: 281,
        alternativePeriodFrom: "2026-09-13",
        alternativePeriodTo: "2026-09-15",
      }),
    );
  });

  it("does not block on a cancelled booking whose allocation was released", () => {
    const target = booking(19, "Endurace CF SL 8 - M", 181);
    const affected = booking(20, "Endurace CF SL 8 - M", 181, {
      status: "cancelled",
      allocations: [],
    });
    const result = evaluateBikeDisposition(input(target, [asset(29, "Endurace CF SL 8", "M")], [affected]));
    expect(result.suggestions[0]?.kind).toBe("exact_alternative");
  });

  it("handles an unknown model conservatively and flags manual size checking", () => {
    const target = booking(21, "Touring Special", 181);
    const result = evaluateBikeDisposition(input(target, [asset(30, "Touring Special", "M")]));
    expect(result.suggestions[0]).toMatchObject({ kind: "exact_alternative", confidence: "low" });
    expect(result.suggestions[0].fitNote).toContain("Größentabelle");
  });

  it("never turns a revenue comparison into a cancellation recommendation", () => {
    const target = booking(22, "Endurace CF SL 8 - M", 181, { quotedTotalCents: 5_000 });
    const affected = booking(23, "Endurace CF SL 8 - M", 181, {
      status: "confirmed",
      quotedTotalCents: 20_000,
      allocations: [{ assetId: 31, requestedItemId: 230 }],
    });
    const result = evaluateBikeDisposition(input(target, [asset(31, "Endurace CF SL 8", "M")], [affected]));
    expect(result.suggestions).toContainEqual(expect.objectContaining({ kind: "priority_review" }));
    expect(result.suggestions.find((suggestion) => suggestion.kind === "priority_review")?.summary).toContain(
      "keine Absage",
    );
    expect(result.suggestions.every((suggestion) => suggestion.changesData === false)).toBe(true);
  });

  it("marks every suggestion as requiring human confirmation", () => {
    const target = booking(25, "Endurace CF SL 8 - M", 181);
    const result = evaluateBikeDisposition(input(target, [asset(33, "Endurace CF SL 8", "M")]));
    expect(
      result.suggestions.every((suggestion) => suggestion.requiresManualConfirmation && !suggestion.changesData),
    ).toBe(true);
  });
});
