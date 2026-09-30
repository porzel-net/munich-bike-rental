import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  BookingCommandError: class BookingCommandError extends Error {},
  confirmOfferWithStripePayment: vi.fn(),
  constructStripeWebhookEvent: vi.fn(),
  consumeRequestRateLimit: vi.fn(),
  getDatabase: vi.fn(),
  importStripeCheckoutPayment: vi.fn(),
}));

vi.mock("@/lib/bookings/service", () => ({
  confirmOfferWithStripePayment: mocks.confirmOfferWithStripePayment,
  BookingCommandError: mocks.BookingCommandError,
}));
vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDatabase: mocks.getDatabase };
});
vi.mock("@/lib/financial/stripe-payment", () => ({ importStripeCheckoutPayment: mocks.importStripeCheckoutPayment }));
vi.mock("@/lib/security/rate-limit", () => ({ consumeRequestRateLimit: mocks.consumeRequestRateLimit }));
vi.mock("@/lib/stripe", () => ({
  constructStripeWebhookEvent: mocks.constructStripeWebhookEvent,
  StripeConfigurationError: class StripeConfigurationError extends Error {},
}));

import { POST } from "../../app/api/stripe/webhook/route";
import { createDatabaseConnection } from "../../lib/db/client";
import { bookingOffers, bookings, stripeUnmatchedPayments } from "../../lib/db/schema";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function request() {
  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "test" },
    body: "{}",
  });
}

describe("Stripe webhook reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const stamp = new Date();
    const booking = connection.db
      .insert(bookings)
      .values({
        orderNumber: "#202609300002",
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
        status: "offer_sent",
        quotedTotalCents: 10_000,
        version: 1,
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
        status: "sent",
        tokenHash: "stripe-webhook-test-offer",
        expiresAt: new Date(stamp.getTime() + 60_000),
        totalCents: 10_000,
        priceSnapshotJson: "{}",
        createdAt: stamp,
      })
      .returning({ id: bookingOffers.id })
      .get();
    mocks.getDatabase.mockReturnValue(connection.db);
    mocks.consumeRequestRateLimit.mockReturnValue(true);
    mocks.constructStripeWebhookEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_conflicting_offer_123",
          payment_status: "paid",
          amount_total: 10_000,
          currency: "eur",
          customer_email: "ada@example.com",
          payment_intent: "pi_test_conflicting_offer_123",
          metadata: { booking_offer_id: String(offer.id), booking_id: String(booking.id) },
        },
      },
    });
    mocks.confirmOfferWithStripePayment.mockImplementation(() => {
      throw new mocks.BookingCommandError(
        "Mindestens eines der angebotenen Fahrräder ist inzwischen nicht mehr verfügbar.",
      );
    });
  });

  it("acknowledges a paid but unconfirmable offer and creates an urgent reconciliation record", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, unmatchedPayment: true });
    const database = mocks.getDatabase();
    expect(database.select().from(stripeUnmatchedPayments).all()).toMatchObject([
      {
        stripeSessionId: "cs_test_conflicting_offer_123",
        reason: "Mindestens eines der angebotenen Fahrräder ist inzwischen nicht mehr verfügbar.",
      },
    ]);
    expect(mocks.importStripeCheckoutPayment).not.toHaveBeenCalled();
  });
});
