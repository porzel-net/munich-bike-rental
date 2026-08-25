import { createHash, randomBytes } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import {
  authUser,
  bikeModels,
  bikeVariants,
  bookingOfferItems,
  bookingOffers,
  bookings,
  mailOutbox,
  rentalAssets,
} from "../db/schema";
import { bikeMatchesRequestedLabel } from "../inventory/display-name";

import { BookingCommandError } from "./errors";
import { hasAssetConflict } from "./availability";
import { renderOfferMail, type RenderedMail } from "./messages";
import { applyCustomOfferPrice, buildOfferQuote, type OfferAccessorySelection } from "./quotes";
import { assertBookingHasAssignee, event, firstName, getBookingPickupAddress, now, transition } from "./service-shared";
import { isValidIsoDate, isValidTime } from "./validation";

type OfferCommandInput = {
  bookingId: number;
  assetsByRequestedItem: Record<number, number>;
  accessoriesByRequestedItem?: Record<number, OfferAccessorySelection>;
  isStudent?: boolean;
  actorUserId?: string | null;
  reason?: string;
  alternative?: boolean;
  alternativeReason?: string;
  personalMessage?: string;
  customTotalCents?: number;
  periodFrom?: string;
  periodTo?: string;
  pickupTime?: string;
  dropoffTime?: string;
  sendMail?: boolean;
};

function getAlternativeFlag(
  db: AppDatabase,
  quote: ReturnType<typeof buildOfferQuote>,
  requestedAlternative: boolean | undefined,
) {
  return (
    Boolean(requestedAlternative) ||
    quote.offeredItems.some((item) => {
      const asset = db
        .select({ modelTitle: bikeModels.title, size: bikeVariants.size })
        .from(rentalAssets)
        .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
        .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
        .where(eq(rentalAssets.id, item.assetId))
        .get();
      return !asset || !bikeMatchesRequestedLabel(asset, item.requestedLabel);
    })
  );
}

function renderOfferContent(
  db: AppDatabase,
  booking: typeof bookings.$inferSelect,
  quote: ReturnType<typeof buildOfferQuote>,
  input: OfferCommandInput,
  alternative: boolean,
  token: string,
): RenderedMail {
  return renderOfferMail({
    locale: booking.communicationLocale,
    alternative,
    alternativeReason: input.alternativeReason?.trim(),
    name: booking.customerName,
    email: booking.customerEmail,
    phone: booking.customerPhone,
    customerMessage: booking.customerMessage,
    personalMessage: input.personalMessage?.trim(),
    orderNumber: booking.orderNumber,
    requested: quote.offeredItems,
    totalCents: quote.totalCents,
    calculatedTotalCents: quote.calculatedTotalCents,
    periodFrom: input.periodFrom ?? booking.periodFrom,
    periodTo: input.periodTo ?? booking.periodTo,
    pickupTime: input.pickupTime ?? booking.pickupTime,
    dropoffTime: input.dropoffTime ?? booking.dropoffTime,
    location: booking.location,
    pickupAddress: getBookingPickupAddress(db, booking),
    token,
    senderFirstName: firstName(
      input.actorUserId
        ? db.select({ name: authUser.name }).from(authUser).where(eq(authUser.id, input.actorUserId)).get()?.name
        : undefined,
    ),
  });
}

