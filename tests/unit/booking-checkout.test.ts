import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const checkoutMocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  getPublicBookingByToken: vi.fn(),
  getPublicBookingContactEmail: vi.fn(),
  getPublicOfferByToken: vi.fn(),
  consumePublicOfferRequestRateLimit: vi.fn(),
  createStripeCheckoutSession: vi.fn(),
  getStripeCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/bookings/public", () => ({
  getPublicBookingByToken: checkoutMocks.getPublicBookingByToken,
  getPublicBookingContactEmail: checkoutMocks.getPublicBookingContactEmail,
  getPublicOfferByToken: checkoutMocks.getPublicOfferByToken,
}));
vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDatabase: checkoutMocks.getDatabase };
});
vi.mock("@/lib/security/rate-limit", () => ({
  consumePublicOfferRequestRateLimit: checkoutMocks.consumePublicOfferRequestRateLimit,
}));
vi.mock("@/lib/stripe", () => ({
  createStripeCheckoutSession: checkoutMocks.createStripeCheckoutSession,
  getStripeCheckoutSession: checkoutMocks.getStripeCheckoutSession,
  StripeConfigurationError: class StripeConfigurationError extends Error {},
}));

import { POST } from "../../app/api/booking-confirmation-v2/checkout/route";
import { createDatabaseConnection } from "../../lib/db/client";
import { bookingOffers, bookings } from "../../lib/db/schema";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];
const token = "checkout-token-1234567890";

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function setup(storedSessionId: string | null = null) {
  const connection = createDatabaseConnection(":memory:");
  connections.push(connection);
  const timestamp = new Date();
  const booking = connection.db
    .insert(bookings)
    .values({
      orderNumber: "#202608270001",
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+491701234567",
      location: "munich",
      periodFrom: "2026-09-01",
      periodTo: "2026-09-02",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      customerMessage: "",
      communicationLocale: "de",
      source: "web",
      status: "offer_sent",
      quotedTotalCents: 10_000,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning({ id: bookings.id, orderNumber: bookings.orderNumber })
    .get();
  const offer = connection.db
    .insert(bookingOffers)
    .values({
      bookingId: booking.id,
      offerNumber: 1,
      status: "sent",
      tokenHash: "checkout-test-token-hash",
      expiresAt: new Date(Date.now() + 60_000),
      stripeSessionId: storedSessionId,
      totalCents: 10_000,
      priceSnapshotJson: "{}",
      createdAt: timestamp,
    })
    .returning({ id: bookingOffers.id })
    .get();

  checkoutMocks.getDatabase.mockReturnValue(connection.db);
  checkoutMocks.getPublicOfferByToken.mockReturnValue({
    offerId: offer.id,
    offerNumber: 1,
    status: "sent",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    totalCents: 10_000,
    booking: { id: booking.id, orderNumber: booking.orderNumber },
  });
  checkoutMocks.getPublicBookingByToken.mockReturnValue(null);
  checkoutMocks.getPublicBookingContactEmail.mockReturnValue("ada@example.com");
  checkoutMocks.consumePublicOfferRequestRateLimit.mockReturnValue(true);
  return { connection, offerId: offer.id, bookingId: booking.id };
}

function request() {
  return new Request("http://localhost:3000/api/booking-confirmation-v2/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

describe("booking Checkout session reuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkoutMocks.getPublicOfferByToken.mockReset();
    checkoutMocks.getPublicBookingByToken.mockReset();
    checkoutMocks.getPublicBookingContactEmail.mockReset();
    checkoutMocks.consumePublicOfferRequestRateLimit.mockReset();
    checkoutMocks.createStripeCheckoutSession.mockReset();
    checkoutMocks.getStripeCheckoutSession.mockReset();
  });

  it("persists the first Checkout Session so repeated requests cannot create another one", async () => {
    const { connection, offerId } = setup();
    checkoutMocks.createStripeCheckoutSession.mockResolvedValue({
      id: "cs_test_first",
      url: "https://checkout.stripe.test/first",
      status: "open",
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(checkoutMocks.createStripeCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: `booking-offer-checkout:${offerId}` }),
    );
    expect(connection.db.select().from(bookingOffers).get()?.stripeSessionId).toBe("cs_test_first");
  });

  it("reuses a still-open stored Checkout Session without calling Stripe to create another", async () => {
    const { offerId, bookingId } = setup("cs_test_existing");
    checkoutMocks.getStripeCheckoutSession.mockResolvedValue({
      id: "cs_test_existing",
      url: "https://checkout.stripe.test/existing",
      status: "open",
      payment_status: "unpaid",
      amount_total: 10_000,
      currency: "eur",
      metadata: { booking_offer_id: String(offerId), booking_id: String(bookingId) },
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sessionId: "cs_test_existing" });
    expect(checkoutMocks.createStripeCheckoutSession).not.toHaveBeenCalled();
  });

  it("uses a new idempotency key only when the stored Checkout Session expired", async () => {
    const { offerId, bookingId } = setup("cs_test_expired");
    checkoutMocks.getStripeCheckoutSession.mockResolvedValue({
      id: "cs_test_expired",
      url: "https://checkout.stripe.test/expired",
      status: "expired",
      payment_status: "unpaid",
      amount_total: 10_000,
      currency: "eur",
      metadata: { booking_offer_id: String(offerId), booking_id: String(bookingId) },
    });
    checkoutMocks.createStripeCheckoutSession.mockResolvedValue({
      id: "cs_test_retry",
      url: "https://checkout.stripe.test/retry",
      status: "open",
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(checkoutMocks.createStripeCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: `booking-offer-checkout:${offerId}:cs_test_expired` }),
    );
  });
});
