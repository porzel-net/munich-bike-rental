import { describe, expect, it } from "vitest";

import {
  BIKE_SIZE_TOLERANCE_CM,
  getCompatibleBikeSizes,
  getBikeSizeWarning,
  getRecommendedBikeSize,
  getRecommendedHeight,
  hasBikeSizeTable,
} from "@/lib/bikes/size-fit";

describe("bike size fit", () => {
  it("recommends a size for every supported Canyon road bike model", () => {
    expect(getRecommendedBikeSize("Aeroad CF SL 8", 180)).toBe("M");
    expect(getRecommendedBikeSize("Grail CF SL 7", 170)).toBe("XS");
    expect(getRecommendedBikeSize("Ultimate CF SL 7", 155)).toBe("3XS");
    expect(getRecommendedBikeSize("Aeroad CF SL 8", 150)).toBeNull();
    expect(hasBikeSizeTable("Aeroad CF SL 8")).toBe(true);
  });

  it("uses the same ranges to infer a missing height from a requested size", () => {
    expect(getRecommendedHeight("Endurace CF SL 8 - M")).toBe(181);
  });

  it("returns both valid boundary sizes", () => {
    expect(getCompatibleBikeSizes("Endurace CF SL 8", 178)).toEqual(["S", "M"]);
  });

  it("supports the disposition tolerance explicitly", () => {
    expect(getCompatibleBikeSizes("Endurace CF SL 8", 181, BIKE_SIZE_TOLERANCE_CM)).toEqual(["S", "M", "L"]);
  });

  it("does not include M for a 172 cm rider even with disposition tolerance", () => {
    expect(getCompatibleBikeSizes("Endurace CF SL 8", 172, BIKE_SIZE_TOLERANCE_CM)).toEqual(["XS", "S"]);
  });

  it("warns when the selected size does not fit the rider", () => {
    expect(getBikeSizeWarning("Aeroad CF SL 8 - S", 180)).toMatchObject({
      selectedSize: "S",
      recommendedRange: { size: "M" },
    });
    expect(getBikeSizeWarning("Aeroad CF SL 8 - M", 180)).toBeNull();
  });
});
