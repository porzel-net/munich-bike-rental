import { createHash } from "node:crypto";

import { and, eq, like } from "drizzle-orm";

import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import {
  bookingAssetAllocations,
  bookingEvents,
  bookingOfferItems,
  bookingOffers,
  bookings,
  financialTransactions,
  rentalAssets,
} from "../db/schema";

import { allocateRequestedAccessories, hasAssetConflict } from "./availability";
import { BookingCommandError } from "./errors";
import { allocateInvoiceNumber } from "./invoice-number";
import { appendJournalEntry } from "./ledger";
import { renderBookingNotice } from "./messages";
import { parseOfferQuoteSnapshot, type OfferAccessorySelection } from "./quotes";
import { assertTransition, getBookingContactPhone, now, queueCustomerMail, transition } from "./service-shared";

type StripeOfferPayment = {
  amountCents: number;
  sessionId: string;
  paymentIntentId?: string | null;
};

function assertStripePaymentReference(payment: StripeOfferPayment) {
  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(payment.sessionId))
    throw new BookingCommandError("Die Stripe-Zahlungsreferenz ist ungültig.");
  if (!payment.paymentIntentId || !/^pi_[A-Za-z0-9_]+$/.test(payment.paymentIntentId))
    throw new BookingCommandError("Für die Stripe-Zahlung fehlt eine gültige Payment-Intent-Referenz.");
}

