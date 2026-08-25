import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const stripeMocks = vi.hoisted(() => ({
  createStripeRefund: vi.fn(),
  getStripeCheckoutSession: vi.fn(),
}));

vi.mock("../../lib/stripe", () => stripeMocks);

import { createDatabaseConnection } from "../../lib/db/client";
import { authUser, bookingOffers, bookings, financialTransactions, journalLines } from "../../lib/db/schema";
import { refundStripeBookingPayment } from "../../lib/financial/stripe-refunds";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  stripeMocks.createStripeRefund.mockReset();
  stripeMocks.getStripeCheckoutSession.mockReset();
  while (connections.length) connections.pop()?.close();
});

function setup() {
  const connection = createDatabaseConnection(":memory:");
  connections.push(connection);
  const { db } = connection;
  db.insert(authUser)
    .values({
      id: "admin",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  const booking = db
    .insert(bookings)
    .values({
      orderNumber: "REFUND-1",
      customerName: "Refund Customer",
      customerEmail: "refund@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-08-20",
      periodTo: "2026-08-21",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      source: "web",
      status: "cancelled",
      quotedTotalCents: 10_000,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();
  const offer = db
    .insert(bookingOffers)
    .values({
      bookingId: booking.id,
      offerNumber: 1,
      status: "accepted",
      tokenHash: "refund-token",
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: new Date(),
      totalCents: 10_000,
      stripeSessionId: "cs_test_refund",
      stripePaymentIntentId: "pi_test_refund",
      createdAt: new Date(),
    })
    .returning()
    .get();
  stripeMocks.createStripeRefund.mockResolvedValue({
    id: "re_test_refund",
    amount: 4_000,
    currency: "eur",
    status: "succeeded",
  });
  return { db, booking, offer };
}

describe("Stripe booking refunds", () => {
  it("posts a partial Stripe refund against receivables and is retry-safe", async () => {
    const { db, booking, offer } = setup();
    const result = await refundStripeBookingPayment(db, {
      bookingId: booking.id,
      amountCents: 4_000,
      reason: "Storno vor Mietbeginn",
      actorUserId: "admin",
      idempotencyKey: "refund-key-1",
    });

    expect(result).toMatchObject({ alreadyRefunded: false });
    expect(stripeMocks.createStripeRefund).toHaveBeenCalledWith({
      paymentIntentId: offer.stripePaymentIntentId,
      amountCents: 4_000,
      idempotencyKey: "refund-key-1",
    });
    expect(
      db
        .select({ amountCents: financialTransactions.amountCents, status: financialTransactions.status })
        .from(financialTransactions)
        .where(eq(financialTransactions.reference, "cs_test_refund"))
        .get(),
    ).toEqual({ amountCents: -4_000, status: "posted" });
    expect(
      db
        .select({ account: journalLines.account, amountCents: journalLines.amountCents })
        .from(journalLines)
        .where(eq(journalLines.entryId, result.journalEntryId))
        .all()
        .sort((a, b) => a.account.localeCompare(b.account)),
    ).toEqual([
      { account: "accounts_receivable", amountCents: 4_000 },
      { account: "stripe_main", amountCents: -4_000 },
    ]);

    await expect(
      refundStripeBookingPayment(db, {
        bookingId: booking.id,
        amountCents: 4_000,
        reason: "Retry",
        actorUserId: "admin",
        idempotencyKey: "refund-key-1",
      }),
    ).resolves.toMatchObject({ alreadyRefunded: true, journalEntryId: result.journalEntryId });
    expect(stripeMocks.createStripeRefund).toHaveBeenCalledTimes(1);
  });

  it("never permits the known Stripe payment to be refunded twice", async () => {
    const { db, booking } = setup();
    await refundStripeBookingPayment(db, {
      bookingId: booking.id,
      amountCents: 4_000,
      reason: "Erste Teilrückzahlung",
      actorUserId: "admin",
      idempotencyKey: "refund-key-1",
    });

    stripeMocks.createStripeRefund.mockResolvedValue({
      id: "re_test_refund_2",
      amount: 6_000,
      currency: "eur",
      status: "succeeded",
    });
    await expect(
      refundStripeBookingPayment(db, {
        bookingId: booking.id,
        amountCents: 6_001,
        reason: "Zu viel",
        actorUserId: "admin",
        idempotencyKey: "refund-key-2",
      }),
    ).rejects.toThrow("nicht erstatteten Stripe-Betrag");
    expect(stripeMocks.createStripeRefund).toHaveBeenCalledTimes(1);
  });
});
