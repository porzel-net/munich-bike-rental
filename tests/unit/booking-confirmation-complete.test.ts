import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const confirmationMocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  getPublicBookingByToken: vi.fn(),
  getPublicOfferByToken: vi.fn(),
  confirmOfferWithStripePayment: vi.fn(),
  dispatchNextOutboxMail: vi.fn(),
  importStripeCheckoutPayment: vi.fn(),
  consumePublicOfferRequestRateLimit: vi.fn(),
  getStripeCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDatabase: confirmationMocks.getDatabase };
});
vi.mock("@/lib/bookings/public", () => ({
  getPublicBookingByToken: confirmationMocks.getPublicBookingByToken,
  getPublicOfferByToken: confirmationMocks.getPublicOfferByToken,
}));
vi.mock("@/lib/bookings/service", () => ({
  confirmOfferWithStripePayment: confirmationMocks.confirmOfferWithStripePayment,
  BookingCommandError: class BookingCommandError extends Error {},
}));
vi.mock("@/lib/bookings/outbox", () => ({ dispatchNextOutboxMail: confirmationMocks.dispatchNextOutboxMail }));
vi.mock("@/lib/financial/stripe-payment", () => ({
  importStripeCheckoutPayment: confirmationMocks.importStripeCheckoutPayment,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  consumePublicOfferRequestRateLimit: confirmationMocks.consumePublicOfferRequestRateLimit,
}));
vi.mock("@/lib/stripe", () => ({
  getStripeCheckoutSession: confirmationMocks.getStripeCheckoutSession,
  StripeConfigurationError: class StripeConfigurationError extends Error {},
}));

import { POST } from "../../app/api/booking-confirmation-v2/complete/route";
import { createDatabaseConnection } from "../../lib/db/client";
import { bookings, mailOutbox } from "../../lib/db/schema";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function request(token: string) {
  return new Request("http://localhost:3000/api/booking-confirmation-v2/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, sessionId: "cs_test_confirmation" }),
  });
}

describe("booking confirmation completion API", () => {
  beforeEach(() => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const timestamp = new Date();
    const booking = connection.db
      .insert(bookings)
      .values({
        orderNumber: "#20260816170100",
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
        customerPhone: "+491701234567",
        location: "munich",
        periodFrom: "2026-08-20",
        periodTo: "2026-08-21",
        pickupTime: "10:00",
        dropoffTime: "10:00",
        customerMessage: "",
        communicationLocale: "de",
        source: "web",
        status: "confirmed",
        quotedTotalCents: 10_000,
        version: 2,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning({ id: bookings.id })
      .get();
    const mail = connection.db
      .insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: `booking:${booking.id}:booking_confirmed`,
        kind: "booking_confirmed",
        locale: "de",
        recipient: "ada@example.com",
        subject: "Buchung bestätigt #20260816170100",
        plainText: "Deine Buchung ist bestätigt.",
        status: "queued",
        attempts: 0,
        nextAttemptAt: timestamp,
        createdAt: timestamp,
      })
      .returning({ id: mailOutbox.id })
      .get();

    confirmationMocks.getDatabase.mockReset();
    confirmationMocks.getDatabase.mockReturnValue(connection.db);
    confirmationMocks.getPublicOfferByToken.mockReset();
    confirmationMocks.getPublicBookingByToken.mockReset();
    confirmationMocks.getPublicOfferByToken.mockReturnValue({
      offerId: 7,
      expiresAt: new Date(Date.now() + 60_000),
      status: "sent",
      totalCents: 10_000,
      booking: { locale: "de" },
    });
    confirmationMocks.confirmOfferWithStripePayment.mockReset();
    confirmationMocks.confirmOfferWithStripePayment.mockReturnValue({ bookingId: booking.id, alreadyConfirmed: false });
    confirmationMocks.dispatchNextOutboxMail.mockReset();
    confirmationMocks.dispatchNextOutboxMail.mockResolvedValue({ id: mail.id, status: "sent" });
    confirmationMocks.importStripeCheckoutPayment.mockReset();
    confirmationMocks.importStripeCheckoutPayment.mockResolvedValue(undefined);
    confirmationMocks.consumePublicOfferRequestRateLimit.mockReset();
    confirmationMocks.consumePublicOfferRequestRateLimit.mockReturnValue(true);
    confirmationMocks.getStripeCheckoutSession.mockReset();
    confirmationMocks.getStripeCheckoutSession.mockResolvedValue({
      id: "cs_test_confirmation",
      payment_status: "paid",
      amount_total: 10_000,
      metadata: { booking_offer_id: "7" },
    });
  });

  it("passes the offer token into the confirmation mail workflow", async () => {
    const token = "confirmation-token-1234567890";
    const response = await POST(request(token));

    expect(response.status).toBe(200);
    expect(confirmationMocks.confirmOfferWithStripePayment).toHaveBeenCalledWith(confirmationMocks.getDatabase(), {
      offerId: 7,
      amountCents: 10_000,
      sessionId: "cs_test_confirmation",
      offerToken: token,
    });
    expect(confirmationMocks.dispatchNextOutboxMail).toHaveBeenCalledWith(
      confirmationMocks.getDatabase(),
      expect.any(Number),
    );
  });
});