export function createOffer(db: AppDatabase, input: OfferCommandInput) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    assertBookingHasAssignee(db, booking);
    if (booking.status !== "inquiry_received" && booking.status !== "offer_sent" && booking.status !== "expired")
      throw new BookingCommandError(
        "Ein Angebot kann nur für eine neue Anfrage oder zum Ersetzen eines bestehenden Angebots erstellt werden.",
      );

    const periodFrom = input.periodFrom ?? booking.periodFrom;
    const periodTo = input.periodTo ?? booking.periodTo;
    const pickupTime = input.pickupTime ?? booking.pickupTime;
    const dropoffTime = input.dropoffTime ?? booking.dropoffTime;
    if (
      !isValidIsoDate(periodFrom) ||
      !isValidIsoDate(periodTo) ||
      periodFrom > periodTo ||
      !isValidTime(pickupTime) ||
      !isValidTime(dropoffTime)
    )
      throw new BookingCommandError("Zeitraum und Übergabezeiten sind ungültig");

    const offerBooking = { ...booking, periodFrom, periodTo, pickupTime, dropoffTime };
    const quote = applyCustomOfferPrice(
      buildOfferQuote(db, booking.id, input.assetsByRequestedItem, input.accessoriesByRequestedItem, input.isStudent, {
        periodFrom,
        periodTo,
      }),
      input.customTotalCents,
    );
    const alternative = getAlternativeFlag(db, quote, input.alternative);
    if (alternative && !input.alternativeReason?.trim())
      throw new BookingCommandError("Für ein alternatives Fahrrad muss ein Änderungsgrund angegeben werden");
    for (const item of quote.offeredItems) {
      if (hasAssetConflict(db, offerBooking, item.assetId))
        throw new BookingCommandError(
          "Das ausgewählte Fahrrad ist im gewählten Zeitraum bereits vergeben. Wähle ein anderes Fahrrad oder ändere den Zeitraum.",
        );
    }

    const previous = db
      .select()
      .from(bookingOffers)
      .where(and(eq(bookingOffers.bookingId, booking.id), eq(bookingOffers.status, "sent")))
      .all();
    const stamp = now();
    for (const offer of previous)
      db.update(bookingOffers).set({ status: "revoked", revokedAt: stamp }).where(eq(bookingOffers.id, offer.id)).run();

    const offerNumber =
      (db
        .select({ number: sql<number>`coalesce(max(${bookingOffers.offerNumber}), 0)` })
        .from(bookingOffers)
        .where(eq(bookingOffers.bookingId, booking.id))
        .get()?.number ?? 0) + 1;
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 36 * 60 * 60 * 1_000);
    const offer = db
      .insert(bookingOffers)
      .values({
        bookingId: booking.id,
        offerNumber,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        totalCents: quote.totalCents,
        priceSnapshotJson: JSON.stringify(quote),
        expiresAt,
        createdBy: input.actorUserId ?? null,
        createdAt: stamp,
        replacesOfferId: previous.at(-1)?.id ?? null,
      })
      .returning({ id: bookingOffers.id })
      .get();
    db.insert(bookingOfferItems)
      .values(
        quote.offeredItems.map((item) => ({
          offerId: offer.id,
          requestedItemId: item.requestedItemId,
          assetId: item.assetId,
          itemPriceCents: item.dailyPriceCents,
        })),
      )
      .run();
    db.update(bookings)
      .set({
        quotedTotalCents: quote.totalCents,
        periodFrom,
        periodTo,
        pickupTime,
        dropoffTime,
        version: booking.version + 1,
        updatedAt: stamp,
      })
      .where(eq(bookings.id, booking.id))
      .run();

    const content = renderOfferContent(
      db,
      booking,
      quote,
      { ...input, periodFrom, periodTo, pickupTime, dropoffTime },
      alternative,
      token,
    );
    if (input.sendMail !== false)
      db.insert(mailOutbox)
        .values({
          bookingId: booking.id,
          offerId: offer.id,
          idempotencyKey: `offer:${offer.id}`,
          kind: alternative ? "alternative_offer" : "offer",
          locale: booking.communicationLocale,
          recipient: booking.customerEmail,
          subject: content.subject,
          plainText: content.text,
          html: content.html,
          status: "queued",
          attempts: 0,
          nextAttemptAt: stamp,
          createdAt: stamp,
        })
        .run();
    if (booking.status === "inquiry_received" || booking.status === "expired")
      transition(
        db,
        booking,
        "offer_sent",
        alternative ? "alternative_offer_sent" : "offer_sent",
        input.actorUserId,
        input.alternativeReason?.trim() ?? input.reason ?? "",
        { offerId: offer.id, quote },
      );
    else
      event(
        db,
        booking.id,
        alternative ? "alternative_offer_sent" : "offer_revised",
        "offer_sent",
        "offer_sent",
        input.actorUserId,
        input.alternativeReason?.trim() ?? input.reason ?? "",
        { offerId: offer.id, quote },
      );
    return { offerId: offer.id, confirmationToken: token, expiresAt, quote };
  });
}

