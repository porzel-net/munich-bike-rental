import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const stripeMocks = vi.hoisted(() => ({
  expireStripeCheckoutSession: vi.fn(),
  getStripeCheckoutSession: vi.fn(),
}));

vi.mock("../../lib/stripe", () => stripeMocks);

import { expireInvalidatedStripeCheckoutSessions } from "../../lib/bookings/stripe-session-lifecycle";
import { createDatabaseConnection } from "../../lib/db/client";
import { bookingOffers, bookings, stripeUnmatchedPayments } from "../../lib/db/schema";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
  vi.clearAllMocks();
});

function createInvalidOffer(status: "expired" | "revoked") {
  const connection = createDatabaseConnection(":memory:");
  connections.push(connection);
  const stamp = new Date();
  const booking = connection.db
    .insert(bookings)
    .values({
      orderNumber: "#202609300001",
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+491701234567",
      location: "munich",
      periodFrom: "2026-10-10",
      periodTo: "2026-10-11",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      customerMessage: "",
      communicationLocale: "de",
      source: "web",
      status: status === "expired" ? "expired" : "cancelled",
      quotedTotalCents: 10_000,
      version: 2,
      createdAt: stamp,
      updatedAt: stamp,
    })
    .returning({ id: bookings.id })
    .get();
  const offer = connection.db
    .insert(bookingOffers)
    .values({
      bookingId: booking.id,
      offerNumber: 1,
      status,
      tokenHash: `invalid-offer-${status}`,
      expiresAt: new Date(stamp.getTime() - 1_000),
      stripeSessionId: `cs_test_${status}_offer_123`,
      totalCents: 10_000,
      priceSnapshotJson: "{}",
      createdAt: stamp,
    })
    .returning({ id: bookingOffers.id })
    .get();
  return { connection, offer };
}

describe("obsolete Stripe Checkout sessions", () => {
  it("expires an open session once and records the durable completion marker", async () => {
    const { connection, offer } = createInvalidOffer("revoked");
    stripeMocks.getStripeCheckoutSession.mockResolvedValue({
      id: "cs_test_revoked_offer_123",
      status: "open",
      payment_status: "unpaid",
    });
    stripeMocks.expireStripeCheckoutSession.mockResolvedValue({ status: "expired" });

    await expect(expireInvalidatedStripeCheckoutSessions(connection.db)).resolves.toEqual({
      scanned: 1,
      invalidated: 1,
      failed: 0,
    });
    expect(stripeMocks.expireStripeCheckoutSession).toHaveBeenCalledWith("cs_test_revoked_offer_123");
    expect(
      connection.db
        .select({ invalidatedAt: bookingOffers.stripeSessionInvalidatedAt })
        .from(bookingOffers)
        .where(eq(bookingOffers.id, offer.id))
        .get()?.invalidatedAt,
    ).toBeInstanceOf(Date);

    await expireInvalidatedStripeCheckoutSessions(connection.db);
    expect(stripeMocks.expireStripeCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("raises an urgent reconciliation record when an invalidated offer was already paid", async () => {
    const { connection } = createInvalidOffer("expired");
    stripeMocks.getStripeCheckoutSession.mockResolvedValue({
      id: "cs_test_expired_offer_123",
      status: "complete",
      payment_status: "paid",
      amount_total: 10_000,
      currency: "eur",
      customer_email: "ada@example.com",
      payment_intent: "pi_test_expired_offer_123",
      metadata: { booking_offer_id: "1", booking_id: "1" },
    });

    await expireInvalidatedStripeCheckoutSessions(connection.db);

    expect(stripeMocks.expireStripeCheckoutSession).not.toHaveBeenCalled();
    expect(connection.db.select().from(stripeUnmatchedPayments).all()).toMatchObject([
      {
        stripeSessionId: "cs_test_expired_offer_123",
        reason: "Stripe-Zahlung für ein abgelaufenes Angebot.",
      },
    ]);
  });
});
