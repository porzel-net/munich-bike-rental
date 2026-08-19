import { beforeEach, describe, expect, it, vi } from "vitest";

const bookingApiMocks = vi.hoisted(() => ({
  context: { db: { marker: "booking-db" }, user: { id: "admin", role: "admin" } },
  getBookingAdminContext: vi.fn(),
  isAdmin: vi.fn(),
  advanceBooking: vi.fn(),
  assignStripePaymentToBooking: vi.fn(),
  cancelBooking: vi.fn(),
  confirmManualBooking: vi.fn(),
  correctJournalEntry: vi.fn(),
  createOffer: vi.fn(),
  recordRefund: vi.fn(),
  setBookingEmailQuestionsResolved: vi.fn(),
  dispatchNextOutboxMail: vi.fn(),
  getStripeCheckoutSession: vi.fn(),
  importStripeCheckoutPayment: vi.fn(),
}));

vi.mock("@/lib/bookings/admin-guard", () => ({
  getBookingAdminContext: bookingApiMocks.getBookingAdminContext,
}));
vi.mock("@/lib/auth/session", () => ({ isAdmin: bookingApiMocks.isAdmin }));
vi.mock("@/lib/bookings/service", () => ({
  advanceBooking: bookingApiMocks.advanceBooking,
  assignStripePaymentToBooking: bookingApiMocks.assignStripePaymentToBooking,
  cancelBooking: bookingApiMocks.cancelBooking,
  confirmManualBooking: bookingApiMocks.confirmManualBooking,
  correctJournalEntry: bookingApiMocks.correctJournalEntry,
  createOffer: bookingApiMocks.createOffer,
  recordRefund: bookingApiMocks.recordRefund,
  setBookingEmailQuestionsResolved: bookingApiMocks.setBookingEmailQuestionsResolved,
}));
vi.mock("@/lib/bookings/outbox", () => ({ dispatchNextOutboxMail: bookingApiMocks.dispatchNextOutboxMail }));
vi.mock("@/lib/stripe", () => ({ getStripeCheckoutSession: bookingApiMocks.getStripeCheckoutSession }));
vi.mock("@/lib/financial/stripe-payment", () => ({
  importStripeCheckoutPayment: bookingApiMocks.importStripeCheckoutPayment,
}));

import { POST as bookingCommandPost } from "../../app/api/admin/bookings/[id]/commands/route";
import { BookingCommandError } from "../../lib/bookings/errors";

