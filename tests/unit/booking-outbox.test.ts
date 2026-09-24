import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const { sendMail, renderInvoicePdf } = vi.hoisted(() => ({ sendMail: vi.fn(), renderInvoicePdf: vi.fn() }));
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));
vi.mock("../../lib/bookings/invoice-pdf", () => ({ renderInvoicePdf }));

import { createDatabaseConnection } from "../../lib/db/client";
import {
  authUser,
  bookingOffers,
  bookings,
  communicationMessages,
  emailActionReviews,
  journalEntries,
  journalLines,
  mailOutbox,
} from "../../lib/db/schema";
import { dispatchNextOutboxMail, MAX_MAIL_ATTEMPTS, retryFailedOutboxMail } from "../../lib/bookings/outbox";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

function createOutboxBooking(db: ReturnType<typeof createDatabaseConnection>["db"], orderNumber: string) {
  const timestamp = new Date(Date.now() - 1_000);
  return db
    .insert(bookings)
    .values({
      orderNumber,
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-08-10",
      periodTo: "2026-08-11",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      customerMessage: "",
      communicationLocale: "de",
      source: "web",
      status: "offer_sent",
      quotedTotalCents: 10_000,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning({ id: bookings.id })
    .get();
}

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
    renderInvoicePdf.mockReset();
    renderInvoicePdf.mockResolvedValue(Buffer.from("%PDF-test"));
  });

  it("replies to the latest message and carries the complete References chain", async () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const inquirySentAt = new Date(Date.now() - 120_000);
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
        sentAt: inquirySentAt,
        archivedAt: inquirySentAt,
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
        envelope: { from: "main@example.com", to: "ada@example.com" },
        inReplyTo: "<customer-inquiry@example.com>",
        references: "<customer-inquiry@example.com>",
        text: "Wir können dir ein Fahrrad anbieten.",
        html: expect.stringContaining("Your Bike Rental"),
      }),
    );
    expect(
      db.select().from(communicationMessages).where(eq(communicationMessages.bookingId, created.id)).all(),
    ).toHaveLength(2);
    expect(db.select().from(emailActionReviews).where(eq(emailActionReviews.bookingId, created.id)).all()).toHaveLength(
      0,
    );

    const customerFollowUpAt = new Date(Date.now() + 1_000);
    db.insert(communicationMessages)
      .values({
        bookingId: created.id,
        direction: "inbound",
        rfcMessageId: "<customer-follow-up@example.com>",
        threadMessageId: "<customer-inquiry@example.com>",
        inReplyTo: "<admin-offer@example.com>",
        referencesHeader: "<customer-inquiry@example.com> <admin-offer@example.com>",
        sender: "ada@example.com",
        recipients: "main@example.com",
        subject: "Re: Angebot #20260804160000",
        plainText: "Danke, ich habe noch eine Frage.",
        sentAt: customerFollowUpAt,
        archivedAt: customerFollowUpAt,
      })
      .run();

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
        inReplyTo: "<customer-follow-up@example.com>",
        references: "<customer-inquiry@example.com> <admin-offer@example.com> <customer-follow-up@example.com>",
      }),
    );
    const messages = db
      .select()
      .from(communicationMessages)
      .where(eq(communicationMessages.bookingId, created.id))
      .all();
    expect(messages.find((message) => message.rfcMessageId === "<admin-rejection@example.com>")).toMatchObject({
      rfcMessageId: "<admin-rejection@example.com>",
      threadMessageId: "<customer-inquiry@example.com>",
      inReplyTo: "<customer-follow-up@example.com>",
      referencesHeader: "<customer-inquiry@example.com> <admin-offer@example.com> <customer-follow-up@example.com>",
    });
    expect(db.select().from(emailActionReviews).where(eq(emailActionReviews.bookingId, created.id)).all()).toHaveLength(
      0,
    );
  });

  it("attaches the paid booking invoice to the confirmation mail", async () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const timestamp = new Date();
    const booking = db
      .insert(bookings)
      .values({
        orderNumber: "#20260804170000",
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
        customerPhone: "+49",
        location: "munich",
        periodFrom: "2026-08-10",
        periodTo: "2026-08-11",
        pickupTime: "10:00",
        dropoffTime: "10:00",
        customerMessage: "",
        communicationLocale: "de",
        source: "web",
        status: "confirmed",
        invoiceNumber: "YBR-2026-0001",
        invoiceIssuedAt: timestamp,
        quotedTotalCents: 8_000,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning({ id: bookings.id })
      .get();
    db.insert(bookingOffers)
      .values({
        bookingId: booking.id,
        offerNumber: 1,
        status: "accepted",
        tokenHash: "invoice-test-token",
        totalCents: 12_000,
        priceSnapshotJson: JSON.stringify({ totalCents: 12_000, offeredItems: [] }),
        expiresAt: timestamp,
        acceptedAt: timestamp,
        createdAt: timestamp,
      })
      .run();
    const charge = db
      .insert(journalEntries)
      .values({
        bookingId: booking.id,
        kind: "rental_charge",
        reason: "Test charge",
        occurredAt: timestamp,
        createdAt: timestamp,
      })
      .returning({ id: journalEntries.id })
      .get();
    db.insert(journalLines)
      .values([
        { entryId: charge.id, account: "accounts_receivable", amountCents: 8_000 },
        { entryId: charge.id, account: "rental_revenue", amountCents: -8_000 },
      ])
      .run();
    const payment = db
      .insert(journalEntries)
      .values({
        bookingId: booking.id,
        kind: "payment_received",
        reason: "Test payment",
        occurredAt: timestamp,
        createdAt: timestamp,
      })
      .returning({ id: journalEntries.id })
      .get();
    db.insert(journalLines)
      .values([
        { entryId: payment.id, account: "stripe_clearing", amountCents: 8_000 },
        { entryId: payment.id, account: "accounts_receivable", amountCents: -8_000 },
      ])
      .run();
    const mail = db
      .insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: "booking:invoice-confirmed",
        kind: "booking_confirmed",
        locale: "de",
        recipient: "ada@example.com",
        subject: "Buchung bestätigt #20260804170000",
        plainText: "Deine Buchung ist bestätigt.",
        status: "queued",
        attempts: 0,
        nextAttemptAt: timestamp,
        createdAt: timestamp,
      })
      .returning({ id: mailOutbox.id })
      .get();

    await dispatchNextOutboxMail(db, mail.id);

    expect(renderInvoicePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: "YBR-2026-0001",
        location: "München",
        paidAmountCents: 8_000,
        quote: expect.objectContaining({ totalCents: 8_000 }),
      }),
    );
    expect(sendMail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: "YBR-2026-0001.pdf",
            content: Buffer.from("%PDF-test"),
            contentType: "application/pdf",
          }),
        ]),
      }),
    );
  });

  it("attaches one company contact card with location staff and admin phone numbers", async () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const timestamp = new Date();
    db.insert(authUser)
      .values({
        id: "munich-staff",
        name: "Max Mustermann",
        email: "max@example.com",
        role: "standortuser",
        locationKey: "munich",
        whatsappPhone: "+49 170 1234567",
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
    db.insert(authUser)
      .values({
        id: "munich-staff-2",
        name: "Erika Beispiel",
        email: "erika@example.com",
        role: "standortuser",
        locationKey: "munich",
        whatsappPhone: "+49 171 7654321",
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
    db.insert(authUser)
      .values({
        id: "admin",
        name: "Julius Porzel",
        email: "julius@example.com",
        role: "admin",
        locationKey: null,
        whatsappPhone: "+49 172 1122334",
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
    const booking = db
      .insert(bookings)
      .values({
        orderNumber: "#20260804180000",
        assignedUserId: "munich-staff",
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
        customerPhone: "+49 111",
        location: "munich",
        periodFrom: "2026-08-10",
        periodTo: "2026-08-11",
        pickupTime: "10:00",
        dropoffTime: "10:00",
        customerMessage: "",
        communicationLocale: "de",
        source: "web",
        status: "offer_sent",
        quotedTotalCents: 12_000,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning({ id: bookings.id })
      .get();
    const mail = db
      .insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: "offer:staff-contact-card",
        kind: "offer",
        locale: "de",
        recipient: "ada@example.com",
        subject: "Angebot #20260804180000",
        plainText: "Wir können dir ein Fahrrad anbieten.",
        status: "queued",
        attempts: 0,
        nextAttemptAt: timestamp,
        createdAt: timestamp,
      })
      .returning({ id: mailOutbox.id })
      .get();

    await dispatchNextOutboxMail(db, mail.id);

    expect(sendMail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: "Your-Bike-Rental.vcf",
            contentType: "text/vcard; charset=utf-8",
            content: expect.any(Buffer),
          }),
        ]),
      }),
    );
    const attachment = sendMail.mock.calls
      .at(-1)?.[0]
      ?.attachments?.find((candidate: { filename?: string }) => candidate.filename === "Your-Bike-Rental.vcf");
    expect(attachment?.content.toString("utf8")).toContain("FN:Your Bike Rental");
    expect(attachment?.content.toString("utf8")).toContain("TEL;TYPE=WORK,VOICE;PREF=1:+498954193577");
    expect(attachment?.content.toString("utf8")).toContain("item1.TEL;TYPE=WORK,VOICE:+49 172 1122334");
    expect(attachment?.content.toString("utf8")).toContain("item2.TEL;TYPE=WORK,VOICE:+49 170 1234567");
    expect(attachment?.content.toString("utf8")).toContain("item3.TEL;TYPE=WORK,VOICE:+49 171 7654321");
  });

  it("allows only one active worker lease at a time", async () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const booking = createOutboxBooking(db, "#20260804190000");
    const first = db
      .insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: "queue:first",
        kind: "offer",
        locale: "de",
        recipient: "ada@example.com",
        subject: "Erste Mail",
        plainText: "Erste Mail",
        status: "queued",
        attempts: 0,
        nextAttemptAt: new Date(Date.now() - 1_000),
        createdAt: new Date(Date.now() - 2_000),
      })
      .returning({ id: mailOutbox.id })
      .get();
    const second = db
      .insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: "queue:second",
        kind: "offer",
        locale: "de",
        recipient: "ada@example.com",
        subject: "Zweite Mail",
        plainText: "Zweite Mail",
        status: "queued",
        attempts: 0,
        nextAttemptAt: new Date(Date.now() - 1_000),
        createdAt: new Date(Date.now() - 1_000),
      })
      .returning({ id: mailOutbox.id })
      .get();

    let releaseSend!: (value: { messageId: string }) => void;
    let sendStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      sendStarted = resolve;
    });
    sendMail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseSend = resolve;
          sendStarted();
        }),
    );
    const firstDispatch = dispatchNextOutboxMail(db, first.id);
    await started;

    expect(await dispatchNextOutboxMail(db, second.id)).toBeNull();
    releaseSend({ messageId: "<first@example.com>" });
    await expect(firstDispatch).resolves.toMatchObject({ id: first.id, status: "sent" });
    expect(db.select().from(mailOutbox).where(eq(mailOutbox.id, second.id)).get()?.status).toBe("queued");
  });

  it("records SMTP failures and allows an explicit retry without losing the attempt count", async () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const booking = createOutboxBooking(db, "#20260804191000");
    const mail = db
      .insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: "queue:retry",
        kind: "offer",
        locale: "de",
        recipient: "ada@example.com",
        subject: "Retry-Mail",
        plainText: "Retry-Mail",
        status: "queued",
        attempts: 0,
        nextAttemptAt: new Date(Date.now() - 1_000),
        createdAt: new Date(Date.now() - 1_000),
      })
      .returning({ id: mailOutbox.id })
      .get();
    sendMail.mockRejectedValueOnce(new Error("SMTP offline"));

    await expect(dispatchNextOutboxMail(db, mail.id)).resolves.toMatchObject({ id: mail.id, status: "failed" });
    expect(db.select().from(mailOutbox).where(eq(mailOutbox.id, mail.id)).get()).toMatchObject({
      status: "failed",
      attempts: 1,
      lastError: "SMTP offline",
    });

    expect(retryFailedOutboxMail(db, mail.id)).toBe(true);
    expect(db.select().from(mailOutbox).where(eq(mailOutbox.id, mail.id)).get()).toMatchObject({
      status: "queued",
      attempts: 1,
      lastError: null,
    });
    sendMail.mockResolvedValueOnce({ messageId: "<retry@example.com>" });
    await expect(dispatchNextOutboxMail(db, mail.id)).resolves.toMatchObject({ id: mail.id, status: "sent" });
  });

  it("aborts a mail after exactly ten failed attempts", async () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const booking = createOutboxBooking(db, "#20260804192000");
    const mail = db
      .insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: "queue:max-attempts",
        kind: "offer",
        locale: "de",
        recipient: "ada@example.com",
        subject: "Maximale Versuche",
        plainText: "Maximale Versuche",
        status: "queued",
        attempts: 0,
        nextAttemptAt: new Date(Date.now() - 1_000),
        createdAt: new Date(Date.now() - 1_000),
      })
      .returning({ id: mailOutbox.id })
      .get();
    sendMail.mockRejectedValue(new Error("SMTP offline"));

    for (let attempt = 1; attempt <= MAX_MAIL_ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        db.update(mailOutbox)
          .set({ status: "queued", nextAttemptAt: new Date(Date.now() - 1_000) })
          .where(eq(mailOutbox.id, mail.id))
          .run();
      }
      await expect(dispatchNextOutboxMail(db, mail.id)).resolves.toMatchObject({
        id: mail.id,
        status: attempt === MAX_MAIL_ATTEMPTS ? "cancelled" : "failed",
      });
    }

    expect(db.select().from(mailOutbox).where(eq(mailOutbox.id, mail.id)).get()).toMatchObject({
      status: "cancelled",
      attempts: MAX_MAIL_ATTEMPTS,
      lastError: "SMTP offline",
    });
    expect(sendMail).toHaveBeenCalledTimes(MAX_MAIL_ATTEMPTS);
    await expect(dispatchNextOutboxMail(db, mail.id)).resolves.toBeNull();
  });

  it("does not turn a stale tenth lease into an eleventh attempt", async () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const booking = createOutboxBooking(db, "#20260804192100");
    const mail = db
      .insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: "queue:stale-tenth-attempt",
        kind: "offer",
        locale: "de",
        recipient: "ada@example.com",
        subject: "Stale Lease",
        plainText: "Stale Lease",
        status: "leased",
        attempts: MAX_MAIL_ATTEMPTS,
        nextAttemptAt: new Date(Date.now() - 1_000),
        leasedAt: new Date(Date.now() - 120_000),
        createdAt: new Date(Date.now() - 120_000),
      })
      .returning({ id: mailOutbox.id })
      .get();

    await expect(dispatchNextOutboxMail(db, mail.id)).resolves.toBeNull();
    expect(db.select().from(mailOutbox).where(eq(mailOutbox.id, mail.id)).get()).toMatchObject({
      status: "cancelled",
      attempts: MAX_MAIL_ATTEMPTS,
    });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
