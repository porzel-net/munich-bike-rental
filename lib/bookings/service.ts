import { createHash, randomBytes, randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import {
  authUser,
  bookingAccessoryAllocations,
  bookingAssetAllocations,
  bookingEvents,
  bookingFeedback,
  bookingOfferItems,
  bookingOffers,
  bookingPublicLinks,
  bookingRequestedItems,
  bookings,
  bikeModels,
  bikeVariants,
  communicationMessages,
  emailActionReviews,
  financialDocumentLinks,
  financialTransactionAllocations,
  journalEntries,
  mailOutbox,
  rentalAssets,
  type BookingStatus,
} from "../db/schema";
import { createOrderNumber } from "../inquiries/server";
import { normalizeComputerMountType, normalizePedalType } from "../inquiries/catalog";

import { BookingCommandError } from "./errors";
export { canTransition } from "./service-shared";
import { allocateRequestedAccessories, hasAssetConflict } from "./availability";
import { isHistoricalAssetSelectableForBooking } from "./historical-availability";
import { appendJournalEntry } from "./ledger";
import { confirmedBookingChargeCents } from "./money";
import { renderBookingNotice, renderInquiryReceivedMail } from "./messages";
import { applyCustomOfferPrice, buildOfferQuote } from "./quotes";
import { allocateInvoiceNumber, invoiceNumberPattern } from "./invoice-number";
import { isValidIsoDate, isValidTime } from "./validation";
import { type BookingRequestedItemCommand } from "./command-types";
export type { BookingRequestedItemCommand } from "./command-types";
export { createOffer, previewOffer, revokeOffer } from "./offer-service";
export {
  assignStripePaymentToBooking,
  confirmOffer,
  confirmOfferWithStripePayment,
} from "./offer-confirmation-service";
export { updateBooking, type UpdateBookingCommand } from "./update-service";
export {
  correctJournalEntry,
  getBookingPaymentStatus,
  recognizedRentalChargeCents,
  recordRefund,
  type BookingMoneyMovementInput,
} from "./payment-service";
import { recognizedRentalChargeCents } from "./payment-service";
export { advanceBooking, cancelBooking, expireDueOffers } from "./lifecycle-service";
import { event, getBookingContactPhone, now } from "./service-shared";

export { BookingCommandError } from "./errors";

/**
 * Permanently removes a booking only when it has no accounting or operational history.
 * This is intentionally stricter than a normal cancellation: financial evidence must remain
 * immutable and an allocated or completed rental must never disappear silently.
 */
export function deleteBookingPermanently(db: AppDatabase, bookingId: number) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    if (["confirmed", "checked_out", "completed"].includes(booking.status)) {
      throw new BookingCommandError("Verbindliche oder bereits ausgegebene Buchungen können nicht gelöscht werden.");
    }
    if (booking.invoiceNumber || booking.invoiceIssuedAt) {
      throw new BookingCommandError("Buchungen mit Rechnungsdaten können nicht gelöscht werden.");
    }

    const requestedItems = db
      .select({ id: bookingRequestedItems.id })
      .from(bookingRequestedItems)
      .where(eq(bookingRequestedItems.bookingId, bookingId))
      .all();
    const requestedItemIds = requestedItems.map((item) => item.id);
    const hasJournal = db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(eq(journalEntries.bookingId, bookingId))
      .get();
    const hasFinancialAllocation = db
      .select({ id: financialTransactionAllocations.id })
      .from(financialTransactionAllocations)
      .where(
        requestedItemIds.length
          ? sql`${financialTransactionAllocations.bookingId} = ${bookingId} OR ${financialTransactionAllocations.bookingRequestedItemId} IN (${sql.join(
              requestedItemIds.map((id) => sql`${id}`),
              sql`, `,
            )})`
          : eq(financialTransactionAllocations.bookingId, bookingId),
      )
      .get();
    const hasFinancialDocument = db
      .select({ id: financialDocumentLinks.id })
      .from(financialDocumentLinks)
      .where(eq(financialDocumentLinks.bookingId, bookingId))
      .get();
    if (hasJournal || hasFinancialAllocation || hasFinancialDocument) {
      throw new BookingCommandError("Buchungen mit Finanz- oder Journalverknüpfungen können nicht gelöscht werden.");
    }

    const hasAllocation = db
      .select({ id: bookingAssetAllocations.id })
      .from(bookingAssetAllocations)
      .where(eq(bookingAssetAllocations.bookingId, bookingId))
      .get();
    const hasAccessoryAllocation = db
      .select({ id: bookingAccessoryAllocations.id })
      .from(bookingAccessoryAllocations)
      .where(eq(bookingAccessoryAllocations.bookingId, bookingId))
      .get();
    if (hasAllocation || hasAccessoryAllocation) {
      throw new BookingCommandError("Buchungen mit Fahrrad- oder Zubehörausgaben können nicht gelöscht werden.");
    }

    db.delete(mailOutbox).where(eq(mailOutbox.bookingId, bookingId)).run();
    db.delete(bookingFeedback).where(eq(bookingFeedback.bookingId, bookingId)).run();
    db.delete(bookingEvents).where(eq(bookingEvents.bookingId, bookingId)).run();
    db.delete(bookingPublicLinks).where(eq(bookingPublicLinks.bookingId, bookingId)).run();
    db.delete(bookingOfferItems)
      .where(sql`${bookingOfferItems.offerId} IN (SELECT id FROM booking_offers WHERE booking_id = ${bookingId})`)
      .run();
    db.delete(emailActionReviews).where(eq(emailActionReviews.bookingId, bookingId)).run();
    db.delete(communicationMessages).where(eq(communicationMessages.bookingId, bookingId)).run();
    db.delete(bookingOffers).where(eq(bookingOffers.bookingId, bookingId)).run();
    db.delete(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, bookingId)).run();
    db.delete(bookings).where(eq(bookings.id, bookingId)).run();
  });
}

