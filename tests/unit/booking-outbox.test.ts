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
      1,
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
      2,
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
        quotedTotalCents: 12_000,
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
        { entryId: charge.id, account: "accounts_receivable", amountCents: 12_000 },
        { entryId: charge.id, account: "rental_revenue", amountCents: -12_000 },
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
        { entryId: payment.id, account: "stripe_clearing", amountCents: 12_000 },
        { entryId: payment.id, account: "accounts_receivable", amountCents: -12_000 },
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
        paidAmountCents: 12_000,
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

  it("attaches all location staff and all admins' contact cards to customer mail", async () => {
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
          expect.objectContaining({ filename: "Max-Mustermann.vcf" }),
          expect.objectContaining({ filename: "Erika-Beispiel.vcf" }),
          expect.objectContaining({ filename: "Julius-Porzel.vcf" }),
        ]),
      }),
    );
  });
});
