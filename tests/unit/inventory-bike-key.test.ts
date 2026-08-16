import { describe, expect, it } from "vitest";

import { createBikeKey, getBikeKeyForUpdate } from "../../lib/inventory/bike-key";

describe("inventory bike keys", () => {
  it("creates a normalized key from model and size", () => {
    expect(createBikeKey("Endurace CF SL 8", "M")).toBe("endurace-cf-sl-8-m");
  });

  it("preserves an existing occurrence key when only metadata changes", () => {
    expect(
      getBikeKeyForUpdate({
        existingBikeKey: "endurace-cf-sl-8-m-2",
        existingTitle: "Endurace CF SL 8",
        existingSize: "M",
        nextTitle: " Endurace CF SL 8 ",
        nextSize: " M ",
      }),
    ).toBe("endurace-cf-sl-8-m-2");
  });

  it.each([
    { nextTitle: "Endurace CF SL 9", nextSize: "M" },
    { nextTitle: "Endurace CF SL 8", nextSize: "L" },
  ])("rebuilds the key when the identity changes: %s", ({ nextTitle, nextSize }) => {
    expect(
      getBikeKeyForUpdate({
        existingBikeKey: "endurace-cf-sl-8-m-2",
        existingTitle: "Endurace CF SL 8",
        existingSize: "M",
        nextTitle,
        nextSize,
      }),
    ).toBe(createBikeKey(nextTitle, nextSize));
  });
});
