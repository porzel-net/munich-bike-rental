import { afterEach, describe, expect, it } from "vitest";

import { getBookingMigrationPreflight } from "../../lib/bookings/preflight";
import { createDatabaseConnection } from "../../lib/db/client";
import { stripeUnmatchedPayments } from "../../lib/db/schema";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

describe("booking preflight", () => {
  it("lists only unresolved Stripe payments as booking problems", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const occurredAt = new Date("2026-09-30T10:00:00.000Z");

    db.insert(stripeUnmatchedPayments)
      .values([
        {
          stripeSessionId: "cs_test_open_payment",
          stripePaymentIntentId: "pi_test_open_payment",
          amountCents: 12_500,
          currency: "EUR",
          customerEmail: "open@example.com",
          reason: "Das Angebot wurde nicht gefunden.",
          occurredAt,
          detectedAt: occurredAt,
          lastCheckedAt: occurredAt,
        },
        {
          stripeSessionId: "cs_test_resolved_payment",
          amountCents: 8_000,
          currency: "EUR",
          reason: "Bereits zugeordnet.",
          occurredAt,
          detectedAt: occurredAt,
          lastCheckedAt: occurredAt,
          resolvedAt: occurredAt,
        },
      ])
      .run();

    const result = getBookingMigrationPreflight(db);

    expect(result.ok).toBe(false);
    expect(result.unassignedStripePayments).toEqual([
      expect.objectContaining({
        stripeSessionId: "cs_test_open_payment",
        amountCents: 12_500,
        customerEmail: "open@example.com",
      }),
    ]);
  });
});