export function revokeOffer(
  db: AppDatabase,
  input: { bookingId: number; actorUserId?: string | null; reason?: string },
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    assertBookingHasAssignee(db, booking);
    if (booking.status !== "offer_sent")
      throw new BookingCommandError("Nur ein ausgestelltes Angebot kann zurückgezogen werden.");
    const offers = db
      .select()
      .from(bookingOffers)
      .where(and(eq(bookingOffers.bookingId, booking.id), eq(bookingOffers.status, "sent")))
      .all();
    if (!offers.length) throw new BookingCommandError("Für diese Buchung gibt es kein aktives Angebot.");
    const stamp = now();
    for (const offer of offers)
      db.update(bookingOffers).set({ status: "revoked", revokedAt: stamp }).where(eq(bookingOffers.id, offer.id)).run();
    db.update(bookings)
      .set({ version: booking.version + 1, updatedAt: stamp })
      .where(eq(bookings.id, booking.id))
      .run();
    event(
      db,
      booking.id,
      "offer_revoked",
      booking.status,
      booking.status,
      input.actorUserId,
      input.reason?.trim() ?? "",
      { offerIds: offers.map((offer) => offer.id) },
    );
    return { offerIds: offers.map((offer) => offer.id) };
  });
}

export function previewOffer(db: AppDatabase, input: Omit<OfferCommandInput, "sendMail">) {
  const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
  if (!booking || !["inquiry_received", "offer_sent", "expired"].includes(booking.status))
    throw new BookingCommandError(
      "Ein Angebot kann nur für eine neue Anfrage oder zum Ersetzen eines bestehenden Angebots erstellt werden.",
    );
  assertBookingHasAssignee(db, booking);
  const periodFrom = input.periodFrom ?? booking.periodFrom;
  const periodTo = input.periodTo ?? booking.periodTo;
  const pickupTime = input.pickupTime ?? booking.pickupTime;
  const dropoffTime = input.dropoffTime ?? booking.dropoffTime;
  if (
    !isValidIsoDate(periodFrom) ||
    !isValidIsoDate(periodTo) ||
    periodFrom > periodTo ||
    !isValidTime(pickupTime) ||
    !isValidTime(dropoffTime)
  )
    throw new BookingCommandError("Zeitraum und Übergabezeiten sind ungültig");
  const quote = applyCustomOfferPrice(
    buildOfferQuote(db, booking.id, input.assetsByRequestedItem, input.accessoriesByRequestedItem, input.isStudent, {
      periodFrom,
      periodTo,
    }),
    input.customTotalCents,
  );
  const alternative = getAlternativeFlag(db, quote, input.alternative);
  if (alternative && !input.alternativeReason?.trim())
    throw new BookingCommandError("Für ein alternatives Fahrrad muss ein Änderungsgrund angegeben werden");
  const offerBooking = { ...booking, periodFrom, periodTo, pickupTime, dropoffTime };
  for (const item of quote.offeredItems) {
    if (hasAssetConflict(db, offerBooking, item.assetId))
      throw new BookingCommandError(
        "Das ausgewählte Fahrrad ist im gewählten Zeitraum bereits vergeben. Wähle ein anderes Fahrrad oder ändere den Zeitraum.",
      );
  }
  return {
    quote,
    mail: renderOfferContent(
      db,
      booking,
      quote,
      { ...input, periodFrom, periodTo, pickupTime, dropoffTime },
      alternative,
      "VORSCHAU",
    ),
  };
}
