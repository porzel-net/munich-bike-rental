import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import {
  authUser,
  accessoryInventory,
  bikeModels,
  bikeVariants,
  bookingAccessoryAllocations,
  bookingAssetAllocations,
  bookingEvents,
  bookingFeedback,
  bookingOfferItems,
  bookingOffers,
  bookingRequestedItems,
  bookings,
  financialAccounts,
  financialTransactionAllocations,
  financialTransactions,
  journalEntries,
  journalLines,
  mailOutbox,
  rentalAssets,
} from "../../lib/db/schema";
import {
  BookingCommandError,
  acknowledgeBookingAttention,
  advanceBooking,
  assignStripePaymentToBooking,
  assignBooking,
  cancelBooking,
  confirmManualBooking,
  confirmOffer,
  confirmOfferWithStripePayment,
  correctJournalEntry,
  createBooking,
  createDirectBooking,
  createHistoricalBooking,
  createOffer,
  deleteBookingPermanently,
  expireDueOffers,
  getBookingPaymentStatus,
  previewOffer,
  revokeOffer,
  recordPayment,
  recordRefund,
  setBookingEmailQuestionsResolved,
  updateBooking,
  setLegacyBookingStatus,
} from "../../lib/bookings/service";
import { berlinYear } from "../../lib/datetime";
import { renderBookingNotice, renderOfferMail } from "../../lib/bookings/messages";
import { appendJournalEntry } from "../../lib/bookings/ledger";
import { assignNevloTransactionToBooking } from "../../lib/financial/reconciliation";
import { getPublicFeedbackByToken, submitPublicFeedback } from "../../lib/bookings/feedback";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];
afterEach(() => {
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
      whatsappPhone: "+49 170 1234567",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  const model = db
    .insert(bikeModels)
    .values({ location: "munich", modelKey: "test", title: "Test Bike", createdAt: new Date() })
    .returning({ id: bikeModels.id })
    .get();
  const variant = db
    .insert(bikeVariants)
    .values({ modelId: model.id, size: "M", createdAt: new Date() })
    .returning({ id: bikeVariants.id })
    .get();
  const asset = db
    .insert(rentalAssets)
    .values({
      variantId: variant.id,
      location: "munich",
      assetCode: "TEST-1",
      displayName: "Test Bike - M",
      dailyPriceCents: 5_000,
      weekdayPriceCents: 5_000,
      weekendPriceCents: 5_000,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: rentalAssets.id })
    .get();
  db.insert(accessoryInventory)
    .values({
      location: "munich",
      accessoryKey: "helmet",
      category: "safety",
      labelDe: "Helm",
      labelEn: "Helmet",
      priceCents: 1_000,
      availableQuantity: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  db.insert(accessoryInventory)
    .values({
      location: "munich",
      accessoryKey: "pedal-platform",
      category: "pedal",
      labelDe: "Plattformpedale",
      labelEn: "Platform pedals",
      priceCents: 500,
      availableQuantity: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  db.insert(accessoryInventory)
    .values({
      location: "munich",
      accessoryKey: "mount-other",
      category: "computer-mount",
      labelDe: "Andere Halterung",
      labelEn: "Other mount",
      priceCents: 500,
      availableQuantity: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  return { db, assetId: asset.id, variantId: variant.id };
}

function inquiry(db: ReturnType<typeof setup>["db"], periodFrom: string, periodTo: string) {
  const created = createBooking(db, {
    customerName: "Ada Lovelace",
    customerEmail: "ada@example.com",
    customerPhone: "+49",
    location: "munich",
    periodFrom,
    periodTo,
    pickupTime: "10:00",
    dropoffTime: "10:00",
    customerMessage: "",
    communicationLocale: "en",
    source: "manual",
    quotedTotalCents: 0,
    requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170 }],
  });
  const item = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, created.id)).get()!;
  return { ...created, itemId: item.id };
}

function assignAdminBooking(db: ReturnType<typeof setup>["db"], bookingId: number) {
  assignBooking(db, { bookingId, assigneeUserId: "admin", actorUserId: "admin" });
}

describe("booking commands", () => {
  it("records and can reopen a manual clarification of email questions", () => {
    const { db } = setup();
    const booking = inquiry(db, "2026-08-20", "2026-08-21");

    expect(
      setBookingEmailQuestionsResolved(db, { bookingId: booking.id, resolved: true, actorUserId: "admin" }),
    ).toMatchObject({ resolved: true, occurredAt: expect.any(Date) });
    expect(
      setBookingEmailQuestionsResolved(db, { bookingId: booking.id, resolved: false, actorUserId: "admin" }),
    ).toMatchObject({ resolved: false, occurredAt: expect.any(Date) });
    expect(
      db
        .select({ eventType: bookingEvents.eventType, reason: bookingEvents.reason })
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, booking.id))
        .all()
        .slice(-2),
    ).toEqual([
      { eventType: "email_questions_resolved", reason: "Fragen telefonisch oder persönlich geklärt" },
      { eventType: "email_questions_reopened", reason: "Fragen wieder zur Prüfung geöffnet" },
    ]);
  });

  it("records a general acknowledgement for booking attention", () => {
    const { db } = setup();
    const booking = inquiry(db, "2026-08-20", "2026-08-21");

    expect(acknowledgeBookingAttention(db, { bookingId: booking.id, actorUserId: "admin" })).toMatchObject({
      acknowledged: true,
      occurredAt: expect.any(Date),
    });
    expect(
      db
        .select({ eventType: bookingEvents.eventType, reason: bookingEvents.reason })
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, booking.id))
        .all()
        .slice(-1),
    ).toEqual([{ eventType: "booking_attention_acknowledged", reason: "Kenntnis genommen" }]);
  });

  it("creates a completed historical booking without sending customer mail", () => {
    const { db, assetId } = setup();
    const created = createHistoricalBooking(db, {
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-03",
      pickupTime: "10:00",
      dropoffTime: "17:00",
      customerMessage: "Nachgetragen",
      communicationLocale: "de",
      quotedTotalCents: 12_500,
      requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170 }],
      assetsByPosition: { 1: assetId },
      actorUserId: "admin",
    });

    expect(db.select().from(bookings).where(eq(bookings.id, created.id)).get()).toMatchObject({
      source: "legacy",
      status: "completed",
      quotedTotalCents: 12_500,
      invoiceNumber: expect.stringMatching(/^YBR-\d{4}-\d{4}$/),
    });
    expect(
      db.select().from(bookingAssetAllocations).where(eq(bookingAssetAllocations.bookingId, created.id)).all(),
    ).toHaveLength(1);
    expect(db.select().from(mailOutbox).where(eq(mailOutbox.bookingId, created.id)).all()).toHaveLength(0);
    expect(db.select().from(journalEntries).where(eq(journalEntries.bookingId, created.id)).all()).toHaveLength(1);
  });

  it("allocates the next free invoice number for a historical booking", () => {
    const { db, assetId } = setup();
    const existing = inquiry(db, "2026-07-20", "2026-07-21");
    const year = berlinYear();
    db.update(bookings)
      .set({ invoiceNumber: `YBR-${year}-0001`, invoiceIssuedAt: new Date() })
      .where(eq(bookings.id, existing.id))
      .run();

    const created = createHistoricalBooking(db, {
      customerName: "Grace Hopper",
      customerEmail: "grace@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-03",
      pickupTime: "10:00",
      dropoffTime: "17:00",
      customerMessage: "Nachgetragen",
      communicationLocale: "de",
      quotedTotalCents: 12_500,
      requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170 }],
      assetsByPosition: { 1: assetId },
      actorUserId: "admin",
    });

    expect(
      db.select({ invoiceNumber: bookings.invoiceNumber }).from(bookings).where(eq(bookings.id, created.id)).get(),
    ).toEqual({
      invoiceNumber: `YBR-${year}-0002`,
    });
  });

  it("deletes an unbooked duplicate inquiry and its child records", () => {
    const { db } = setup();
    const booking = inquiry(db, "2026-08-20", "2026-08-21");
    db.insert(bookingEvents)
      .values({
        bookingId: booking.id,
        eventType: "test",
        payloadJson: "{}",
        occurredAt: new Date(),
      })
      .run();

    deleteBookingPermanently(db, booking.id);

    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()).toBeUndefined();
    expect(
      db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, booking.id)).all(),
    ).toHaveLength(0);
    expect(db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, booking.id)).all()).toHaveLength(0);
  });

  it("keeps bookings with journal history and completed rentals", () => {
    const { db } = setup();
    const booking = inquiry(db, "2026-08-22", "2026-08-23");
    db.insert(journalEntries)
      .values({
        bookingId: booking.id,
        kind: "correction",
        reason: "Test",
        occurredAt: new Date(),
        createdAt: new Date(),
      })
      .run();

    expect(() => deleteBookingPermanently(db, booking.id)).toThrow("Finanz- oder Journalverknüpfungen");
    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()).toBeDefined();
  });

  it("rejects impossible dates and makes full manual payments retry-safe", () => {
    const { db, assetId } = setup();
    expect(() => inquiry(db, "2026-02-30", "2026-03-01")).toThrow("Zeitraum und Uhrzeiten sind ungültig");

    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });
    confirmOffer(db, offer.confirmationToken, "admin");

    const firstEntry = recordPayment(db, {
      bookingId: booking.id,
      amountCents: 10_000,
      reason: "Gesamtzahlung",
      actorUserId: "admin",
      idempotencyKey: "manual-payment-test-1",
    });
    expect(
      recordPayment(db, {
        bookingId: booking.id,
        amountCents: 10_000,
        reason: "Gesamtzahlung wiederholt",
        actorUserId: "admin",
        idempotencyKey: "manual-payment-test-1",
      }),
    ).toBe(firstEntry);
    expect(() =>
      recordPayment(db, {
        bookingId: booking.id,
        amountCents: 10_001,
        reason: "Falscher Betrag",
        actorUserId: "admin",
      }),
    ).toThrow("vollständig bezahlt");

    expect(
      recordRefund(db, {
        bookingId: booking.id,
        amountCents: 1_000,
        reason: "Teilerstattung",
        actorUserId: "admin",
      }),
    ).toBeTypeOf("number");
    expect(db.select({ kind: journalEntries.kind }).from(journalEntries).all().at(-1)?.kind).toBe("refund_issued");
  });

  it("assigns a Nevlo bank transfer to an existing booking without requiring an offer", () => {
    const { db } = setup();
    const booking = inquiry(db, "2026-08-20", "2026-08-21");

    const bank = db
      .insert(financialAccounts)
      .values({
        code: "test_transfer_bank",
        name: "Testüberweisungskonto",
        type: "bank",
        provider: "nevlo",
        currency: "EUR",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: financialAccounts.id })
      .get();
    const transfer = db
      .insert(financialTransactions)
      .values({
        financialAccountId: bank.id,
        source: "bank",
        provider: "nevlo",
        kind: "income",
        status: "needs_review",
        amountCents: 70_000,
        currency: "EUR",
        bookedAt: "2026-08-18",
        reference: booking.orderNumber,
        description: `Überweisung ${booking.orderNumber}`,
        importedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: financialTransactions.id })
      .get();

    expect(
      assignNevloTransactionToBooking(db, { transactionId: transfer.id, bookingId: booking.id, actorUserId: "admin" }),
    ).toEqual({
      transactionId: transfer.id,
      bookingId: booking.id,
      orderNumber: booking.orderNumber,
    });
    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, booking.id)).get()).toEqual({
      status: "inquiry_received",
    });
    expect(getBookingPaymentStatus(db, booking.id)).toEqual({ openCents: -70_000, status: "prepayment" });
    expect(
      db
        .select({
          allocationKind: financialTransactionAllocations.allocationKind,
          bookingId: financialTransactionAllocations.bookingId,
          journalEntryId: financialTransactionAllocations.journalEntryId,
        })
        .from(financialTransactionAllocations)
        .where(eq(financialTransactionAllocations.transactionId, transfer.id))
        .get(),
    ).toMatchObject({ allocationKind: "booking_payment", bookingId: booking.id });
    const allocation = db
      .select({ journalEntryId: financialTransactionAllocations.journalEntryId })
      .from(financialTransactionAllocations)
      .where(eq(financialTransactionAllocations.transactionId, transfer.id))
      .get();
    expect(
      db
        .select({ account: journalLines.account, amountCents: journalLines.amountCents })
        .from(journalLines)
        .where(eq(journalLines.entryId, allocation?.journalEntryId ?? -1))
        .all(),
    ).toEqual([
      { account: "test_transfer_bank", amountCents: 70_000 },
      { account: "accounts_receivable", amountCents: -70_000 },
    ]);
    appendJournalEntry(db, {
      bookingId: booking.id,
      kind: "rental_charge",
      actorUserId: "admin",
      reason: "Preis später festgelegt",
      lines: [
        { account: "accounts_receivable", amountCents: 70_000 },
        { account: "rental_revenue", amountCents: -70_000 },
      ],
    });
    expect(getBookingPaymentStatus(db, booking.id)).toEqual({ openCents: 0, status: "settled" });
    expect(
      db
        .select({ status: financialTransactions.status })
        .from(financialTransactions)
        .where(eq(financialTransactions.id, transfer.id))
        .get(),
    ).toEqual({
      status: "posted",
    });
  });

  it("allows manual bookings to reconcile several transfers from different accounts", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-08-20", "2026-08-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });
    confirmOffer(db, offer.confirmationToken, "admin");
    const privateAccount = db
      .insert(financialAccounts)
      .values({
        code: "private_transfer_account",
        name: "Privates Überweisungskonto",
        type: "bank",
        provider: "manual",
        currency: "EUR",
        notes: "Manuelle historische Zahlung",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: financialAccounts.id })
      .get();

    recordPayment(db, {
      bookingId: booking.id,
      amountCents: 4_000,
      financialAccountId: privateAccount.id,
      reason: "Erste Überweisung",
      actorUserId: "admin",
    });
    recordPayment(db, {
      bookingId: booking.id,
      amountCents: 6_000,
      financialAccountId: privateAccount.id,
      reason: "Zweite Überweisung",
      actorUserId: "admin",
    });
    expect(getBookingPaymentStatus(db, booking.id)).toEqual({ openCents: 0, status: "settled" });
    expect(db.select().from(journalEntries).where(eq(journalEntries.bookingId, booking.id)).all()).toHaveLength(3);
  });

  it("confirms an expired offer when a paid Stripe session is assigned manually", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-08-20", "2026-08-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });
    db.update(bookingOffers)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(bookingOffers.id, offer.offerId))
      .run();
    expect(expireDueOffers(db)).toBe(1);

    expect(
      assignStripePaymentToBooking(db, {
        bookingId: booking.id,
        offerId: offer.offerId,
        amountCents: offer.quote.totalCents,
        sessionId: "cs_test_manual_assignment_123",
        actorUserId: "admin",
      }),
    ).toEqual({ bookingId: booking.id, alreadyConfirmed: false });
    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, booking.id)).get()).toEqual({
      status: "confirmed",
    });
    expect(
      db.select({ status: bookingOffers.status }).from(bookingOffers).where(eq(bookingOffers.id, offer.offerId)).get(),
    ).toEqual({
      status: "accepted",
    });
    expect(getBookingPaymentStatus(db, booking.id)).toEqual({ openCents: 0, status: "settled" });
  });

  it("maps the legacy flat pedal value when confirming an expired paid offer", () => {
    const { db, assetId } = setup();
    const created = createBooking(db, {
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-08-20",
      periodTo: "2026-08-21",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      customerMessage: "",
      communicationLocale: "en",
      source: "manual",
      quotedTotalCents: 0,
      requestedItems: [
        {
          requestedLabel: "Test Bike - M",
          heightCm: 170,
          needsPedals: true,
          pedalType: "flat",
          needsComputerMount: true,
          computerMountType: "unknown",
        },
      ],
    });
    const item = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, created.id)).get()!;
    assignAdminBooking(db, created.id);
    const offer = createOffer(db, { bookingId: created.id, assetsByRequestedItem: { [item.id]: assetId } });
    const legacySnapshot = JSON.parse(
      db
        .select({ priceSnapshotJson: bookingOffers.priceSnapshotJson })
        .from(bookingOffers)
        .where(eq(bookingOffers.id, offer.offerId))
        .get()!.priceSnapshotJson,
    ) as {
      offeredItems: Array<{ accessories: { pedalType: string | null; computerMountType: string | null } }>;
    };
    legacySnapshot.offeredItems[0].accessories.pedalType = "flat";
    legacySnapshot.offeredItems[0].accessories.computerMountType = "unknown";
    db.update(bookingOffers)
      .set({ expiresAt: new Date(Date.now() - 1_000), priceSnapshotJson: JSON.stringify(legacySnapshot) })
      .where(eq(bookingOffers.id, offer.offerId))
      .run();
    expect(expireDueOffers(db)).toBe(1);

    expect(
      assignStripePaymentToBooking(db, {
        bookingId: created.id,
        offerId: offer.offerId,
        amountCents: offer.quote.totalCents,
        sessionId: "cs_test_legacy_flat_pedal_123",
        actorUserId: "admin",
      }),
    ).toEqual({ bookingId: created.id, alreadyConfirmed: false });
    const allocations = db
      .select({ accessoryId: bookingAccessoryAllocations.accessoryId })
      .from(bookingAccessoryAllocations)
      .where(eq(bookingAccessoryAllocations.bookingId, created.id))
      .all();
    expect(
      allocations
        .map(
          ({ accessoryId }) =>
            db
              .select({ accessoryKey: accessoryInventory.accessoryKey })
              .from(accessoryInventory)
              .where(eq(accessoryInventory.id, accessoryId))
              .get()!.accessoryKey,
        )
        .sort(),
    ).toEqual(["mount-other", "pedal-platform"]);
  });

  it("binds journal corrections to the booking they came from", () => {
    const { db } = setup();
    const first = inquiry(db, "2026-07-20", "2026-07-21");
    const second = inquiry(db, "2026-07-22", "2026-07-23");
    assignAdminBooking(db, first.id);
    assignAdminBooking(db, second.id);
    const entry = appendJournalEntry(db, {
      bookingId: second.id,
      kind: "expense",
      actorUserId: "admin",
      reason: "Testbuchung",
      lines: [
        { account: "expense", amountCents: 100 },
        { account: "bank_or_cash", amountCents: -100 },
      ],
    });
    expect(() => correctJournalEntry(db, { bookingId: first.id, entryId: entry, reason: "Falscher Vorgang" })).toThrow(
      "Der ausgewählte Journalposten wurde nicht gefunden",
    );
  });

  it("renders the German offer with Stripe payment instructions and the sender's first name", () => {
    const mail = renderOfferMail({
      locale: "de",
      alternative: false,
      name: "Ada Lovelace",
      orderNumber: "#20260725100000",
      requested: [
        {
          requestedLabel: "Endurace CF SL 8 - M",
          assetName: "Endurace CF SL 8 - M",
          accessories: {
            needsPedals: true,
            pedalType: "lookKeo2Max",
            needsComputerMount: true,
            computerMountType: "garmin",
            needsHelmet: false,
            needsClothing: true,
          },
        },
      ],
      totalCents: 12_300,
      periodFrom: "2026-07-25",
      periodTo: "2026-07-26",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      location: "munich",
      token: "test-token",
      senderFirstName: "Julius",
    });

    expect(mail.text).toContain("Endurace CF SL 8 - M\nZubehör:");
    expect(mail.text).not.toContain("Endurace CF SL 8 - M →");
    expect(mail.text).toContain("Dieses Angebot bleibt 36 Stunden für dich reserviert.");
    expect(mail.text).toContain("Deine Checkliste für die Abholung:");
    expect(mail.text).toContain("Gabelsbergerstraße 79a, 80333 München, Maxvorstadt");
    expect(mail.text).not.toContain("WICHTIG:");
    expect(mail.text).not.toContain("**");
    expect(mail.text).toContain("bezahle den Gesamtpreis über Stripe");
    expect(mail.text).not.toContain("Verwendungszweck:");
    expect(mail.text).toContain("Liebe Grüße,\nJulius");
    expect(mail.text).toContain("- Pedale: Look Keo2 Max");
    expect(mail.text).toContain("- Computerhalterung: Garmin");
    expect(mail.text).toContain("- Helm: Nicht enthalten");
    expect(mail.text).toContain("- Kleidung: Enthalten");
    expect(mail.text).not.toContain("lookKeo2Max");
    expect(mail.html).toContain("Angebot öffnen");
    expect(mail.html).toContain("Dieses Angebot bleibt 36 Stunden für dich reserviert.");
    expect(mail.html).toContain("Gabelsbergerstraße 79a, 80333 München, Maxvorstadt");
    expect(mail.html).toContain('href="https://www.munich-bike-rental.de/angebot/test-token"');
  });

  it("queues a localized offer and atomically reserves the chosen asset only on confirmation", () => {
    const { db, assetId } = setup();
    db.update(rentalAssets).set({ nickname: "Interner Spitzname" }).where(eq(rentalAssets.id, assetId)).run();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });
    const outbox = db.select().from(mailOutbox).get()!;
    expect(outbox.locale).toBe("en");
    expect(outbox.plainText).toContain("remains reserved for you for 36 hours");
    expect(outbox.plainText).not.toContain("Interner Spitzname");
    expect(outbox.html).toContain("Your Bike Rental");
    expect(outbox.html).toContain("Open offer");
    expect(confirmOffer(db, offer.confirmationToken)).toEqual({ bookingId: booking.id, alreadyConfirmed: false });
    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, booking.id)).get()).toEqual({
      status: "confirmed",
    });
    expect(getBookingPaymentStatus(db, booking.id)).toEqual({ openCents: 10_000, status: "open" });
  });

  it("uses the customer's English locale for every admin-triggered booking mail", () => {
    const { db, assetId } = setup();
    const mailFor = (bookingId: number, kind: string) =>
      db
        .select()
        .from(mailOutbox)
        .where(eq(mailOutbox.bookingId, bookingId))
        .all()
        .find((mail) => mail.kind === kind);

    const cancelled = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, cancelled.id);
    const cancelledOffer = createOffer(db, {
      bookingId: cancelled.id,
      assetsByRequestedItem: { [cancelled.itemId]: assetId },
    });
    confirmOffer(db, cancelledOffer.confirmationToken, "admin");
    cancelBooking(db, {
      bookingId: cancelled.id,
      cancellationFeeCents: 0,
      reason: "Customer cancelled",
      actorUserId: "admin",
    });

    const rejected = inquiry(db, "2026-07-22", "2026-07-23");
    assignAdminBooking(db, rejected.id);
    advanceBooking(db, rejected.id, "rejected", "admin", "No availability");

    const checkedOut = inquiry(db, "2026-07-24", "2026-07-25");
    assignAdminBooking(db, checkedOut.id);
    const checkedOutOffer = createOffer(db, {
      bookingId: checkedOut.id,
      assetsByRequestedItem: { [checkedOut.itemId]: assetId },
    });
    confirmOffer(db, checkedOutOffer.confirmationToken, "admin");
    advanceBooking(db, checkedOut.id, "checked_out", "admin");

    const changed = inquiry(db, "2026-07-26", "2026-07-27");
    assignAdminBooking(db, changed.id);
    const changedOffer = createOffer(db, {
      bookingId: changed.id,
      assetsByRequestedItem: { [changed.itemId]: assetId },
    });
    confirmOffer(db, changedOffer.confirmationToken, "admin");
    const changedBooking = db.select().from(bookings).where(eq(bookings.id, changed.id)).get()!;
    const changedItem = db
      .select()
      .from(bookingRequestedItems)
      .where(eq(bookingRequestedItems.id, changed.itemId))
      .get()!;
    updateBooking(db, {
      bookingId: changed.id,
      expectedVersion: changedBooking.version,
      actorUserId: "admin",
      customerName: changedBooking.customerName,
      customerEmail: changedBooking.customerEmail,
      customerPhone: changedBooking.customerPhone,
      periodFrom: changedBooking.periodFrom,
      periodTo: "2026-07-28",
      pickupTime: changedBooking.pickupTime,
      dropoffTime: changedBooking.dropoffTime,
      customerMessage: changedBooking.customerMessage,
      communicationLocale: "en",
      requestedItems: [changedItem],
      notifyCustomer: true,
    });

    for (const [bookingId, kind, subjectMarker, textMarker] of [
      [cancelled.id, "offer", "Offer", "offer"],
      [cancelled.id, "booking_confirmed", "Booking confirmed", "confirmed"],
      [cancelled.id, "booking_cancelled", "Cancellation", "cancelled"],
      [rejected.id, "booking_rejected", "Inquiry", "Unfortunately"],
      [checkedOut.id, "feedback_request", "How was your ride", "rate"],
      [changed.id, "booking_information_changed", "Updated booking information", "updated"],
    ] as const) {
      const mail = mailFor(bookingId, kind);
      expect(mail?.locale).toBe("en");
      expect(mail?.subject).toContain(subjectMarker);
      expect(mail?.plainText).toContain(textMarker);
      expect(mail?.plainText).not.toContain("Buchung");
      expect(mail?.plainText).not.toContain("Angebot");
      expect(mail?.html).toContain("Kind regards");
    }
  });

  it("confirms an offer and settles the full total after a Stripe payment", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });

    expect(
      confirmOfferWithStripePayment(db, {
        offerId: offer.offerId,
        amountCents: offer.quote.totalCents,
        sessionId: "cs_test_booking",
      }),
    ).toEqual({ bookingId: booking.id, alreadyConfirmed: false });
    expect(
      db.select({ invoiceNumber: bookings.invoiceNumber }).from(bookings).where(eq(bookings.id, booking.id)).get(),
    ).toMatchObject({ invoiceNumber: expect.stringMatching(/^YBR-\d{4}-\d{4}$/) });
    expect(getBookingPaymentStatus(db, booking.id)).toEqual({ openCents: 0, status: "settled" });
    const bookingMails = db.select().from(mailOutbox).where(eq(mailOutbox.bookingId, booking.id)).all();
    expect(
      bookingMails.some((mail) =>
        mail.plainText.includes(`https://www.munich-bike-rental.de/angebot/${offer.confirmationToken}`),
      ),
    ).toBe(true);
    const confirmationMail = bookingMails.find((mail) => mail.kind === "booking_confirmed");
    expect(confirmationMail?.plainText).toContain("+49 170 1234567");
    expect(confirmationMail?.html).toContain("+49 170 1234567");
    expect(confirmationMail?.plainText).not.toContain("Interner Spitzname");
    expect(confirmationMail?.html).not.toContain("Interner Spitzname");
    expect(
      db
        .select({ kind: journalEntries.kind })
        .from(journalEntries)
        .where(eq(journalEntries.bookingId, booking.id))
        .all()
        .map((entry) => entry.kind),
    ).toEqual(["rental_charge", "payment_received"]);

    advanceBooking(db, booking.id, "checked_out", "admin");
    advanceBooking(db, booking.id, "completed", "admin");
    expect(
      db.select({ invoiceNumber: bookings.invoiceNumber }).from(bookings).where(eq(bookings.id, booking.id)).get(),
    ).toMatchObject({ invoiceNumber: expect.stringMatching(/^YBR-\d{4}-\d{4}$/) });
    expect(getBookingPaymentStatus(db, booking.id)).toEqual({ openCents: 0, status: "settled" });
    expect(db.select().from(journalEntries).where(eq(journalEntries.bookingId, booking.id)).all()).toHaveLength(2);
  });

  it("accepts only the original Stripe session when confirmation is retried", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });

    expect(
      confirmOfferWithStripePayment(db, {
        offerId: offer.offerId,
        amountCents: offer.quote.totalCents,
        sessionId: "cs_test_original_session",
        paymentIntentId: "pi_test_original_intent",
      }),
    ).toEqual({ bookingId: booking.id, alreadyConfirmed: false });
    expect(
      db
        .select({
          stripeSessionId: bookingOffers.stripeSessionId,
          stripePaymentIntentId: bookingOffers.stripePaymentIntentId,
        })
        .from(bookingOffers)
        .where(eq(bookingOffers.id, offer.offerId))
        .get(),
    ).toEqual({ stripeSessionId: "cs_test_original_session", stripePaymentIntentId: "pi_test_original_intent" });

    expect(
      confirmOfferWithStripePayment(db, {
        offerId: offer.offerId,
        amountCents: offer.quote.totalCents,
        sessionId: "cs_test_original_session",
        paymentIntentId: "pi_test_original_intent",
      }),
    ).toEqual({ bookingId: booking.id, alreadyConfirmed: true });
    expect(() =>
      confirmOfferWithStripePayment(db, {
        offerId: offer.offerId,
        amountCents: offer.quote.totalCents,
        sessionId: "cs_test_second_session",
        paymentIntentId: "pi_test_second_intent",
      }),
    ).toThrow("zweite Stripe-Zahlung");
    expect(() =>
      confirmOfferWithStripePayment(db, {
        offerId: offer.offerId,
        amountCents: offer.quote.totalCents - 1,
        sessionId: "cs_test_original_session",
        paymentIntentId: "pi_test_original_intent",
      }),
    ).toThrow("Betrag");
    expect(db.select().from(journalEntries).where(eq(journalEntries.bookingId, booking.id)).all()).toHaveLength(2);
  });

  it("starts invoice numbering at 0001", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });

    confirmOffer(db, offer.confirmationToken, "admin");

    expect(
      db.select({ invoiceNumber: bookings.invoiceNumber }).from(bookings).where(eq(bookings.id, booking.id)).get(),
    ).toMatchObject({ invoiceNumber: expect.stringMatching(/^YBR-\d{4}-0001$/) });
  });

  it("creates a one-time feedback link and queues the request after handover", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });
    confirmOffer(db, offer.confirmationToken, "admin");

    const mailId = advanceBooking(db, booking.id, "checked_out", "admin");
    expect(mailId).toBeTypeOf("number");
    const mail = db.select().from(mailOutbox).where(eq(mailOutbox.kind, "feedback_request")).get();
    expect(mail?.html).toContain("How was your ride?");
    const token = new URL(mail!.plainText.split("\n").find((line) => line.includes("/feedback/"))!).pathname
      .split("/")
      .at(-1)!;
    expect(getPublicFeedbackByToken(db, token)).toMatchObject({
      orderNumber: booking.orderNumber,
      submittedAt: null,
      ratings: { bikeRating: null, overallRating: null },
    });

    submitPublicFeedback(db, token, {
      bikeRating: 5,
      handoverRating: 4,
      communicationRating: 5,
      priceRating: 4,
      overallRating: 5,
      comment: "Alles hat super geklappt.",
    });
    expect(getPublicFeedbackByToken(db, token)).toMatchObject({
      submittedAt: expect.any(String),
      comment: "Alles hat super geklappt.",
      ratings: { bikeRating: 5, handoverRating: 4, communicationRating: 5, priceRating: 4, overallRating: 5 },
    });
    expect(() =>
      submitPublicFeedback(db, token, {
        bikeRating: 1,
        handoverRating: 1,
        communicationRating: 1,
        priceRating: 1,
        overallRating: 1,
        comment: "Noch einmal",
      }),
    ).toThrow("bereits abgegeben");
    expect(db.select().from(bookingFeedback).where(eq(bookingFeedback.bookingId, booking.id)).all()).toHaveLength(1);
  });

  it("queues a personalized rejection mail and stores the selected rejection reason", () => {
    const { db } = setup();
    const booking = createBooking(db, {
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-07-20",
      periodTo: "2026-07-21",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      customerMessage: "",
      communicationLocale: "de",
      source: "manual",
      quotedTotalCents: 0,
      requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170 }],
    });
    assignAdminBooking(db, booking.id);

    advanceBooking(db, booking.id, "rejected", "admin", "Fahrrad Verfügbarkeit");

    const mail = db.select().from(mailOutbox).where(eq(mailOutbox.kind, "booking_rejected")).get();
    expect(mail?.plainText).toBe(
      "Hey Ada,\n\nvielen Dank für deine Anfrage.\n\nLeider können wir dir für den Zeitraum kein passendes Fahrrad anbieten. Probiers gerne nochmal wann anders!\n\nWir hoffen, dass du fündig wirst und wünschen dir eine gute Fahrt.\n\nLiebe Grüße\nAdmin",
    );
    expect(mail?.html).toContain("Your Bike Rental");
    expect(mail?.html).toContain("Danke für deine Anfrage");
    expect(db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, booking.id)).all().at(-1)?.reason).toBe(
      "Fahrrad Verfügbarkeit",
    );
  });

  it("uses the personal rejection message as the complete custom body", () => {
    const mail = renderBookingNotice({
      kind: "rejected",
      locale: "de",
      name: "Andreas Beispiel",
      orderNumber: "MBR-2026-0001",
      senderFirstName: "Julius",
      personalMessage: "Schade, dass es diesmal nicht klappt. Melde dich gerne für einen anderen Zeitraum.",
    });

    expect(mail.text).toBe(
      "Hey Andreas,\n\nSchade, dass es diesmal nicht klappt. Melde dich gerne für einen anderen Zeitraum.\n\nLiebe Grüße\nJulius",
    );
    expect(mail.html).toContain("Danke für deine Anfrage");
    expect(mail.html).toContain("Schade, dass es diesmal nicht klappt.");
    expect(mail.html).not.toContain("Leider können wir dir für den Zeitraum kein passendes Fahrrad anbieten.");
    expect(mail.html).not.toContain("Wir hoffen, dass du fündig wirst");
  });

  it("keeps edited equipment out of the quote and confirmation allocation", () => {
    const { db, assetId } = setup();
    const created = createBooking(db, {
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-07-20",
      periodTo: "2026-07-21",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      customerMessage: "",
      communicationLocale: "de",
      source: "manual",
      quotedTotalCents: 0,
      requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170, needsHelmet: true }],
    });
    assignAdminBooking(db, created.id);
    const item = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, created.id)).get()!;
    const offer = createOffer(db, {
      bookingId: created.id,
      assetsByRequestedItem: { [item.id]: assetId },
      accessoriesByRequestedItem: {
        [item.id]: {
          needsPedals: false,
          pedalType: null,
          needsComputerMount: false,
          computerMountType: null,
          needsHelmet: false,
          needsClothing: false,
        },
      },
    });

    expect(offer.quote.equipmentSubtotalCents).toBe(0);
    expect(db.select().from(mailOutbox).where(eq(mailOutbox.kind, "offer")).get()?.plainText).toContain(
      "Helm: Nicht enthalten",
    );
    confirmOffer(db, offer.confirmationToken);
    expect(
      db.select().from(bookingAccessoryAllocations).where(eq(bookingAccessoryAllocations.bookingId, created.id)).all(),
    ).toHaveLength(0);
  });

  it("rejects overlap but permits return and pickup at the same time", () => {
    const { db, assetId } = setup();
    const first = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, first.id);
    const offer = createOffer(db, { bookingId: first.id, assetsByRequestedItem: { [first.itemId]: assetId } });
    confirmOffer(db, offer.confirmationToken);
    const adjacent = inquiry(db, "2026-07-21", "2026-07-22");
    assignAdminBooking(db, adjacent.id);
    expect(adjacent.orderNumber).not.toBe(first.orderNumber);
    expect(adjacent.orderNumber).toMatch(/^#\d{14}$/);
    expect(() =>
      createOffer(db, { bookingId: adjacent.id, assetsByRequestedItem: { [adjacent.itemId]: assetId } }),
    ).not.toThrow();
    const overlap = inquiry(db, "2026-07-20", "2026-07-21");
    expect(() =>
      createOffer(db, { bookingId: overlap.id, assetsByRequestedItem: { [overlap.itemId]: assetId } }),
    ).toThrow(BookingCommandError);
  });

  it("blocks commercial actions until a booking has a Sachbearbeiter", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");

    expect(() =>
      createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } }),
    ).toThrow(BookingCommandError);
  });

  it("lets a local user self-assign but not assign other users", () => {
    const { db } = setup();
    db.insert(authUser)
      .values({
        id: "local",
        name: "Local",
        email: "local@example.com",
        role: "standortuser",
        locationKey: "munich",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");

    expect(() =>
      assignBooking(db, { bookingId: booking.id, assigneeUserId: "local", actorUserId: "local" }),
    ).not.toThrow();
    expect(
      db.select({ assignedUserId: bookings.assignedUserId }).from(bookings).where(eq(bookings.id, booking.id)).get(),
    ).toEqual({ assignedUserId: "local" });
    expect(() => assignBooking(db, { bookingId: booking.id, assigneeUserId: "admin", actorUserId: "local" })).toThrow(
      BookingCommandError,
    );
  });

  it("creates a direct booking, allocation, accepted snapshot and receivable in one command", () => {
    const { db, assetId } = setup();
    const created = createDirectBooking(db, {
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-07-20",
      periodTo: "2026-07-21",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      customerMessage: "",
      communicationLocale: "de",
      source: "manual",
      quotedTotalCents: 0,
      requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170 }],
      assetsByPosition: { 1: assetId },
      actorUserId: "admin",
    });
    expect(created.orderNumber).toMatch(/^#\d{14}$/);
    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, created.id)).get()?.status).toBe(
      "confirmed",
    );
    expect(
      db.select().from(bookingAssetAllocations).where(eq(bookingAssetAllocations.bookingId, created.id)).all(),
    ).toHaveLength(1);
    const offer = db.select().from(bookingOffers).where(eq(bookingOffers.bookingId, created.id)).get()!;
    expect(offer.status).toBe("accepted");
    expect(offer.totalCents).toBe(10_000);
    expect(JSON.parse(offer.priceSnapshotJson)).toMatchObject({ totalCents: 10_000 });
    expect(
      db.select({ assignedUserId: bookings.assignedUserId }).from(bookings).where(eq(bookings.id, created.id)).get(),
    ).toEqual({ assignedUserId: "admin" });
    expect(db.select().from(journalEntries).where(eq(journalEntries.bookingId, created.id)).all()).toHaveLength(1);
    expect(getBookingPaymentStatus(db, created.id)).toEqual({ openCents: 10_000, status: "open" });
    expect(db.select().from(mailOutbox).where(eq(mailOutbox.bookingId, created.id)).get()?.kind).toBe(
      "booking_confirmed",
    );
    expect(db.select().from(mailOutbox).where(eq(mailOutbox.bookingId, created.id)).get()?.plainText).toContain(
      "+49 170 1234567",
    );
  });

  it("previews an alternative without creating an offer version", () => {
    const { db, assetId } = setup();
    db.update(authUser)
      .set({ privateAddress: "Private Straße 7, 80333 München" })
      .where(eq(authUser.id, "admin"))
      .run();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const preview = previewOffer(db, {
      bookingId: booking.id,
      assetsByRequestedItem: { [booking.itemId]: assetId },
      alternative: true,
      alternativeReason: "Die andere Größe passt besser.",
    });
    expect(preview.quote.totalCents).toBe(10_000);
    expect(preview.mail.subject).toContain("Alternative offer");
    expect(preview.mail.html).toContain("Your alternative offer");
    expect(preview.mail.text).toContain("Private Straße 7, 80333 München");
    const germanMail = renderOfferMail({
      locale: "de",
      alternative: true,
      alternativeReason: "Die andere Größe passt besser.",
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+49",
      orderNumber: "#2026",
      requested: [{ requestedLabel: "Wunschrad", assetName: "Alternativrad", heightCm: 170 }],
      totalCents: 10_000,
      periodFrom: "2026-07-20",
      periodTo: "2026-07-21",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      location: "munich",
      token: "VORSCHAU",
      senderFirstName: "Julius",
    });
    expect(germanMail.html).toContain("Dein Alternativ Angebot");
    expect(db.select().from(bookingOffers).where(eq(bookingOffers.bookingId, booking.id)).all()).toHaveLength(0);
  });

  it("uses alternative offer dates for the booking, quote and customer mail", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);

    const offer = createOffer(db, {
      bookingId: booking.id,
      assetsByRequestedItem: { [booking.itemId]: assetId },
      periodFrom: "2026-07-22",
      periodTo: "2026-07-24",
      pickupTime: "11:30",
      dropoffTime: "16:30",
    });

    expect(offer.quote).toMatchObject({ rentalDays: 3, bikeSubtotalCents: 15_000, totalCents: 15_000 });
    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()).toMatchObject({
      periodFrom: "2026-07-22",
      periodTo: "2026-07-24",
      pickupTime: "11:30",
      dropoffTime: "16:30",
      quotedTotalCents: 15_000,
    });
    expect(db.select().from(mailOutbox).where(eq(mailOutbox.offerId, offer.offerId)).get()?.plainText).toContain(
      "Rental period: 2026-07-22 11:30 – 2026-07-24 16:30",
    );
  });

  it("updates requested accessories and revokes an outdated open offer", () => {
    const { db, assetId } = setup();
    const created = createBooking(db, {
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-07-20",
      periodTo: "2026-07-21",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      customerMessage: "",
      communicationLocale: "de",
      source: "manual",
      quotedTotalCents: 0,
      requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170, needsHelmet: true }],
    });
    assignAdminBooking(db, created.id);
    const item = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, created.id)).get()!;
    createOffer(db, { bookingId: created.id, assetsByRequestedItem: { [item.id]: assetId } });
    const booking = db.select().from(bookings).where(eq(bookings.id, created.id)).get()!;

    updateBooking(db, {
      bookingId: created.id,
      expectedVersion: booking.version,
      actorUserId: "admin",
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      periodFrom: booking.periodFrom,
      periodTo: booking.periodTo,
      pickupTime: booking.pickupTime,
      dropoffTime: booking.dropoffTime,
      customerMessage: booking.customerMessage,
      communicationLocale: booking.communicationLocale,
      requestedItems: [{ ...item, needsHelmet: false }],
    });

    expect(
      db
        .select({ needsHelmet: bookingRequestedItems.needsHelmet })
        .from(bookingRequestedItems)
        .where(eq(bookingRequestedItems.id, item.id))
        .get(),
    ).toEqual({ needsHelmet: false });
    expect(
      db
        .select({ status: bookingOffers.status })
        .from(bookingOffers)
        .where(eq(bookingOffers.bookingId, created.id))
        .get(),
    ).toEqual({ status: "revoked" });
  });

  it("rejects a stale booking update before changing any commercial data", () => {
    const { db } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    const item = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.id, booking.itemId)).get()!;
    const current = db.select().from(bookings).where(eq(bookings.id, booking.id)).get()!;

    assignAdminBooking(db, booking.id);
    const afterAssignment = db.select().from(bookings).where(eq(bookings.id, booking.id)).get()!;

    expect(() =>
      updateBooking(db, {
        bookingId: booking.id,
        expectedVersion: current.version,
        actorUserId: "admin",
        customerName: "Changed name",
        customerEmail: afterAssignment.customerEmail,
        customerPhone: afterAssignment.customerPhone,
        periodFrom: afterAssignment.periodFrom,
        periodTo: afterAssignment.periodTo,
        pickupTime: afterAssignment.pickupTime,
        dropoffTime: afterAssignment.dropoffTime,
        customerMessage: afterAssignment.customerMessage,
        communicationLocale: afterAssignment.communicationLocale,
        requestedItems: [item],
      }),
    ).toThrow("zwischenzeitlich geändert");

    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()).toMatchObject({
      customerName: "Ada Lovelace",
      version: afterAssignment.version,
    });
  });

  it("withdraws an issued offer without queueing another customer mail", () => {
    const { db, assetId } = setup();
    const created = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, created.id);
    const offer = createOffer(db, {
      bookingId: created.id,
      assetsByRequestedItem: { [created.itemId]: assetId },
      actorUserId: "admin",
    });
    const outboxCount = db.select().from(mailOutbox).all().length;

    expect(
      revokeOffer(db, { bookingId: created.id, actorUserId: "admin", reason: "Rad kurzfristig nicht verfügbar" }),
    ).toEqual({
      offerIds: [offer.offerId],
    });
    expect(
      db.select({ status: bookingOffers.status }).from(bookingOffers).where(eq(bookingOffers.id, offer.offerId)).get(),
    ).toEqual({
      status: "revoked",
    });
    expect(db.select().from(mailOutbox).all()).toHaveLength(outboxCount);
    expect(
      db
        .select({ eventType: bookingEvents.eventType, reason: bookingEvents.reason })
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, created.id))
        .all()
        .at(-1),
    ).toMatchObject({ eventType: "offer_revoked", reason: "Rad kurzfristig nicht verfügbar" });
  });

  it("requires booking details and allocates a bike when an import becomes confirmed", () => {
    const { db, assetId } = setup();
    const created = createBooking(db, {
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-07-20",
      periodTo: "2026-07-21",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      customerMessage: "",
      communicationLocale: "de",
      source: "legacy",
      quotedTotalCents: 0,
      requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170 }],
    });
    const item = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, created.id)).get()!;

    expect(() => setLegacyBookingStatus(db, { bookingId: created.id, status: "confirmed" })).toThrow(
      "Zeitraum, Uhrzeiten und Preis",
    );

    setLegacyBookingStatus(db, {
      bookingId: created.id,
      status: "confirmed",
      details: {
        periodFrom: "2026-08-01",
        periodTo: "2026-08-03",
        pickupTime: "09:00",
        dropoffTime: "17:00",
        quotedTotalCents: 12_500,
        assetsByRequestedItem: { [item.id]: assetId },
        invoiceNumber: "YBR-2026-0001",
      },
    });

    expect(db.select().from(bookings).where(eq(bookings.id, created.id)).get()).toMatchObject({
      status: "confirmed",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-03",
      quotedTotalCents: 12_500,
      invoiceNumber: "YBR-2026-0001",
    });
    expect(
      db.select().from(bookingAssetAllocations).where(eq(bookingAssetAllocations.bookingId, created.id)).all(),
    ).toHaveLength(1);
    expect(getBookingPaymentStatus(db, created.id)).toEqual({ openCents: 12_500, status: "open" });
    expect(
      db
        .select({ kind: journalEntries.kind })
        .from(journalEntries)
        .where(eq(journalEntries.bookingId, created.id))
        .all(),
    ).toEqual([{ kind: "rental_charge" }]);

    const next = createBooking(db, {
      customerName: "Grace Hopper",
      customerEmail: "grace@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-09-01",
      periodTo: "2026-09-02",
      pickupTime: "09:00",
      dropoffTime: "17:00",
      customerMessage: "",
      communicationLocale: "de",
      source: "legacy",
      quotedTotalCents: 0,
      requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170 }],
    });
    const nextItem = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, next.id)).get()!;
    expect(() =>
      setLegacyBookingStatus(db, {
        bookingId: next.id,
        status: "confirmed",
        details: {
          periodFrom: "2026-09-01",
          periodTo: "2026-09-02",
          pickupTime: "09:00",
          dropoffTime: "17:00",
          quotedTotalCents: 12_500,
          assetsByRequestedItem: { [nextItem.id]: assetId },
          invoiceNumber: "2026-0002",
        },
      }),
    ).toThrow("Format YBR-JJJJ-NNNN");
    expect(() =>
      setLegacyBookingStatus(db, {
        bookingId: next.id,
        status: "confirmed",
        details: {
          periodFrom: "2026-09-01",
          periodTo: "2026-09-02",
          pickupTime: "09:00",
          dropoffTime: "17:00",
          quotedTotalCents: 12_500,
          assetsByRequestedItem: { [nextItem.id]: assetId },
          invoiceNumber: "YBR-2026-0003",
        },
      }),
    ).toThrow("YBR-2026-0002");
  });

  it("confirms a regular booking manually, allocates an invoice, and leaves the amount open for reconciliation", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-08-20", "2026-08-21");
    assignAdminBooking(db, booking.id);
    db.update(bookingRequestedItems)
      .set({ needsHelmet: true })
      .where(eq(bookingRequestedItems.id, booking.itemId))
      .run();
    const sentOffer = createOffer(db, {
      bookingId: booking.id,
      assetsByRequestedItem: { [booking.itemId]: assetId },
      actorUserId: "admin",
    });

    confirmManualBooking(db, {
      bookingId: booking.id,
      actorUserId: "admin",
      details: {
        periodFrom: "2026-08-22",
        periodTo: "2026-08-24",
        pickupTime: "09:30",
        dropoffTime: "17:00",
        quotedTotalCents: 12_300,
        assetsByRequestedItem: { [booking.itemId]: assetId },
      },
    });

    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()).toMatchObject({
      status: "confirmed",
      periodFrom: "2026-08-22",
      periodTo: "2026-08-24",
      pickupTime: "09:30",
      dropoffTime: "17:00",
      quotedTotalCents: 12_300,
      invoiceNumber: expect.stringMatching(/^YBR-\d{4}-0001$/),
    });
    expect(
      db
        .select({ status: bookingOffers.status })
        .from(bookingOffers)
        .where(eq(bookingOffers.id, sentOffer.offerId))
        .get(),
    ).toEqual({ status: "revoked" });
    expect(
      db
        .select({ status: bookingOffers.status })
        .from(bookingOffers)
        .where(eq(bookingOffers.bookingId, booking.id))
        .all()
        .map((row) => row.status)
        .sort(),
    ).toEqual(["accepted", "revoked"]);
    expect(
      db.select().from(bookingAssetAllocations).where(eq(bookingAssetAllocations.bookingId, booking.id)).all(),
    ).toHaveLength(1);
    expect(
      db.select().from(bookingAccessoryAllocations).where(eq(bookingAccessoryAllocations.bookingId, booking.id)).all(),
    ).toHaveLength(1);
    expect(getBookingPaymentStatus(db, booking.id)).toEqual({ openCents: 12_300, status: "open" });
    expect(
      db
        .select({ kind: journalEntries.kind })
        .from(journalEntries)
        .where(eq(journalEntries.bookingId, booking.id))
        .all(),
    ).toEqual([{ kind: "rental_charge" }]);
    expect(
      db
        .select({ eventType: bookingEvents.eventType })
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, booking.id))
        .all()
        .at(-1),
    ).toEqual({ eventType: "manual_booking_confirmed" });
  });

  it("keeps manual records editable even after completion, while web records cannot use the manual override", () => {
    const { db, assetId } = setup();
    const manual = inquiry(db, "2026-08-20", "2026-08-21");
    assignAdminBooking(db, manual.id);
    const details = {
      periodFrom: "2026-08-20",
      periodTo: "2026-08-21",
      pickupTime: "09:00",
      dropoffTime: "17:00",
      quotedTotalCents: 10_000,
      assetsByRequestedItem: { [manual.itemId]: assetId },
    };
    confirmManualBooking(db, { bookingId: manual.id, actorUserId: "admin", details });
    advanceBooking(db, manual.id, "checked_out", "admin");
    advanceBooking(db, manual.id, "completed", "admin");
    expect(() => confirmManualBooking(db, { bookingId: manual.id, actorUserId: "admin", details })).not.toThrow();
    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, manual.id)).get()).toEqual({
      status: "confirmed",
    });

    const web = createBooking(db, {
      customerName: "Web Customer",
      customerEmail: "web@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-08-20",
      periodTo: "2026-08-21",
      pickupTime: "09:00",
      dropoffTime: "17:00",
      customerMessage: "",
      communicationLocale: "de",
      source: "web",
      quotedTotalCents: 0,
      requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170 }],
    });
    assignAdminBooking(db, web.id);
    const webItem = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, web.id)).get()!;
    expect(() =>
      confirmManualBooking(db, {
        bookingId: web.id,
        actorUserId: "admin",
        details: { ...details, assetsByRequestedItem: { [webItem.id]: assetId } },
      }),
    ).toThrow("importierten oder manuell angelegten Buchungen");
  });

  it("updates confirmed booking times and queues a highlighted change mail", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });
    confirmOffer(db, offer.confirmationToken, "admin");
    const confirmed = db.select().from(bookings).where(eq(bookings.id, booking.id)).get()!;
    const item = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, booking.id)).get()!;

    const result = updateBooking(db, {
      bookingId: booking.id,
      expectedVersion: confirmed.version,
      actorUserId: "admin",
      customerName: confirmed.customerName,
      customerEmail: confirmed.customerEmail,
      customerPhone: confirmed.customerPhone,
      periodFrom: "2026-08-01",
      periodTo: "2026-08-03",
      pickupTime: "09:00",
      dropoffTime: "17:00",
      customerMessage: confirmed.customerMessage,
      communicationLocale: confirmed.communicationLocale,
      requestedItems: [{ ...item, requestedLabel: "Test Bike - L", needsHelmet: true }],
      notifyCustomer: true,
    });

    expect(result.mailId).toBeTypeOf("number");
    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()).toMatchObject({
      periodFrom: "2026-08-01",
      periodTo: "2026-08-03",
      pickupTime: "09:00",
      dropoffTime: "17:00",
    });
    expect(
      db.select().from(bookingAssetAllocations).where(eq(bookingAssetAllocations.bookingId, booking.id)).get(),
    ).toMatchObject({ periodFrom: "2026-08-01", periodTo: "2026-08-03", pickupTime: "09:00", dropoffTime: "17:00" });
    const mail = db.select().from(mailOutbox).where(eq(mailOutbox.id, result.mailId!)).get();
    expect(mail?.kind).toBe("booking_information_changed");
    expect(mail?.html).toContain("<strong>2026-08-01</strong>");
    expect(mail?.plainText).toContain("NEW 2026-08-01");
    expect(mail?.plainText).toContain("Bikes and equipment: NEW Test Bike - L");
    const acceptedOffer = db.select().from(bookingOffers).where(eq(bookingOffers.bookingId, booking.id)).get()!;
    expect(JSON.parse(acceptedOffer.priceSnapshotJson)).toMatchObject({
      equipmentSubtotalCents: 1_000,
      offeredItems: [{ requestedLabel: "Test Bike - L", accessories: { needsHelmet: true } }],
    });
  });

  it("changes the concrete bike of a confirmed booking and updates its allocation and offer snapshot", () => {
    const { db, assetId } = setup();
    const replacementModel = db
      .insert(bikeModels)
      .values({ location: "munich", modelKey: "replacement", title: "Replacement Bike", createdAt: new Date() })
      .returning({ id: bikeModels.id })
      .get();
    const replacementVariant = db
      .insert(bikeVariants)
      .values({ modelId: replacementModel.id, size: "M", createdAt: new Date() })
      .returning({ id: bikeVariants.id })
      .get();
    const replacement = db
      .insert(rentalAssets)
      .values({
        variantId: replacementVariant.id,
        location: "munich",
        assetCode: "TEST-2",
        displayName: "Test Bike - M 2",
        nickname: "Bike 2",
        dailyPriceCents: 5_500,
        weekdayPriceCents: 5_500,
        weekendPriceCents: 5_500,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: rentalAssets.id })
      .get();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });
    confirmOffer(db, offer.confirmationToken, "admin");
    const confirmed = db.select().from(bookings).where(eq(bookings.id, booking.id)).get()!;
    const item = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, booking.id)).get()!;

    const result = updateBooking(db, {
      bookingId: booking.id,
      expectedVersion: confirmed.version,
      actorUserId: "admin",
      customerName: confirmed.customerName,
      customerEmail: confirmed.customerEmail,
      customerPhone: confirmed.customerPhone,
      periodFrom: confirmed.periodFrom,
      periodTo: confirmed.periodTo,
      pickupTime: confirmed.pickupTime,
      dropoffTime: confirmed.dropoffTime,
      customerMessage: confirmed.customerMessage,
      communicationLocale: confirmed.communicationLocale,
      requestedItems: [item],
      notifyCustomer: true,
      assetsByRequestedItem: { [item.id]: replacement.id },
    });

    expect(
      db.select().from(bookingAssetAllocations).where(eq(bookingAssetAllocations.bookingId, booking.id)).all(),
    ).toMatchObject([{ assetId: replacement.id, releasedAt: null }]);
    expect(
      db
        .select({ assetId: bookingOfferItems.assetId })
        .from(bookingOfferItems)
        .where(eq(bookingOfferItems.offerId, offer.offerId))
        .get(),
    ).toEqual({ assetId: replacement.id });
    const acceptedOffer = db.select().from(bookingOffers).where(eq(bookingOffers.id, offer.offerId)).get()!;
    expect(JSON.parse(acceptedOffer.priceSnapshotJson)).toMatchObject({
      offeredItems: [{ assetId: replacement.id, assetName: "Test Bike - M 2", dailyPriceCents: 5_500 }],
      bikeSubtotalCents: 11_000,
      discountCents: 0,
    });
    const mail = db.select().from(mailOutbox).where(eq(mailOutbox.id, result.mailId!)).get();
    expect(mail?.plainText).toContain("Bikes: NEW Replacement Bike - M");
    expect(mail?.plainText).not.toContain("Bike 2");
  });

  it("rejects a concrete bike change when the replacement is already booked", () => {
    const { db, assetId, variantId } = setup();
    const replacement = db
      .insert(rentalAssets)
      .values({
        variantId,
        location: "munich",
        assetCode: "TEST-2",
        displayName: "Test Bike - M 2",
        dailyPriceCents: 5_000,
        weekdayPriceCents: 5_000,
        weekendPriceCents: 5_000,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: rentalAssets.id })
      .get();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    const otherBooking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    assignAdminBooking(db, otherBooking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });
    confirmOffer(db, offer.confirmationToken, "admin");
    const otherOffer = createOffer(db, {
      bookingId: otherBooking.id,
      assetsByRequestedItem: { [otherBooking.itemId]: replacement.id },
    });
    confirmOffer(db, otherOffer.confirmationToken, "admin");
    const confirmed = db.select().from(bookings).where(eq(bookings.id, booking.id)).get()!;
    const item = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, booking.id)).get()!;

    expect(() =>
      updateBooking(db, {
        bookingId: booking.id,
        expectedVersion: confirmed.version,
        actorUserId: "admin",
        customerName: confirmed.customerName,
        customerEmail: confirmed.customerEmail,
        customerPhone: confirmed.customerPhone,
        periodFrom: confirmed.periodFrom,
        periodTo: confirmed.periodTo,
        pickupTime: confirmed.pickupTime,
        dropoffTime: confirmed.dropoffTime,
        customerMessage: confirmed.customerMessage,
        communicationLocale: confirmed.communicationLocale,
        requestedItems: [item],
        notifyCustomer: true,
        assetsByRequestedItem: { [item.id]: replacement.id },
      }),
    ).toThrow("Das Fahrrad ist im neuen Zeitraum bereits anderweitig gebucht");
    expect(
      db.select().from(bookingAssetAllocations).where(eq(bookingAssetAllocations.bookingId, booking.id)).all(),
    ).toMatchObject([{ assetId, releasedAt: null }]);
    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.version).toBe(confirmed.version);
  });

  it("allows imported binding and completed bookings to update the rental amount", () => {
    for (const status of ["confirmed", "completed"] as const) {
      const { db, assetId } = setup();
      const created = createBooking(db, {
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
        customerPhone: "+49",
        location: "munich",
        periodFrom: "2026-07-20",
        periodTo: "2026-07-21",
        pickupTime: "10:00",
        dropoffTime: "10:00",
        customerMessage: "",
        communicationLocale: "de",
        source: "legacy",
        quotedTotalCents: 12_500,
        requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170 }],
      });
      const item = db
        .select()
        .from(bookingRequestedItems)
        .where(eq(bookingRequestedItems.bookingId, created.id))
        .get()!;

      setLegacyBookingStatus(db, {
        bookingId: created.id,
        status,
        details: {
          periodFrom: "2026-07-20",
          periodTo: "2026-07-21",
          pickupTime: "10:00",
          dropoffTime: "10:00",
          quotedTotalCents: 12_500,
          assetsByRequestedItem: { [item.id]: assetId },
          invoiceNumber: "YBR-2026-0001",
        },
      });

      const current = db.select().from(bookings).where(eq(bookings.id, created.id)).get()!;
      updateBooking(db, {
        bookingId: created.id,
        expectedVersion: current.version,
        actorUserId: "admin",
        customerName: current.customerName,
        customerEmail: current.customerEmail,
        customerPhone: current.customerPhone,
        periodFrom: current.periodFrom,
        periodTo: current.periodTo,
        pickupTime: current.pickupTime,
        dropoffTime: current.dropoffTime,
        customerMessage: current.customerMessage,
        communicationLocale: current.communicationLocale,
        requestedItems: [item],
        quotedTotalCents: 14_000,
      });

      expect(
        db
          .select({ quotedTotalCents: bookings.quotedTotalCents })
          .from(bookings)
          .where(eq(bookings.id, created.id))
          .get(),
      ).toEqual({ quotedTotalCents: 14_000 });
      expect(getBookingPaymentStatus(db, created.id)).toEqual({ openCents: 14_000, status: "open" });
      expect(
        db
          .select({ totalCents: bookingOffers.totalCents })
          .from(bookingOffers)
          .where(eq(bookingOffers.bookingId, created.id))
          .get(),
      ).toEqual({ totalCents: 14_000 });
    }
  });

  it("allows manually entered historical bookings to correct the rental amount after confirmation", () => {
    const { db, assetId } = setup();
    const created = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, created.id);
    confirmManualBooking(db, {
      bookingId: created.id,
      actorUserId: "admin",
      details: {
        periodFrom: "2026-07-20",
        periodTo: "2026-07-21",
        pickupTime: "10:00",
        dropoffTime: "10:00",
        quotedTotalCents: 12_500,
        assetsByRequestedItem: { [created.itemId]: assetId },
      },
    });
    const current = db.select().from(bookings).where(eq(bookings.id, created.id)).get()!;
    const item = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, created.id)).get()!;
    updateBooking(db, {
      bookingId: created.id,
      expectedVersion: current.version,
      actorUserId: "admin",
      customerName: current.customerName,
      customerEmail: current.customerEmail,
      customerPhone: current.customerPhone,
      periodFrom: current.periodFrom,
      periodTo: current.periodTo,
      pickupTime: current.pickupTime,
      dropoffTime: current.dropoffTime,
      customerMessage: current.customerMessage,
      communicationLocale: current.communicationLocale,
      requestedItems: [item],
      quotedTotalCents: 14_000,
    });

    expect(
      db
        .select({ quotedTotalCents: bookings.quotedTotalCents })
        .from(bookings)
        .where(eq(bookings.id, created.id))
        .get(),
    ).toEqual({
      quotedTotalCents: 14_000,
    });
  });

  it("reconciles an imported rental charge when a completed booking is corrected after payment", () => {
    const { db, assetId } = setup();
    const created = createBooking(db, {
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+49",
      location: "munich",
      periodFrom: "2026-07-20",
      periodTo: "2026-07-21",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      customerMessage: "",
      communicationLocale: "de",
      source: "legacy",
      quotedTotalCents: 11_760,
      requestedItems: [{ requestedLabel: "Test Bike - M", heightCm: 170 }],
    });
    assignAdminBooking(db, created.id);
    const item = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, created.id)).get()!;
    const details = {
      periodFrom: "2026-07-20",
      periodTo: "2026-07-21",
      pickupTime: "10:00",
      dropoffTime: "10:00",
      quotedTotalCents: 11_760,
      assetsByRequestedItem: { [item.id]: assetId },
      invoiceNumber: "YBR-2026-0001",
    };

    setLegacyBookingStatus(db, { bookingId: created.id, status: "completed", details });
    recordPayment(db, { bookingId: created.id, amountCents: 7_200, reason: "Zahlungseingang" });
    setLegacyBookingStatus(db, { bookingId: created.id, status: "rejected", reason: "Fehlstatus" });
    setLegacyBookingStatus(db, {
      bookingId: created.id,
      status: "completed",
      details: { ...details, quotedTotalCents: 12_000 },
    });

    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, created.id)).get()).toEqual({
      status: "completed",
    });
    expect(getBookingPaymentStatus(db, created.id)).toEqual({ openCents: 4_800, status: "open" });
  });

  it("covers the alternative offer to completed rental lifecycle", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, {
      bookingId: booking.id,
      assetsByRequestedItem: { [booking.itemId]: assetId },
      alternative: true,
      alternativeReason: "Das gewünschte Fahrrad ist leider nicht verfügbar.",
      actorUserId: "admin",
      reason: "Gewünschtes Modell nicht verfügbar",
    });
    confirmOffer(db, offer.confirmationToken, "admin");
    recordPayment(db, { bookingId: booking.id, amountCents: 10_000, reason: "Barzahlung", actorUserId: "admin" });
    advanceBooking(db, booking.id, "checked_out", "admin");
    advanceBooking(db, booking.id, "completed", "admin");
    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, booking.id)).get()?.status).toBe(
      "completed",
    );
    expect(getBookingPaymentStatus(db, booking.id)).toEqual({ openCents: 0, status: "settled" });
  });

  it("keeps a cancellation fee receivable after crediting an already confirmed rental", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, {
      bookingId: booking.id,
      assetsByRequestedItem: { [booking.itemId]: assetId },
      actorUserId: "admin",
    });
    confirmOffer(db, offer.confirmationToken, "admin");
    cancelBooking(db, {
      bookingId: booking.id,
      cancellationFeeCents: 2_000,
      reason: "Kund:innenwunsch",
      actorUserId: "admin",
    });
    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, booking.id)).get()?.status).toBe(
      "cancelled",
    );
    expect(getBookingPaymentStatus(db, booking.id)).toEqual({ openCents: 2_000, status: "open" });
    expect(
      db
        .select({ kind: journalEntries.kind })
        .from(journalEntries)
        .where(eq(journalEntries.bookingId, booking.id))
        .all()
        .map((entry) => entry.kind),
    ).toEqual(["rental_charge", "credit_note", "cancellation_fee"]);
  });

  it("includes the net refund in the cancellation mail", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, {
      bookingId: booking.id,
      assetsByRequestedItem: { [booking.itemId]: assetId },
      actorUserId: "admin",
    });
    confirmOffer(db, offer.confirmationToken, "admin");
    recordPayment(db, { bookingId: booking.id, amountCents: 10_000, reason: "Stripe", actorUserId: "admin" });

    const mailId = cancelBooking(db, {
      bookingId: booking.id,
      cancellationFeeCents: 2_000,
      reason: "Kund:innenwunsch",
      actorUserId: "admin",
    });

    expect(mailId).toBeTypeOf("number");
    expect(
      db
        .select({ plainText: mailOutbox.plainText, html: mailOutbox.html })
        .from(mailOutbox)
        .where(eq(mailOutbox.id, mailId!))
        .get(),
    ).toMatchObject({ plainText: expect.stringContaining("You will receive €80.00 back.") });
    expect(
      db.select({ html: mailOutbox.html }).from(mailOutbox).where(eq(mailOutbox.id, mailId!)).get()?.html,
    ).toContain("Booking cancelled");
  });

  it("expires due offers without binding a JavaScript Date into SQLite SQL", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });
    db.update(bookingOffers)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(bookingOffers.id, offer.offerId))
      .run();
    expect(expireDueOffers(db)).toBe(1);
    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, booking.id)).get()?.status).toBe(
      "expired",
    );
    expect(
      createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } }),
    ).toMatchObject({ quote: { totalCents: 10_000 } });
    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, booking.id)).get()?.status).toBe(
      "offer_sent",
    );
  });

  it("expires or revokes open offers together with the booking lifecycle", () => {
    const { db, assetId } = setup();
    const expired = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, expired.id);
    const expiredOffer = createOffer(db, {
      bookingId: expired.id,
      assetsByRequestedItem: { [expired.itemId]: assetId },
    });
    advanceBooking(db, expired.id, "expired", "admin", "Manuell abgelaufen");
    expect(
      db
        .select({ status: bookingOffers.status })
        .from(bookingOffers)
        .where(eq(bookingOffers.id, expiredOffer.offerId))
        .get(),
    ).toEqual({
      status: "expired",
    });

    const cancelled = inquiry(db, "2026-09-20", "2026-09-21");
    assignAdminBooking(db, cancelled.id);
    const cancelledOffer = createOffer(db, {
      bookingId: cancelled.id,
      assetsByRequestedItem: { [cancelled.itemId]: assetId },
    });
    cancelBooking(db, { bookingId: cancelled.id, cancellationFeeCents: 0, reason: "Nicht mehr benötigt" });
    expect(
      db
        .select({ status: bookingOffers.status })
        .from(bookingOffers)
        .where(eq(bookingOffers.id, cancelledOffer.offerId))
        .get(),
    ).toEqual({
      status: "revoked",
    });
  });
});
