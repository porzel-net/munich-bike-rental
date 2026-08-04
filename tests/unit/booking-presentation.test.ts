import { describe, expect, it } from "vitest";

import { euroToCents } from "../../lib/bookings/money";
import { bookingPresentation } from "../../lib/bookings/presentation";

describe("booking presentation helpers", () => {
  it("formats human Euro input without floating-point cents", () => {
    expect(euroToCents("12,34")).toBe(1234);
    expect(euroToCents("12.3")).toBe(1230);
    expect(euroToCents("12.345")).toBeNull();
  });

  it("keeps a label and visual treatment for every persisted status", () => {
    expect(Object.keys(bookingPresentation)).toHaveLength(8);
    expect(bookingPresentation.inquiry_received.primaryAction).toBe("offer");
    expect(bookingPresentation.cancelled.label).toBe("Storniert");
  });
});