export type BookingStatusDetails = {
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  quotedTotalCents: number;
  assetsByRequestedItem: Record<number, number>;
  invoiceNumber?: string;
  reason?: string;
};

type SetHistoricalBookingStatusInput = {
  bookingId: number;
  status: BookingStatus;
  details?: BookingStatusDetails;
  reason?: string;
  actorUserId?: string | null;
  allowManualBooking?: boolean;
};

const statusesRequiringBookingDetails = new Set<BookingStatus>(["offer_sent", "confirmed", "checked_out", "completed"]);
const statusesRequiringAssets = new Set<BookingStatus>(["offer_sent", "confirmed", "checked_out", "completed"]);
const statusesRequiringInvoice = new Set<BookingStatus>(["confirmed", "checked_out", "completed"]);

/** Historical records can be moved between states, but each state must have coherent data. */
function setHistoricalBookingStatusInTransaction(db: AppDatabase, input: SetHistoricalBookingStatusInput) {
  const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
  if (!booking)
    throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
  const isManualConfirmation = input.allowManualBooking && input.status === "confirmed" && booking.source === "manual";
  if (booking.source !== "legacy" && !isManualConfirmation)
    throw new BookingCommandError(
      "Der Status kann hier nur bei importierten oder manuell angelegten Buchungen frei geändert werden",
    );
  if (booking.status === input.status && !input.details) return booking;

  const requiresDetails = statusesRequiringBookingDetails.has(input.status);
  const requiresAssets = statusesRequiringAssets.has(input.status);
  const requiresInvoice = statusesRequiringInvoice.has(input.status);
  const details = input.details;
  const stamp = now();
  if (
    requiresDetails &&
    (!details ||
      !isValidIsoDate(details.periodFrom) ||
      !isValidIsoDate(details.periodTo) ||
      details.periodFrom > details.periodTo ||
      !isValidTime(details.pickupTime) ||
      !isValidTime(details.dropoffTime) ||
      !Number.isInteger(details.quotedTotalCents) ||
      details.quotedTotalCents < 0)
  )
    throw new BookingCommandError(
      "Für diesen Status müssen Zeitraum, Uhrzeiten und Preis vollständig angegeben werden",
    );

  let resolvedInvoiceNumber = booking.invoiceNumber;
  if (requiresInvoice) {
    const requestedInvoiceNumber = details?.invoiceNumber?.trim() ?? "";
    if (requestedInvoiceNumber && !invoiceNumberPattern.test(requestedInvoiceNumber))
      throw new BookingCommandError("Die Rechnungsnummer muss dem Format YBR-JJJJ-NNNN entsprechen");
    if (booking.invoiceNumber) {
      if (requestedInvoiceNumber && requestedInvoiceNumber !== booking.invoiceNumber)
        throw new BookingCommandError("Die bereits vergebene Rechnungsnummer darf nicht geändert werden");
    } else {
      try {
        const expectedInvoiceNumber = allocateInvoiceNumber(db, stamp);
        if (requestedInvoiceNumber && requestedInvoiceNumber !== expectedInvoiceNumber)
          throw new BookingCommandError(`Die nächste zulässige Rechnungsnummer ist ${expectedInvoiceNumber}`);
        resolvedInvoiceNumber = expectedInvoiceNumber;
      } catch (error) {
        if (error instanceof BookingCommandError) throw error;
        throw new BookingCommandError(error instanceof Error ? error.message : "Rechnungsnummern sind ungültig");
      }
    }
  }

  const currentItems = db
    .select()
    .from(bookingRequestedItems)
    .where(eq(bookingRequestedItems.bookingId, booking.id))
    .all();
  if (requiresAssets) {
    const assetsByRequestedItem = details?.assetsByRequestedItem ?? {};
    const itemIds = currentItems.map((item) => item.id);
    const selectedItemIds = Object.keys(assetsByRequestedItem).map(Number);
    if (
      selectedItemIds.length !== itemIds.length ||
      itemIds.some((itemId) => !selectedItemIds.includes(itemId)) ||
      new Set(Object.values(assetsByRequestedItem)).size !== itemIds.length
    )
      throw new BookingCommandError("Für jedes angefragte Fahrrad muss ein konkretes Fahrrad ausgewählt werden");

    const selectedAssets = db
      .select({ asset: rentalAssets, modelTitle: bikeModels.title, size: bikeVariants.size })
      .from(rentalAssets)
      .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
      .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
      .where(inArray(rentalAssets.id, Object.values(assetsByRequestedItem)))
      .all();
    if (
      selectedAssets.length !== itemIds.length ||
      selectedAssets.some(
        (asset) =>
          asset.asset.location !== booking.location ||
          !isHistoricalAssetSelectableForBooking(booking, {
            ...asset.asset,
            modelTitle: asset.modelTitle,
            size: asset.size,
          }),
      )
    )
      throw new BookingCommandError("Mindestens eines der ausgewählten Fahrräder ist nicht verfügbar");
  }

  const nextBooking = {
    ...booking,
    ...(details
      ? {
          periodFrom: details.periodFrom,
          periodTo: details.periodTo,
          pickupTime: details.pickupTime,
          dropoffTime: details.dropoffTime,
          quotedTotalCents: details.quotedTotalCents,
        }
      : {}),
  };

  db.update(bookingAssetAllocations)
    .set({ releasedAt: stamp })
    .where(and(eq(bookingAssetAllocations.bookingId, booking.id), sql`${bookingAssetAllocations.releasedAt} is null`))
    .run();
  db.update(bookingAccessoryAllocations)
    .set({ releasedAt: stamp })
    .where(
      and(
        eq(bookingAccessoryAllocations.bookingId, booking.id),
        sql`${bookingAccessoryAllocations.releasedAt} is null`,
      ),
    )
    .run();

  let quote: ReturnType<typeof buildOfferQuote> | null = null;
  if (requiresAssets) {
    const assetsByRequestedItem = details!.assetsByRequestedItem;
    db.update(bookings)
      .set({
        periodFrom: nextBooking.periodFrom,
        periodTo: nextBooking.periodTo,
        pickupTime: nextBooking.pickupTime,
        dropoffTime: nextBooking.dropoffTime,
        quotedTotalCents: nextBooking.quotedTotalCents,
      })
      .where(eq(bookings.id, booking.id))
      .run();
    if (Object.values(assetsByRequestedItem).some((assetId) => hasAssetConflict(db, nextBooking, assetId)))
      throw new BookingCommandError("Mindestens eines der ausgewählten Fahrräder ist im Zeitraum bereits belegt");
    quote = applyCustomOfferPrice(buildOfferQuote(db, booking.id, assetsByRequestedItem), details!.quotedTotalCents);
  }

  if (isManualConfirmation)
    db.update(bookingOffers)
      .set({ status: "revoked", revokedAt: stamp })
      .where(and(eq(bookingOffers.bookingId, booking.id), eq(bookingOffers.status, "sent")))
      .run();

  if (input.allowManualBooking) allocateRequestedAccessories(db, nextBooking, {}, stamp);

  db.update(bookings)
    .set({
      status: input.status,
      ...(details
        ? {
            periodFrom: details.periodFrom,
            periodTo: details.periodTo,
            pickupTime: details.pickupTime,
            dropoffTime: details.dropoffTime,
            quotedTotalCents: details.quotedTotalCents,
          }
        : {}),
      ...(requiresInvoice && details
        ? {
            invoiceNumber: resolvedInvoiceNumber,
            invoiceIssuedAt: booking.invoiceNumber ? booking.invoiceIssuedAt : stamp,
          }
        : {}),
      version: booking.version + 1,
      updatedAt: stamp,
    })
    .where(eq(bookings.id, booking.id))
    .run();

  if (quote) {
    const offer = db
      .insert(bookingOffers)
      .values({
        bookingId: booking.id,
        offerNumber:
          (db
            .select({ number: sql<number>`coalesce(max(${bookingOffers.offerNumber}), 0)` })
            .from(bookingOffers)
            .where(eq(bookingOffers.bookingId, booking.id))
            .get()?.number ?? 0) + 1,
        status: input.status === "offer_sent" ? "sent" : "accepted",
        tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
        expiresAt: input.status === "offer_sent" ? new Date(stamp.getTime() + 36 * 60 * 60 * 1_000) : stamp,
        sentAt: input.status === "offer_sent" ? stamp : null,
        acceptedAt: input.status === "offer_sent" ? null : stamp,
        totalCents: quote.totalCents,
        priceSnapshotJson: JSON.stringify(quote),
        createdBy: input.actorUserId ?? null,
        createdAt: stamp,
      })
      .returning({ id: bookingOffers.id })
      .get();
    db.insert(bookingOfferItems)
      .values(
        quote.offeredItems.map((item) => ({
          offerId: offer.id,
          requestedItemId: item.requestedItemId,
          assetId: item.assetId,
          itemPriceCents: item.weekdayPriceCents,
        })),
      )
      .run();
    if (input.status !== "offer_sent")
      db.insert(bookingAssetAllocations)
        .values(
          quote.offeredItems.map((item) => ({
            bookingId: booking.id,
            offerId: offer.id,
            assetId: item.assetId,
            periodFrom: nextBooking.periodFrom,
            periodTo: nextBooking.periodTo,
            pickupTime: nextBooking.pickupTime,
            dropoffTime: nextBooking.dropoffTime,
            createdAt: stamp,
          })),
        )
        .run();
  }

  // Imported bookings may already have payments or a previous rental charge
  // when their status is corrected. Bring the receivable to the selected
  // total by posting only the difference; never duplicate or remove payments.
  if (["confirmed", "checked_out", "completed"].includes(input.status) && details) {
    const recognizedRentalCents = recognizedRentalChargeCents(db, booking.id);
    const rentalChargeDelta = details.quotedTotalCents - recognizedRentalCents;
    if (rentalChargeDelta !== 0)
      appendJournalEntry(db, {
        bookingId: booking.id,
        kind: "rental_charge",
        actorUserId: input.actorUserId,
        idempotencyKey: `${input.allowManualBooking ? "manual_booking_charge" : "historical_booking_charge_adjustment"}:${booking.id}:${booking.version + 1}`,
        reason: input.allowManualBooking
          ? "Mietpreis der Buchung manuell festgelegt"
          : "Mietpreis der importierten Buchung angepasst",
        lines: [
          { account: "accounts_receivable", amountCents: rentalChargeDelta },
          { account: "rental_revenue", amountCents: -rentalChargeDelta },
        ],
      });
  }

  event(
    db,
    booking.id,
    input.allowManualBooking ? "manual_booking_confirmed" : "historical_booking_status_changed",
    booking.status,
    input.status,
    input.actorUserId,
    input.allowManualBooking
      ? "Buchung manuell verbindlich bestätigt"
      : "Status der historischen Buchung manuell geändert",
    {
      reason: details?.reason ?? input.reason ?? "",
      requiresBookingDetails: requiresDetails,
      invoiceNumber: requiresInvoice ? resolvedInvoiceNumber : booking.invoiceNumber,
      assignedAssets: quote?.offeredItems.map((item) => item.assetName) ?? [],
    },
  );
  return {
    ...booking,
    status: input.status,
    ...(details
      ? {
          periodFrom: details.periodFrom,
          periodTo: details.periodTo,
          pickupTime: details.pickupTime,
          dropoffTime: details.dropoffTime,
          quotedTotalCents: details.quotedTotalCents,
        }
      : {}),
    ...(requiresInvoice && details
      ? {
          invoiceNumber: resolvedInvoiceNumber,
          invoiceIssuedAt: booking.invoiceNumber ? booking.invoiceIssuedAt : stamp,
        }
      : {}),
    version: booking.version + 1,
  };
}

