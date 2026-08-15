import { describe, expect, it } from "vitest";

import {
  isAssetSelectableForBooking,
  isHistoricalRegensburgEnduraceSAsset,
  isHistoricalRegensburgEnduraceSException,
} from "../../lib/bookings/historical-availability";

const booking = {
  source: "legacy" as const,
  location: "regensburg",
  periodFrom: "2026-07-26",
  periodTo: "2026-08-10",
};
const asset = {
  location: "regensburg",
  state: "maintenance" as const,
  modelTitle: "Endurace CF SL 8",
  size: "S",
};

describe("historical Regensburg availability", () => {
  it("allows the historically issued Endurace S for the exact import window", () => {
    expect(isHistoricalRegensburgEnduraceSAsset(asset)).toBe(true);
    expect(isHistoricalRegensburgEnduraceSException(booking, asset)).toBe(true);
    expect(isAssetSelectableForBooking(booking, asset)).toBe(true);
  });

  it.each([
    ["normal booking", { ...booking, source: "web" as const }],
    ["outside the window", { ...booking, periodFrom: "2026-07-25" }],
    ["different bike", { ...booking }, { ...asset, size: "M" }],
    ["different location", { ...booking }, { ...asset, location: "munich" }],
  ])("rejects %s", (_label, candidateBooking, candidateAsset = asset) => {
    expect(isHistoricalRegensburgEnduraceSException(candidateBooking, candidateAsset)).toBe(false);
  });
});
