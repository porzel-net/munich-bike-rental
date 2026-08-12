import { describe, expect, it } from "vitest";

import { formatReceivedAt, receivedAtFromOrderNumber } from "@/lib/bookings/order-number";

describe("booking order number timestamp", () => {
  it("derives the incoming timestamp from #YYYYMMDDHHMMSS", () => {
    const receivedAt = receivedAtFromOrderNumber("#20260812142631");
    expect(receivedAt).not.toBeNull();
    expect(formatReceivedAt("#20260812142631")).toContain("12.08.2026");
  });

  it("rejects malformed order numbers", () => {
    expect(receivedAtFromOrderNumber("#not-a-date")).toBeNull();
  });
});