export function setHistoricalBookingStatus(db: AppDatabase, input: SetHistoricalBookingStatusInput) {
  return runInImmediateTransaction(db, () => setHistoricalBookingStatusInTransaction(db, input));
}

/** Records whether open booking questions were clarified outside the e-mail thread. */
export function setBookingEmailQuestionsResolved(
  db: AppDatabase,
  input: { bookingId: number; resolved: boolean; actorUserId?: string | null },
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    const timestamp = now();
    event(
      db,
      booking.id,
      input.resolved ? "email_questions_resolved" : "email_questions_reopened",
      booking.status,
      booking.status,
      input.actorUserId,
      input.resolved ? "Fragen telefonisch oder persönlich geklärt" : "Fragen wieder zur Prüfung geöffnet",
      {},
      timestamp,
    );
    return { resolved: input.resolved, occurredAt: timestamp };
  });
}

/** Acknowledges any current booking attention, such as an open question or an expired offer. */
export function acknowledgeBookingAttention(
  db: AppDatabase,
  input: { bookingId: number; actorUserId?: string | null },
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    const timestamp = now();
    event(
      db,
      booking.id,
      "booking_attention_acknowledged",
      booking.status,
      booking.status,
      input.actorUserId,
      "Kenntnis genommen",
      {},
      timestamp,
    );
    return { acknowledged: true, occurredAt: timestamp };
  });
}