function request(body: unknown) {
  return new Request("http://localhost:3000/api/admin/bookings/42/commands", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context() {
  return { params: Promise.resolve({ id: "42" }) };
}

describe("admin booking command API", () => {
  beforeEach(() => {
    bookingApiMocks.context.db = { marker: "booking-db" };
    bookingApiMocks.getBookingAdminContext.mockReset();
    bookingApiMocks.getBookingAdminContext.mockResolvedValue(bookingApiMocks.context);
    bookingApiMocks.isAdmin.mockReset();
    bookingApiMocks.isAdmin.mockReturnValue(true);
    bookingApiMocks.advanceBooking.mockReset();
    bookingApiMocks.assignStripePaymentToBooking.mockReset();
    bookingApiMocks.cancelBooking.mockReset();
    bookingApiMocks.confirmManualBooking.mockReset();
    bookingApiMocks.correctJournalEntry.mockReset();
    bookingApiMocks.createOffer.mockReset();
    bookingApiMocks.recordRefund.mockReset();
    bookingApiMocks.setBookingEmailQuestionsResolved.mockReset();
    bookingApiMocks.dispatchNextOutboxMail.mockReset();
    bookingApiMocks.dispatchNextOutboxMail.mockResolvedValue({ status: "sent" });
    bookingApiMocks.getStripeCheckoutSession.mockReset();
    bookingApiMocks.importStripeCheckoutPayment.mockReset();
    bookingApiMocks.importStripeCheckoutPayment.mockResolvedValue(undefined);
  });

  it("forwards refund commands with their financial metadata", async () => {
    const refund = await bookingCommandPost(
      request({
        command: "refund",
        amountCents: 1_500,
        bookedAt: "2026-08-11",
        financialAccountId: 7,
        reason: "Storno",
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      }),
      context(),
    );
    expect(refund.status).toBe(200);
    expect(bookingApiMocks.recordRefund).toHaveBeenCalledWith(
      bookingApiMocks.context.db,
      expect.objectContaining({ bookingId: 42, amountCents: 1_500, financialAccountId: 7 }),
    );
  });

  it("forwards manual confirmations with dates, amount, and selected assets", async () => {
    const response = await bookingCommandPost(
      request({
        command: "confirm_manual_booking",
        periodFrom: "2026-08-20",
        periodTo: "2026-08-22",
        pickupTime: "09:00",
        dropoffTime: "17:00",
        quotedTotalCents: 12_300,
        assetsByRequestedItem: { "17": 23 },
      }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(bookingApiMocks.confirmManualBooking).toHaveBeenCalledWith(bookingApiMocks.context.db, {
      bookingId: 42,
      actorUserId: "admin",
      details: {
        periodFrom: "2026-08-20",
        periodTo: "2026-08-22",
        pickupTime: "09:00",
        dropoffTime: "17:00",
        quotedTotalCents: 12_300,
        assetsByRequestedItem: { 17: 23 },
      },
    });
  });

  it("forwards the manual email-question resolution status", async () => {
    const response = await bookingCommandPost(
      request({ command: "set_email_questions_resolved", resolved: true }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(bookingApiMocks.setBookingEmailQuestionsResolved).toHaveBeenCalledWith(bookingApiMocks.context.db, {
      bookingId: 42,
      resolved: true,
      actorUserId: "admin",
    });
  });

  it("rejects the legacy payment command so payments go through manual transactions", async () => {
    const response = await bookingCommandPost(
      request({
        command: "payment",
        amountCents: 5_000,
        bookedAt: "2026-08-10",
        financialAccountId: 7,
        reason: "Anzahlung",
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      }),
      context(),
    );
    expect(response.status).toBe(400);
  });

  it("rejects invalid dates, identifiers and inaccessible bookings before dispatching a command", async () => {
    const invalidDate = await bookingCommandPost(
      request({
        command: "payment",
        amountCents: 5_000,
        bookedAt: "2026-02-30",
        financialAccountId: 7,
        reason: "Anzahlung",
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      }),
      context(),
    );
    expect(invalidDate.status).toBe(400);
    const accessible = await bookingCommandPost(request({ command: "expire", reason: "Abgelaufen" }), {
      params: Promise.resolve({ id: "42" }),
    });
    bookingApiMocks.getBookingAdminContext.mockResolvedValueOnce(null);
    expect(accessible.status).toBe(200);
    const denied = await bookingCommandPost(request({ command: "expire", reason: "Abgelaufen" }), {
      params: Promise.resolve({ id: "42" }),
    });
    expect(denied.status).toBe(400);
    expect(bookingApiMocks.advanceBooking).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["expire", "expired"],
    ["check_out", "checked_out"],
    ["complete", "completed"],
  ] as const)("maps %s to the correct booking transition", async (command, target) => {
    const response = await bookingCommandPost(request({ command, reason: "Admin-Test" }), context());
    expect(response.status).toBe(200);
    expect(bookingApiMocks.advanceBooking).toHaveBeenCalledWith(
      bookingApiMocks.context.db,
      42,
      target,
      "admin",
      "Admin-Test",
    );
  });

  it("protects journal correction for admins and returns service errors as conflicts", async () => {
    bookingApiMocks.isAdmin.mockReturnValue(false);
    const forbidden = await bookingCommandPost(
      request({ command: "correct_journal", entryId: 9, reason: "Korrektur" }),
      context(),
    );
    expect(forbidden.status).toBe(403);
    expect(bookingApiMocks.correctJournalEntry).not.toHaveBeenCalled();

    bookingApiMocks.isAdmin.mockReturnValue(true);
    bookingApiMocks.recordRefund.mockImplementation(() => {
      throw new BookingCommandError("Buchung ist bereits abgeschlossen");
    });
    const failed = await bookingCommandPost(
      request({
        command: "refund",
        amountCents: 1_500,
        bookedAt: "2026-08-10",
        financialAccountId: 7,
        reason: "Storno",
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      }),
      context(),
    );
    expect(failed.status).toBe(409);
    expect(await failed.json()).toEqual({ message: "Buchung ist bereits abgeschlossen" });
  });

  it("dispatches cancellation and rejection mails only after the service creates them", async () => {
    bookingApiMocks.cancelBooking.mockReturnValue(11);
    const cancelled = await bookingCommandPost(
      request({
        command: "cancel",
        cancellationFeeCents: 1_000,
        reason: "Kunde storniert",
        cancellationPeriod: "more_than_7_days",
      }),
      context(),
    );
    expect(cancelled.status).toBe(200);
    expect(bookingApiMocks.dispatchNextOutboxMail).toHaveBeenCalledWith(bookingApiMocks.context.db, 11);

    bookingApiMocks.advanceBooking.mockReturnValue(12);
    const rejected = await bookingCommandPost(request({ command: "reject", reason: "Nicht verfügbar" }), context());
    expect(rejected.status).toBe(200);
    expect(bookingApiMocks.dispatchNextOutboxMail).toHaveBeenCalledWith(bookingApiMocks.context.db, 12);
  });

  it("dispatches the confirmation mail after manually assigning a Stripe payment", async () => {
    const queuedMailId = 23;
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({ get: () => ({ id: queuedMailId }) }),
        }),
      }),
    };
    bookingApiMocks.context.db = db as unknown as typeof bookingApiMocks.context.db;
    bookingApiMocks.getStripeCheckoutSession.mockResolvedValue({
      id: "cs_test_manual_assignment",
      payment_status: "paid",
      amount_total: 12_300,
    });
    bookingApiMocks.assignStripePaymentToBooking.mockReturnValue({
      bookingId: 42,
      alreadyConfirmed: false,
    });

    const response = await bookingCommandPost(
      request({ command: "assign_stripe_payment", offerId: 7, sessionId: "cs_test_manual_assignment" }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(bookingApiMocks.dispatchNextOutboxMail).toHaveBeenCalledWith(db, queuedMailId);
  });
});
