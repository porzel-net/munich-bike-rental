import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

import { createDatabaseConnection } from "../../lib/db/client";
import { bookingEvents, bookings, mailOutbox } from "../../lib/db/schema";
import { dispatchNextOutboxMail } from "../../lib/bookings/outbox";
import { createBooking } from "../../lib/bookings/service";
import {
  AUTOMATIC_LOCATION_REJECTION_KIND,
  AUTOMATIC_LOCATION_REJECTION_MAX_DELAY_MS,
  AUTOMATIC_LOCATION_REJECTION_MIN_DELAY_MS,
  automaticLocationRejectionReason,
} from "../../lib/bookings/automatic-location-rejection";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];
const originalEnvironment = process.env;

afterEach(() => {
  process.env = originalEnvironment;
  while (connections.length) connections.pop()?.close();
});

function createWebInquiry(location: "munich" | "regensburg") {
  const connection = createDatabaseConnection(":memory:");
  connections.push(connection);
  const created = createBooking(connection.db, {
    customerName: "Ada Lovelace",
    customerEmail: "ada@example.com",
    customerPhone: "+49 170 1234567",
    location,
    periodFrom: "2026-10-10",
    periodTo: "2026-10-11",
    pickupTime: "10:00",
    dropoffTime: "16:00",
    customerMessage: "Bitte Verfügbarkeit bestätigen.",
    communicationLocale: "de",
    source: "web",
    quotedTotalCents: 10_000,
    requestedItems: [{ requestedLabel: "Endurace CF SL 8", heightCm: 180 }],
  });
  return { ...connection, created };
}

describe("automatic non-Munich inquiry rejection", () => {
  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: "<automatic-rejection@example.com>" });
    process.env = {
      ...originalEnvironment,
      SMTP_MAIN_HOST: "smtp.example.com",
      SMTP_MAIN_USER: "main@example.com",
      SMTP_MAIN_PASSWORD: "secret",
      SMTP_MAIN_PORT: "587",
      MAIL_MAIN_FROM_ADDRESS: "main@example.com",
    };
  });

  it("schedules only non-Munich web inquiries once between one and two hours", () => {
    const { db, created } = createWebInquiry("regensburg");
    const booking = db.select().from(bookings).where(eq(bookings.id, created.id)).get()!;
    const mails = db.select().from(mailOutbox).where(eq(mailOutbox.bookingId, created.id)).all();
    const automaticMail = mails.find((mail) => mail.kind === AUTOMATIC_LOCATION_REJECTION_KIND)!;

    expect(mails).toHaveLength(2);
    expect(automaticMail.recipient).toBe("ada@example.com");
    expect(automaticMail.nextAttemptAt.getTime() - booking.createdAt.getTime()).toBeGreaterThanOrEqual(
      AUTOMATIC_LOCATION_REJECTION_MIN_DELAY_MS,
    );
    expect(automaticMail.nextAttemptAt.getTime() - booking.createdAt.getTime()).toBeLessThan(
      AUTOMATIC_LOCATION_REJECTION_MAX_DELAY_MS,
    );
    expect(automaticMail.plainText).toContain(automaticLocationRejectionReason.de);
    expect(booking.status).toBe("inquiry_received");

    const munich = createWebInquiry("munich");
    expect(munich.db.select().from(mailOutbox).where(eq(mailOutbox.bookingId, munich.created.id)).all()).toHaveLength(
      1,
    );
  });

  it("rejects and records the inquiry when the delayed mail is sent", async () => {
    const { db, created } = createWebInquiry("regensburg");
    const automaticMail = db
      .select()
      .from(mailOutbox)
      .where(and(eq(mailOutbox.bookingId, created.id), eq(mailOutbox.kind, AUTOMATIC_LOCATION_REJECTION_KIND)))
      .get()!;
    db.update(mailOutbox)
      .set({ status: "sent" })
      .where(and(eq(mailOutbox.bookingId, created.id), eq(mailOutbox.kind, "inquiry_received")))
      .run();
    db.update(mailOutbox)
      .set({ nextAttemptAt: new Date(Date.now() - 1_000) })
      .where(eq(mailOutbox.id, automaticMail.id))
      .run();

    const result = await dispatchNextOutboxMail(db, automaticMail.id);

    expect(result).toEqual({ id: automaticMail.id, status: "sent" });
    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, created.id)).get()).toEqual({
      status: "rejected",
    });
    expect(
      db
        .select({ eventType: bookingEvents.eventType, reason: bookingEvents.reason })
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, created.id))
        .all()
        .at(-1),
    ).toEqual({ eventType: "booking_auto_rejected", reason: automaticLocationRejectionReason.de });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("eingewintert") }));
  });

  it("cancels the automatic job when the inquiry was handled meanwhile", async () => {
    const { db, created } = createWebInquiry("regensburg");
    const automaticMail = db
      .select()
      .from(mailOutbox)
      .where(and(eq(mailOutbox.bookingId, created.id), eq(mailOutbox.kind, AUTOMATIC_LOCATION_REJECTION_KIND)))
      .get()!;
    db.update(mailOutbox)
      .set({ status: "sent" })
      .where(and(eq(mailOutbox.bookingId, created.id), eq(mailOutbox.kind, "inquiry_received")))
      .run();
    db.update(bookings).set({ status: "offer_sent" }).where(eq(bookings.id, created.id)).run();
    db.update(mailOutbox)
      .set({ nextAttemptAt: new Date(Date.now() - 1_000) })
      .where(eq(mailOutbox.id, automaticMail.id))
      .run();

    const result = await dispatchNextOutboxMail(db, automaticMail.id);

    expect(result).toEqual({ id: automaticMail.id, status: "cancelled" });
    expect(sendMail).not.toHaveBeenCalled();
    expect(
      db.select({ status: mailOutbox.status }).from(mailOutbox).where(eq(mailOutbox.id, automaticMail.id)).get(),
    ).toEqual({
      status: "cancelled",
    });
  });
});