/** Confirms a regular booking directly when the agreement was made outside the offer flow. */
export function confirmManualBooking(
  db: AppDatabase,
  input: { bookingId: number; details: Omit<BookingStatusDetails, "invoiceNumber">; actorUserId?: string | null },
) {
  return runInImmediateTransaction(db, () =>
    setHistoricalBookingStatusInTransaction(db, {
      bookingId: input.bookingId,
      status: "confirmed",
      details: input.details,
      actorUserId: input.actorUserId,
      allowManualBooking: true,
    }),
  );
}

export function assignBooking(
  db: AppDatabase,
  input: { bookingId: number; assigneeUserId: string; actorUserId?: string | null },
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    const activeAssigneeId = booking.assignedUserId
      ? (db.select({ id: authUser.id }).from(authUser).where(eq(authUser.id, booking.assignedUserId)).get()?.id ?? null)
      : null;
    const assignee = db
      .select({
        id: authUser.id,
        name: authUser.name,
        role: authUser.role,
        locationKey: authUser.locationKey,
      })
      .from(authUser)
      .where(eq(authUser.id, input.assigneeUserId))
      .get();
    if (!assignee)
      throw new BookingCommandError(
        "Der ausgewählte Sachbearbeiter wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.",
      );
    if (assignee.role !== "admin" && assignee.locationKey !== booking.location)
      throw new BookingCommandError("Der ausgewählte Sachbearbeiter ist für diesen Standort nicht verfügbar");

    const actorIsAdmin = input.actorUserId
      ? db.select({ role: authUser.role }).from(authUser).where(eq(authUser.id, input.actorUserId)).get()?.role ===
        "admin"
      : false;
    if (!actorIsAdmin) {
      if (input.assigneeUserId !== input.actorUserId)
        throw new BookingCommandError("Du kannst nur dich selbst als Sachbearbeiter eintragen");
      if (activeAssigneeId && activeAssigneeId !== input.actorUserId)
        throw new BookingCommandError("Diese Buchung ist bereits einem anderen Sachbearbeiter zugewiesen");
    }

    if (activeAssigneeId === input.assigneeUserId)
      return { bookingId: booking.id, assigneeUserId: input.assigneeUserId };

    const stamp = now();
    db.update(bookings)
      .set({ assignedUserId: input.assigneeUserId, version: booking.version + 1, updatedAt: stamp })
      .where(eq(bookings.id, booking.id))
      .run();
    event(
      db,
      booking.id,
      "booking_assignee_changed",
      booking.status,
      booking.status,
      input.actorUserId,
      activeAssigneeId ? "Sachbearbeiter geändert" : "Sachbearbeiter zugewiesen",
      {
        previousAssigneeUserId: activeAssigneeId,
        assigneeUserId: input.assigneeUserId,
      },
    );
    return { bookingId: booking.id, assigneeUserId: input.assigneeUserId };
  });
}

