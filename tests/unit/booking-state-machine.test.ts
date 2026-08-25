import { describe, expect, it } from "vitest";

import { canTransition } from "../../lib/bookings/service";

describe("new booking state machine", () => {
  it("permits only the documented lifecycle transitions", () => {
    expect(canTransition("inquiry_received", "offer_sent")).toBe(true);
    expect(canTransition("inquiry_received", "rejected")).toBe(true);
    expect(canTransition("inquiry_received", "cancelled")).toBe(false);
    expect(canTransition("offer_sent", "confirmed")).toBe(true);
    expect(canTransition("offer_sent", "expired")).toBe(true);
    expect(canTransition("expired", "offer_sent")).toBe(true);
    expect(canTransition("confirmed", "checked_out")).toBe(true);
    expect(canTransition("checked_out", "completed")).toBe(true);
  });

  it("rejects skipping and changing terminal states", () => {
    expect(canTransition("inquiry_received", "confirmed")).toBe(false);
    expect(canTransition("offer_sent", "checked_out")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(canTransition("rejected", "offer_sent")).toBe(false);
  });

  it("keeps every terminal status terminal and does not silently add a reverse path", () => {
    const terminalStatuses = ["completed", "rejected", "cancelled"] as const;
    const allStatuses = [
      "inquiry_received",
      "offer_sent",
      "confirmed",
      "checked_out",
      "completed",
      "rejected",
      "cancelled",
      "expired",
    ] as const;

    for (const terminalStatus of terminalStatuses) {
      for (const target of allStatuses) expect(canTransition(terminalStatus, target)).toBe(false);
    }
    expect(canTransition("expired", "confirmed")).toBe(true);
    expect(canTransition("expired", "offer_sent")).toBe(true);
    expect(canTransition("expired", "cancelled")).toBe(false);
  });
});
