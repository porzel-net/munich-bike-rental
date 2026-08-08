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
  bookingOffers,
  bookingRequestedItems,
  bookings,
  journalEntries,
  mailOutbox,
  rentalAssets,
} from "../../lib/db/schema";
import {
  BookingCommandError,
  advanceBooking,
  assignBooking,
  cancelBooking,
  confirmOffer,
  confirmOfferWithStripePayment,
  correctJournalEntry,
  createBooking,
  createDirectBooking,
  createOffer,
  expireDueOffers,
  getBookingPaymentStatus,
  previewOffer,
  recordPayment,
  updateBooking,
} from "../../lib/bookings/service";
import { renderOfferMail } from "../../lib/bookings/messages";
import { appendJournalEntry } from "../../lib/bookings/ledger";

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
  return { db, assetId: asset.id };
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
  it("rejects impossible dates and makes manual payments retry-safe", () => {
    const { db, assetId } = setup();
    expect(() => inquiry(db, "2026-02-30", "2026-03-01")).toThrow("Zeitraum und Uhrzeiten sind ungültig");

    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });
    confirmOffer(db, offer.confirmationToken, "admin");

    const firstEntry = recordPayment(db, {
      bookingId: booking.id,
      amountCents: 5_000,
      reason: "Anzahlung",
      actorUserId: "admin",
      idempotencyKey: "manual-payment-test-1",
    });
    expect(
      recordPayment(db, {
        bookingId: booking.id,
        amountCents: 5_000,
        reason: "Anzahlung wiederholt",
        actorUserId: "admin",
        idempotencyKey: "manual-payment-test-1",
      }),
    ).toBe(firstEntry);
    expect(() =>
      recordPayment(db, {
        bookingId: booking.id,
        amountCents: 5_001,
        reason: "Zu viel",
        actorUserId: "admin",
      }),
    ).toThrow("Gesamtpreis");

    expect(
      recordPayment(db, {
        bookingId: booking.id,
        amountCents: -1_000,
        reason: "Stornierung der Anzahlung",
        actorUserId: "admin",
      }),
    ).toBeTypeOf("number");
    expect(db.select({ kind: journalEntries.kind }).from(journalEntries).all().at(-1)?.kind).toBe("refund_issued");
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
      "Journal entry not found",
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
    expect(mail.text).toContain("Dieses Angebot reserviert das Fahrrad für dich für 36 Stunden.");
    expect(mail.text).toContain("Deine Checkliste für die Abholung:");
    expect(mail.text).toContain("Gabelsbergerstraße 79a, 80333 München, Maxvorstadt");
    expect(mail.text).toContain("WICHTIG:");
    expect(mail.text).not.toContain("**");
    expect(mail.text).toContain("100 % des Gesamtpreises über Stripe");
    expect(mail.text).not.toContain("Verwendungszweck:");
    expect(mail.text).toContain("Liebe Grüße,\nJulius");
    expect(mail.text).toContain("- Pedale: Look Keo2 Max");
    expect(mail.text).toContain("- Computerhalterung: Garmin");
    expect(mail.text).toContain("- Helm: Nicht enthalten");
    expect(mail.text).toContain("- Kleidung: Enthalten");
    expect(mail.text).not.toContain("lookKeo2Max");
    expect(mail.html).toContain("Angebot öffnen &amp; bezahlen");
    expect(mail.html).toContain("Dieses Angebot reserviert das Fahrrad für dich für 36 Stunden.");
    expect(mail.html).toContain("Gabelsbergerstraße 79a, 80333 München, Maxvorstadt");
    expect(mail.html).toContain('href="http://localhost:3000/angebot/test-token"');
  });

  it("queues a localized offer and atomically reserves the chosen asset only on confirmation", () => {
    const { db, assetId } = setup();
    const booking = inquiry(db, "2026-07-20", "2026-07-21");
    assignAdminBooking(db, booking.id);
    const offer = createOffer(db, { bookingId: booking.id, assetsByRequestedItem: { [booking.itemId]: assetId } });
    const outbox = db.select().from(mailOutbox).get()!;
    expect(outbox.locale).toBe("en");
    expect(outbox.plainText).toContain("reserves the bike for you for 36 hours");
    expect(confirmOffer(db, offer.confirmationToken)).toEqual({ bookingId: booking.id, alreadyConfirmed: false });
    expect(db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, booking.id)).get()).toEqual({
      status: "confirmed",
    });
    expect(getBookingPaymentStatus(db, booking.id)).toEqual({ openCents: 5_000, status: "open" });
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
    expect(db.select().from(mailOutbox).where(eq(mailOutbox.bookingId, booking.id)).get()?.plainText).toContain(
      `http://localhost:3000/angebot/${offer.confirmationToken}`,
    );
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
    expect(db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, booking.id)).all().at(-1)?.reason).toBe(
      "Fahrrad Verfügbarkeit",
    );
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
    expect(getBookingPaymentStatus(db, created.id)).toEqual({ openCents: 5_000, status: "open" });
    expect(db.select().from(mailOutbox).where(eq(mailOutbox.bookingId, created.id)).get()?.kind).toBe(
      "booking_confirmed",
    );
  });

  it("previews an alternative without creating an offer version", () => {
    const { db, assetId } = setup();
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
    expect(db.select().from(bookingOffers).where(eq(bookingOffers.bookingId, booking.id)).all()).toHaveLength(0);
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
      db.select({ plainText: mailOutbox.plainText }).from(mailOutbox).where(eq(mailOutbox.id, mailId!)).get(),
    ).toMatchObject({ plainText: expect.stringContaining("You will receive €80.00 back.") });
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
});