function confirmOfferRecord(
  db: AppDatabase,
  offer: typeof bookingOffers.$inferSelect,
  actorUserId?: string | null,
  payment?: StripeOfferPayment,
  offerToken?: string,
  options: {
    allowExpired?: boolean;
    confirmationReason?: string;
    sendMail?: boolean;
  } = {},
) {
  if (payment && (payment.amountCents !== offer.totalCents || !Number.isSafeInteger(payment.amountCents)))
    throw new BookingCommandError("Der Betrag der Stripe-Zahlung stimmt nicht mit dem ausgewählten Angebot überein.");
  if (payment) assertStripePaymentReference(payment);
  if (payment && offer.stripeSessionId && offer.stripeSessionId !== payment.sessionId)
    throw new BookingCommandError(
      "Dieses Angebot wurde bereits mit einer anderen Stripe-Session geöffnet. Eine zweite Stripe-Zahlung wird nicht angenommen.",
    );
  if (offer.status === "accepted") {
    if (!payment) return { bookingId: offer.bookingId, alreadyConfirmed: true };
    if (
      !offer.stripeSessionId ||
      offer.stripeSessionId !== payment.sessionId ||
      (offer.stripePaymentIntentId && offer.stripePaymentIntentId !== payment.paymentIntentId)
    )
      throw new BookingCommandError(
        "Dieses Angebot wurde bereits mit einer anderen Zahlung bestätigt. Eine zweite Stripe-Zahlung wird nicht angenommen.",
      );
    return { bookingId: offer.bookingId, alreadyConfirmed: true };
  }
  const offerExpired = offer.status === "expired" || offer.expiresAt.getTime() <= Date.now();
  if (
    options.allowExpired
      ? offer.status !== "sent" && offer.status !== "expired"
      : offer.status !== "sent" || offerExpired
  )
    throw new BookingCommandError(
      "Dieses Angebot ist nicht mehr verfügbar. Aktualisiere die Buchung und prüfe, ob ein neues Angebot vorliegt.",
    );
  const booking = db.select().from(bookings).where(eq(bookings.id, offer.bookingId)).get();
  if (!booking)
    throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
  if (options.allowExpired) {
    if (booking.status !== "offer_sent" && booking.status !== "expired")
      throw new BookingCommandError("Dieser Auftrag kann nicht mehr über dieses Angebot bestätigt werden.");
  } else {
    assertTransition(booking.status, "confirmed");
  }
  if (!booking.invoiceNumber) {
    const invoiceIssuedAt = now();
    db.update(bookings)
      .set({ invoiceNumber: allocateInvoiceNumber(db, invoiceIssuedAt), invoiceIssuedAt, updatedAt: invoiceIssuedAt })
      .where(eq(bookings.id, booking.id))
      .run();
  }
  const offeredAssets = db.select().from(bookingOfferItems).where(eq(bookingOfferItems.offerId, offer.id)).all();
  if (!offeredAssets.length)
    throw new BookingCommandError(
      "Für dieses Angebot wurden noch keine konkreten Fahrräder zugeordnet. Erstelle das Angebot erneut und wähle für jedes Fahrrad ein verfügbares Modell.",
    );
  for (const item of offeredAssets) {
    if (hasAssetConflict(db, booking, item.assetId))
      throw new BookingCommandError(
        "Mindestens eines der angebotenen Fahrräder ist inzwischen nicht mehr verfügbar. Das Angebot bleibt offen; erstelle es mit verfügbaren Fahrrädern neu.",
      );
    db.insert(bookingAssetAllocations)
      .values({
        bookingId: booking.id,
        offerId: offer.id,
        assetId: item.assetId,
        periodFrom: booking.periodFrom,
        periodTo: booking.periodTo,
        pickupTime: booking.pickupTime,
        dropoffTime: booking.dropoffTime,
        createdAt: now(),
      })
      .run();
  }
  const offerSnapshot = parseOfferQuoteSnapshot(offer.priceSnapshotJson) as {
    offeredItems?: Array<{ requestedItemId: number; accessories?: OfferAccessorySelection }>;
  };
  const accessoriesByRequestedItem = Object.fromEntries(
    (offerSnapshot.offeredItems ?? [])
      .filter((item): item is { requestedItemId: number; accessories: OfferAccessorySelection } =>
        Boolean(item.accessories),
      )
      .map((item) => [item.requestedItemId, item.accessories]),
  );
  allocateRequestedAccessories(db, booking, accessoriesByRequestedItem);
  db.update(bookingOffers)
    .set({
      status: "accepted",
      acceptedAt: now(),
      stripeSessionId: payment?.sessionId ?? null,
      stripePaymentIntentId: payment?.paymentIntentId ?? null,
    })
    .where(eq(bookingOffers.id, offer.id))
    .run();
  transition(
    db,
    booking,
    "confirmed",
    "offer_confirmed",
    actorUserId,
    options.confirmationReason ?? (options.allowExpired ? "Bestätigung durch Stripe-Zahlung" : ""),
    {
      offerId: offer.id,
      ...(payment ? { stripeSessionId: payment.sessionId, paidAmountCents: payment.amountCents } : {}),
    },
  );

  appendJournalEntry(db, {
    bookingId: booking.id,
    kind: "rental_charge",
    actorUserId,
    reason: payment ? "Gesamtbetrag für verbindliche Buchung" : "Gesamtbetrag für manuell verbindliche Buchung",
    lines: [
      { account: "accounts_receivable", amountCents: offer.totalCents },
      { account: "rental_revenue", amountCents: -offer.totalCents },
    ],
  });
  if (payment)
    appendJournalEntry(db, {
      bookingId: booking.id,
      kind: "payment_received",
      actorUserId,
      reason: `Stripe-Zahlung ${payment.sessionId}`,
      lines: [
        { account: "stripe_clearing", amountCents: payment.amountCents },
        { account: "accounts_receivable", amountCents: -payment.amountCents },
      ],
    });

  const notice = renderBookingNotice({
    kind: "confirmed",
    locale: booking.communicationLocale,
    name: booking.customerName,
    orderNumber: booking.orderNumber,
    contactPhone: getBookingContactPhone(db, booking),
    offerToken,
    bikes: offeredAssets.map((item) => {
      const asset = db.select().from(rentalAssets).where(eq(rentalAssets.id, item.assetId)).get();
      return { name: asset?.displayName ?? "Bike", frameNumber: asset?.frameNumber };
    }),
  });
  if (options.sendMail !== false) queueCustomerMail(db, booking, { kind: "booking_confirmed", mail: notice });
  return { bookingId: booking.id, alreadyConfirmed: false };
}

export function confirmOffer(db: AppDatabase, token: string, actorUserId?: string | null) {
  const hash = createHash("sha256").update(token).digest("hex");
  return runInImmediateTransaction(db, () => {
    const offer = db.select().from(bookingOffers).where(eq(bookingOffers.tokenHash, hash)).get();
    if (!offer)
      throw new BookingCommandError(
        "Dieses Angebot ist nicht mehr verfügbar. Aktualisiere die Buchung und prüfe, ob ein neues Angebot vorliegt.",
      );
    return confirmOfferRecord(db, offer, actorUserId, undefined, token);
  });
}

