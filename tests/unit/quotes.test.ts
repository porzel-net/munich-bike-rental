import { describe, expect, it } from "vitest";

import { parseOfferQuoteSnapshot, tryParseOfferQuoteSnapshot } from "../../lib/bookings/quotes";

describe("offer quote snapshots", () => {
  it("fails closed with a domain error for malformed JSON", () => {
    expect(() => parseOfferQuoteSnapshot("{not-json")).toThrow("gespeicherte Angebotspreis");
    expect(tryParseOfferQuoteSnapshot("{not-json")).toBeNull();
  });

  it("rejects structurally invalid snapshots", () => {
    expect(() => parseOfferQuoteSnapshot(JSON.stringify({ offeredItems: {} }))).toThrow("Angebotspositionen");
  });
});