export function createOrderNumberWithoutChangingFormat(insert: (orderNumber: string) => void, start = now()) {
  // Imported mail archives can contain many bookings created in a short
  // period. Two minutes is too small for the timestamp-based legacy format.
  // Keep the format stable, but search a full week before giving up.
  const MAX_SECONDS_TO_PROBE = 7 * 24 * 60 * 60;
  for (let second = 0; second < MAX_SECONDS_TO_PROBE; second += 1) {
    const orderNumber = createOrderNumber(new Date(start.getTime() + second * 1_000));
    try {
      insert(orderNumber);
      return orderNumber;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("bookings_order_number_unique") && !message.includes("bookings.order_number")) throw error;
    }
  }
  throw new BookingCommandError(
    "Es konnte keine freie Auftragsnummer erzeugt werden. Prüfe die Auftragsnummern und versuche es erneut.",
  );
}

export type CreateBookingCommand = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  location: string;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  customerMessage: string;
  communicationLocale: "de" | "en";
  source: "web" | "manual" | "legacy";
  quotedTotalCents: number;
  requestedItems: BookingRequestedItemCommand[];
  submissionId?: string | null;
  legacySourceId?: string | null;
  legacyDedupeKey?: string | null;
  legacyReceivedAt?: Date | null;
  assignedUserId?: string | null;
  outbox?: { recipient: string; subject: string; plainText: string | ((orderNumber: string) => string); kind: string };
};