export function confirmOfferWithStripePayment(
  db: AppDatabase,
  input: {
    offerId: number;
    amountCents: number;
    sessionId: string;
    paymentIntentId?: string | null;
    offerToken?: string;
  },
) {
  return runInImmediateTransaction(db, () => {
    const offer = db.select().from(bookingOffers).where(eq(bookingOffers.id, input.offerId)).get();
    if (!offer)
      throw new BookingCommandError(
        "Dieses Angebot ist nicht mehr verfügbar. Aktualisiere die Buchung und prüfe, ob ein neues Angebot vorliegt.",
      );
    return confirmOfferRecord(
      db,
      offer,
      null,
      { amountCents: input.amountCents, sessionId: input.sessionId, paymentIntentId: input.paymentIntentId },
      input.offerToken,
    );
  });
}

export function assignStripePaymentToBooking(
  db: AppDatabase,
  input: {
    bookingId: number;
    offerId: number;
    amountCents: number;
    sessionId: string;
    paymentIntentId?: string | null;
    metadata: { bookingId?: string; bookingOfferId?: string; currency?: string | null };
    actorUserId: string;
    sendMail?: boolean;
  },
) {
  return runInImmediateTransaction(db, () => {
    const offer = db.select().from(bookingOffers).where(eq(bookingOffers.id, input.offerId)).get();
    if (!offer || offer.bookingId !== input.bookingId)
      throw new BookingCommandError("Das ausgewählte Angebot gehört nicht zu dieser Buchung.");
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents !== offer.totalCents)
      throw new BookingCommandError("Der Stripe-Betrag stimmt nicht mit dem ausgewählten Angebot überein.");
    if (
      input.metadata.bookingId !== String(input.bookingId) ||
      input.metadata.bookingOfferId !== String(input.offerId) ||
      input.metadata.currency?.toLowerCase() !== "eur"
    )
      throw new BookingCommandError("Die Stripe-Zahlung gehört nicht zu diesem Angebot.");
    if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(input.sessionId))
      throw new BookingCommandError("Die Stripe-Zahlungsreferenz ist ungültig.");
    if (!input.paymentIntentId || !/^pi_[A-Za-z0-9_]+$/.test(input.paymentIntentId))
      throw new BookingCommandError("Für die Stripe-Zahlung fehlt eine gültige Payment-Intent-Referenz.");

    const existingTransaction = db
      .select({ metadataJson: financialTransactions.metadataJson })
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.source, "stripe"),
          eq(financialTransactions.provider, "stripe"),
          eq(financialTransactions.reference, input.sessionId),
        ),
      )
      .get();
    if (existingTransaction) {
      try {
        const metadata = JSON.parse(existingTransaction.metadataJson) as { bookingId?: number };
        if (metadata.bookingId !== input.bookingId)
          throw new BookingCommandError("Diese Stripe-Zahlung ist bereits einer anderen Buchung zugeordnet.");
      } catch (error) {
        if (error instanceof BookingCommandError) throw error;
        throw new BookingCommandError("Die vorhandene Stripe-Zahlung hat ungültige Zuordnungsdaten.");
      }
    }
    const existingConfirmation = db
      .select({ bookingId: bookingEvents.bookingId })
      .from(bookingEvents)
      .where(
        and(
          eq(bookingEvents.eventType, "offer_confirmed"),
          like(bookingEvents.payloadJson, `%"stripeSessionId":"${input.sessionId}"%`),
        ),
      )
      .get();
    if (existingConfirmation && existingConfirmation.bookingId !== input.bookingId)
      throw new BookingCommandError("Diese Stripe-Zahlung ist bereits einer anderen Buchung zugeordnet.");

    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    if (booking.status !== "offer_sent" && booking.status !== "expired")
      throw new BookingCommandError("Nur offene oder abgelaufene Angebote können manuell bestätigt werden.");

    return confirmOfferRecord(
      db,
      offer,
      input.actorUserId,
      {
        amountCents: input.amountCents,
        sessionId: input.sessionId,
        paymentIntentId: input.paymentIntentId,
      },
      undefined,
      { allowExpired: true, confirmationReason: "Manuelle Zuordnung einer Stripe-Zahlung", sendMail: input.sendMail },
    );
  });
}
