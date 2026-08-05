import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

import { createDatabaseConnection } from "../../lib/db/client";
import { bookings, communicationMessages, emailActionReviews, mailOutbox } from "../../lib/db/schema";
import { dispatchNextOutboxMail } from "../../lib/bookings/outbox";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

describe("booking mail threads", () => {
  const environment = process.env;

  beforeEach(() => {
    process.env = {
      ...environment,
      SMTP_MAIN_HOST: "smtp.example.com",
      SMTP_MAIN_USER: "main@example.com",
      SMTP_MAIN_PASSWORD: "secret",
      SMTP_MAIN_PORT: "587",
      MAIL_MAIN_FROM_ADDRESS: "main@example.com",
    };
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: "<admin-offer@example.com>" });
  });

  it("replies to the latest message and carries the complete References chain", async () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const created = db
      .insert(bookings)
      .values({
        orderNumber: "#20260804160000",
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
        customerPhone: "+49",
        location: "munich",
        periodFrom: "2026-08-10",
        periodTo: "2026-08-11",
        pickupTime: "10:00",
        dropoffTime: "10:00",
        customerMessage: "Bitte Verfügbarkeit bestätigen.",
        communicationLocale: "de",
        source: "web",
        status: "inquiry_received",
        quotedTotalCents: 10_000,
        createdAt: new Date("2026-08-15T10:00:00+02:00"),
        updatedAt: new Date("2026-08-15T10:00:00+02:00"),
      })
      .returning({ id: bookings.id })
      .get();
    db.insert(communicationMessages)
      .values({
        bookingId: created.id,
        direction: "inbound",
        rfcMessageId: "<customer-inquiry@example.com>",
        threadMessageId: "<customer-inquiry@example.com>",
        inReplyTo: null,
        referencesHeader: null,
        sender: "ada@example.com",
        recipients: "main@example.com",
        subject: "Neue Bike-Anfrage #20260804160000",
        plainText: "Bitte Verfügbarkeit bestätigen.",
        sentAt: new Date("2026-08-15T10:01:00+02:00"),
        archivedAt: new Date("2026-08-15T10:01:00+02:00"),
      })
      .run();
    const firstMail = db
      .insert(mailOutbox)
      .values({
        bookingId: created.id,
        idempotencyKey: "offer:1",
        kind: "offer",
        locale: "de",
        recipient: "ada@example.com",
        subject: "Angebot #20260804160000",
        plainText: "Wir können dir ein Fahrrad anbieten.",
        status: "queued",
        attempts: 0,
        nextAttemptAt: new Date(),
        createdAt: new Date(),
      })
      .returning({ id: mailOutbox.id })
      .get();

    await dispatchNextOutboxMail(db, firstMail.id);

    expect(sendMail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        inReplyTo: "<customer-inquiry@example.com>",
        references: "<customer-inquiry@example.com>",
      }),
    );
    expect(
      db.select().from(communicationMessages).where(eq(communicationMessages.bookingId, created.id)).all(),
    ).toHaveLength(2);
    expect(db.select().from(emailActionReviews).where(eq(emailActionReviews.bookingId, created.id)).all()).toHaveLength(
      1,
    );

    sendMail.mockResolvedValueOnce({ messageId: "<admin-rejection@example.com>" });
    const secondMail = db
      .insert(mailOutbox)
      .values({
        bookingId: created.id,
        idempotencyKey: "booking:1:booking_rejected",
        kind: "booking_rejected",
        locale: "de",
        recipient: "ada@example.com",
        subject: "Buchung abgelehnt #20260804160000",
        plainText: "Leider können wir kein Fahrrad anbieten.",
        status: "queued",
        attempts: 0,
        nextAttemptAt: new Date(),
        createdAt: new Date(),
      })
      .returning({ id: mailOutbox.id })
      .get();

    await dispatchNextOutboxMail(db, secondMail.id);

    expect(sendMail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        inReplyTo: "<admin-offer@example.com>",
        references: "<customer-inquiry@example.com> <admin-offer@example.com>",
      }),
    );
    const messages = db
      .select()
      .from(communicationMessages)
      .where(eq(communicationMessages.bookingId, created.id))
      .all();
    expect(messages.at(-1)).toMatchObject({
      rfcMessageId: "<admin-rejection@example.com>",
      threadMessageId: "<customer-inquiry@example.com>",
      inReplyTo: "<admin-offer@example.com>",
      referencesHeader: "<customer-inquiry@example.com> <admin-offer@example.com>",
    });
    expect(db.select().from(emailActionReviews).where(eq(emailActionReviews.bookingId, created.id)).all()).toHaveLength(
      2,
    );
  });
});