function createBookingRecord(db: AppDatabase, input: CreateBookingCommand, actorUserId?: string | null) {
  if (
    !isValidIsoDate(input.periodFrom) ||
    !isValidIsoDate(input.periodTo) ||
    input.periodFrom > input.periodTo ||
    !isValidTime(input.pickupTime) ||
    !isValidTime(input.dropoffTime)
  )
    throw new BookingCommandError("Zeitraum und Uhrzeiten sind ungültig");
  if (input.submissionId) {
    const existing = db
      .select({ id: bookings.id, orderNumber: bookings.orderNumber })
      .from(bookings)
      .where(eq(bookings.submissionId, input.submissionId))
      .get();
    if (existing) return existing;
  }
  const { legacyReceivedAt } = input;
  const createdAt = input.source === "legacy" ? (legacyReceivedAt ?? now()) : now();
  let bookingId = 0;
  const { requestedItems, outbox, legacyReceivedAt: _legacyReceivedAt, ...bookingValues } = input;
  void _legacyReceivedAt;
  const publicLinkToken = bookingValues.source === "web" ? randomBytes(32).toString("hex") : null;
  const orderNumber = createOrderNumberWithoutChangingFormat(
    (candidate) => {
      const created = db
        .insert(bookings)
        .values({
          ...bookingValues,
          orderNumber: candidate,
          status: bookingValues.source === "legacy" ? "rejected" : "inquiry_received",
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: bookings.id })
        .get();
      bookingId = created.id;
    },
    input.source === "legacy" ? (legacyReceivedAt ?? createdAt) : createdAt,
  );
  db.insert(bookingRequestedItems)
    .values(
      requestedItems.map((item, position) => ({
        bookingId,
        position: position + 1,
        requestedLabel: item.requestedLabel,
        heightCm: item.heightCm,
        needsPedals: item.needsPedals ?? false,
        pedalType: item.needsPedals ? normalizePedalType(item.pedalType) : null,
        needsComputerMount: item.needsComputerMount ?? false,
        computerMountType: item.needsComputerMount ? normalizeComputerMountType(item.computerMountType) : null,
        needsHelmet: item.needsHelmet ?? false,
        needsClothing: item.needsClothing ?? false,
        needsBikepackingBag: item.needsBikepackingBag ?? false,
        needsGlasses: item.needsGlasses ?? false,
        bottleHolderIncluded: item.bottleHolderIncluded ?? true,
        repairKitIncluded: item.repairKitIncluded ?? true,
        insuranceProtectionSelected: item.insuranceProtectionSelected ?? true,
      })),
    )
    .run();
  if (publicLinkToken) {
    db.insert(bookingPublicLinks)
      .values({
        bookingId,
        tokenHash: createHash("sha256").update(publicLinkToken).digest("hex"),
        createdAt,
      })
      .run();
  }
  if (outbox)
    db.insert(mailOutbox)
      .values({
        bookingId,
        idempotencyKey: `inquiry:${orderNumber}`,
        kind: outbox.kind,
        locale: bookingValues.communicationLocale,
        recipient: outbox.recipient,
        subject: outbox.subject.replaceAll("{{orderNumber}}", orderNumber),
        plainText:
          typeof outbox.plainText === "function"
            ? outbox.plainText(orderNumber)
            : outbox.plainText.replaceAll("{{orderNumber}}", orderNumber),
        status: "queued",
        attempts: 0,
        nextAttemptAt: createdAt,
        createdAt,
      })
      .run();
  if (bookingValues.source === "web") {
    const internalCopyAddress = process.env.MAIL_REQUEST_TO_ADDRESS?.trim() || "hallo@munich-bike-rental.de";
    const requested = db
      .select()
      .from(bookingRequestedItems)
      .where(eq(bookingRequestedItems.bookingId, bookingId))
      .all();
    const customerNotice = renderInquiryReceivedMail({
      locale: bookingValues.communicationLocale,
      name: bookingValues.customerName,
      email: bookingValues.customerEmail,
      phone: bookingValues.customerPhone,
      orderNumber,
      location: bookingValues.location,
      periodFrom: bookingValues.periodFrom,
      periodTo: bookingValues.periodTo,
      pickupTime: bookingValues.pickupTime,
      dropoffTime: bookingValues.dropoffTime,
      customerMessage: bookingValues.customerMessage,
      totalCents: bookingValues.quotedTotalCents,
      requested: requested.map((item) => ({
        requestedLabel: item.requestedLabel,
        heightCm: item.heightCm,
        accessories: {
          needsPedals: item.needsPedals,
          pedalType: item.pedalType,
          needsComputerMount: item.needsComputerMount,
          computerMountType: item.computerMountType,
          needsHelmet: item.needsHelmet,
          needsClothing: item.needsClothing,
          needsBikepackingBag: item.needsBikepackingBag,
          needsGlasses: item.needsGlasses,
          bottleHolderIncluded: item.bottleHolderIncluded,
          repairKitIncluded: item.repairKitIncluded,
        },
      })),
      publicLinkToken: publicLinkToken!,
    });
    db.insert(mailOutbox)
      .values({
        bookingId,
        idempotencyKey: `inquiry:${orderNumber}:customer_confirmation`,
        kind: "inquiry_received",
        locale: bookingValues.communicationLocale,
        recipient: [bookingValues.customerEmail, internalCopyAddress].join(", "),
        subject: customerNotice.subject,
        plainText: customerNotice.text,
        html: customerNotice.html,
        status: "queued",
        attempts: 0,
        nextAttemptAt: createdAt,
        createdAt,
      })
      .run();
  }
  event(db, bookingId, "booking_created", null, "inquiry_received", actorUserId, "", { source: bookingValues.source });
  return { id: bookingId, orderNumber };
}

