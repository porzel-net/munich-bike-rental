import { describe, expect, it } from "vitest";

import { compareInventoryBikes } from "../../lib/inventory/sorting";

const bike = (id: number, title: string, size: string, nickname?: string) => ({
  id,
  location: "munich",
  title,
  size,
  nickname,
});

describe("inventory bike sorting", () => {
  it("sorts by model before size and ignores nicknames", () => {
    const bikes = [
      bike(1, "Grail CF SL 7", "S", "Alpha"),
      bike(2, "Endurace CF SL 8", "L", "Zulu"),
      bike(3, "Grail CF SL 7", "M", "Bravo"),
      bike(4, "Grail CF SL 7", "XS", "Charlie"),
    ];

    expect(bikes.sort(compareInventoryBikes).map(({ title, size }) => `${title} - ${size}`)).toEqual([
      "Endurace CF SL 8 - L",
      "Grail CF SL 7 - XS",
      "Grail CF SL 7 - S",
      "Grail CF SL 7 - M",
    ]);
  });

  it("uses the id only as a stable tie-breaker", () => {
    const bikes = [bike(2, "Grail CF SL 7", "M", "Alpha"), bike(1, "Grail CF SL 7", "M", "Zulu")];

    expect(bikes.sort(compareInventoryBikes).map(({ id }) => id)).toEqual([1, 2]);
  });
});