export function createBooking(db: AppDatabase, input: CreateBookingCommand, actorUserId?: string | null) {
  return runInImmediateTransaction(db, () => createBookingRecord(db, input, actorUserId));
}

/** Creates a booking inside a caller-owned transaction (used by idempotent imports). */
export function createBookingInTransaction(db: AppDatabase, input: CreateBookingCommand, actorUserId?: string | null) {
  return createBookingRecord(db, input, actorUserId);
}

/** Creates a completed historical booking, including its asset allocation and accounting entry. */
export function createHistoricalBooking(
  db: AppDatabase,
  input: Omit<CreateBookingCommand, "outbox" | "source"> & {
    assetsByPosition: Record<number, number>;
    actorUserId: string;
    reason?: string;
  },
) {
  return runInImmediateTransaction(db, () => {
    const invoiceNumber = allocateInvoiceNumber(db);
    const created = createBookingRecord(
      db,
      { ...input, source: "legacy", assignedUserId: input.actorUserId },
      input.actorUserId,
    );
    const requested = db
      .select()
      .from(bookingRequestedItems)
      .where(eq(bookingRequestedItems.bookingId, created.id))
      .all();
    const assetsByRequestedItem = Object.fromEntries(
      requested.map((item) => [item.id, input.assetsByPosition[item.position]]),
    ) as Record<number, number>;
    if (Object.values(assetsByRequestedItem).some((assetId) => !Number.isInteger(assetId) || assetId <= 0))
      throw new BookingCommandError("Für jedes Fahrrad muss ein konkretes Fahrrad ausgewählt werden");
    setHistoricalBookingStatusInTransaction(db, {
      bookingId: created.id,
      status: "completed",
      actorUserId: input.actorUserId,
      reason: input.reason,
      details: {
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        pickupTime: input.pickupTime,
        dropoffTime: input.dropoffTime,
        quotedTotalCents: input.quotedTotalCents,
        assetsByRequestedItem,
        invoiceNumber,
        reason: input.reason,
      },
    });
    return created;
  });
}

/** Manual direct bookings are allocated, journaled, and confirmed in one SQLite transaction. */
export function createDirectBooking(
  db: AppDatabase,
  input: Omit<CreateBookingCommand, "outbox"> & { assetsByPosition: Record<number, number>; actorUserId: string },
) {
  return runInImmediateTransaction(db, () => {
    const created = createBookingRecord(db, { ...input, assignedUserId: input.actorUserId }, input.actorUserId);
    const booking = db.select().from(bookings).where(eq(bookings.id, created.id)).get()!;
    const requested = db
      .select()
      .from(bookingRequestedItems)
      .where(eq(bookingRequestedItems.bookingId, created.id))
      .all();
    if (
      requested.some(
        (item) =>
          !Number.isInteger(input.assetsByPosition[item.position]) || input.assetsByPosition[item.position] <= 0,
      )
    )
      throw new BookingCommandError(
        "Für jedes angefragte Fahrrad musst du ein konkretes verfügbares Fahrrad auswählen.",
      );
    const assetsByRequestedItem = Object.fromEntries(
      requested.map((item) => [item.id, input.assetsByPosition[item.position]!]),
    ) as Record<number, number>;
    const quote = buildOfferQuote(db, booking.id, assetsByRequestedItem);
    for (const item of quote.offeredItems) {
      if (hasAssetConflict(db, booking, item.assetId))
        throw new BookingCommandError(
          "Das ausgewählte Fahrrad ist im gewählten Zeitraum bereits vergeben. Wähle ein anderes Fahrrad oder ändere den Zeitraum.",
        );
    }
    const stamp = now();
    const directOffer = db
      .insert(bookingOffers)
      .values({
        bookingId: booking.id,
        offerNumber: 1,
        tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
        status: "accepted",
        totalCents: quote.totalCents,
        priceSnapshotJson: JSON.stringify(quote),
        expiresAt: stamp,
        acceptedAt: stamp,
        createdBy: input.actorUserId,
        createdAt: stamp,
      })
      .returning({ id: bookingOffers.id })
      .get();
    db.insert(bookingOfferItems)
      .values(
        quote.offeredItems.map((item) => ({
          offerId: directOffer.id,
          requestedItemId: item.requestedItemId,
          assetId: item.assetId,
          itemPriceCents: item.weekdayPriceCents,
        })),
      )
      .run();
    db.insert(bookingAssetAllocations)
      .values(
        quote.offeredItems.map((item) => ({
          bookingId: booking.id,
          offerId: directOffer.id,
          assetId: item.assetId,
          periodFrom: booking.periodFrom,
          periodTo: booking.periodTo,
          pickupTime: booking.pickupTime,
          dropoffTime: booking.dropoffTime,
          createdAt: stamp,
        })),
      )
      .run();
    allocateRequestedAccessories(db, booking);
    db.update(bookings)
      .set({ status: "confirmed", quotedTotalCents: quote.totalCents, version: booking.version + 1, updatedAt: stamp })
      .where(eq(bookings.id, booking.id))
      .run();
    event(
      db,
      booking.id,
      "booking_directly_confirmed",
      "inquiry_received",
      "confirmed",
      input.actorUserId,
      "Direkt verbindlich gebucht",
      { offerId: directOffer.id, quote },
    );
    appendJournalEntry(db, {
      bookingId: booking.id,
      kind: "rental_charge",
      actorUserId: input.actorUserId,
      reason: "Gesamtbetrag für manuell verbindliche Buchung",
      lines: [
        { account: "accounts_receivable", amountCents: confirmedBookingChargeCents(quote.totalCents) },
        { account: "rental_revenue", amountCents: -confirmedBookingChargeCents(quote.totalCents) },
      ],
    });
    const notice = renderBookingNotice({
      kind: "confirmed",
      locale: booking.communicationLocale,
      name: booking.customerName,
      orderNumber: booking.orderNumber,
      contactPhone: getBookingContactPhone(db, booking),
      bikes: quote.offeredItems.map((item) => ({ name: item.assetName, frameNumber: item.frameNumber })),
    });
    db.insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: `booking:${booking.id}:booking_confirmed`,
        kind: "booking_confirmed",
        locale: booking.communicationLocale,
        recipient: booking.customerEmail,
        subject: notice.subject,
        plainText: notice.text,
        html: notice.html,
        status: "queued",
        attempts: 0,
        nextAttemptAt: stamp,
        createdAt: stamp,
      })
      .run();
    return { ...created, alreadyConfirmed: false };
  });
}
