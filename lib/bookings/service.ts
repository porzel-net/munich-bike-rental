import { createHash, randomBytes, randomUUID } from "node:crypto";

import { and, eq, inArray, ne, sql } from "drizzle-orm";

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
  financialAccounts,
  financialCategories,
  financialTransactionAllocations,
  financialTransactions,
  journalEntries,
  journalLines,
  mailOutbox,
  rentalAssets,
  rentalInquiries,
  type BookingStatus,
} from "../db/schema";
import { createOrderNumber } from "../inquiries/server";
import { getComputerMountTypeLabel, getPedalTypeLabel } from "../inquiries/catalog";
import { bikeMatchesRequestedLabel } from "../inventory/display-name";

import { BookingCommandError } from "./errors";
import { allocateRequestedAccessories, hasAssetConflict } from "./availability";
import { isAssetSelectableForBooking } from "./historical-availability";
import { appendJournalEntry, getReceivableStatus } from "./ledger";
import { confirmedBookingChargeCents, formatEuro } from "./money";
import {
  renderBookingInformationChangedMail,
  renderBookingNotice,
  renderFeedbackRequestMail,
  renderInquiryReceivedMail,
  renderOfferMail,
} from "./messages";
import { applyCustomOfferPrice, buildOfferQuote, type OfferAccessorySelection } from "./quotes";
import { allocateInvoiceNumber, invoiceNumberPattern } from "./invoice-number";
import { isValidIsoDate, isValidTime } from "./validation";

export { BookingCommandError } from "./errors";

/**
 * Permanently removes a booking only when it has no accounting or operational history.
 * This is intentionally stricter than a normal cancellation: financial evidence must remain
 * immutable and an allocated or completed rental must never disappear silently.
 */
export function deleteBookingPermanently(db: AppDatabase, bookingId: number) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
    if (!booking) throw new BookingCommandError("Buchung nicht gefunden.");
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
    if (booking.legacyInquiryId)
      db.delete(rentalInquiries).where(eq(rentalInquiries.id, booking.legacyInquiryId)).run();
  });
}

const transitions: Record<BookingStatus, readonly BookingStatus[]> = {
  inquiry_received: ["offer_sent", "rejected"],
  offer_sent: ["confirmed", "expired", "cancelled"],
  confirmed: ["checked_out", "cancelled"],
  checked_out: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
  expired: ["offer_sent"],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  return transitions[from].includes(to);
}

function assertTransition(from: BookingStatus, to: BookingStatus) {
  if (!canTransition(from, to)) throw new BookingCommandError(`Transition ${from} → ${to} is not allowed`);
}

function now() {
  return new Date();
}

function assertBookingHasAssignee(db: AppDatabase, booking: typeof bookings.$inferSelect) {
  if (
    !booking.assignedUserId ||
    !db.select({ id: authUser.id }).from(authUser).where(eq(authUser.id, booking.assignedUserId)).get()
  )
    throw new BookingCommandError("Für diese Buchung muss zuerst ein Sachbearbeiter eingetragen werden");
}

function getBookingAssignee(db: AppDatabase, booking: typeof bookings.$inferSelect) {
  return booking.assignedUserId
    ? (db
        .select({ privateAddress: authUser.privateAddress, whatsappPhone: authUser.whatsappPhone })
        .from(authUser)
        .where(eq(authUser.id, booking.assignedUserId))
        .get() ?? undefined)
    : undefined;
}

function getBookingPickupAddress(db: AppDatabase, booking: typeof bookings.$inferSelect) {
  return getBookingAssignee(db, booking)?.privateAddress ?? undefined;
}

function getBookingContactPhone(db: AppDatabase, booking: typeof bookings.$inferSelect) {
  return getBookingAssignee(db, booking)?.whatsappPhone?.trim() || undefined;
}

function receivedPaymentCents(db: AppDatabase, bookingId: number) {
  return db
    .select({ amountCents: journalLines.amountCents })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.bookingId, bookingId),
        inArray(journalEntries.kind, ["payment_received", "refund_issued"]),
        ne(journalLines.account, "accounts_receivable"),
      ),
    )
    .all()
    .reduce((sum, line) => sum + line.amountCents, 0);
}

function firstName(name: string | undefined) {
  return name?.trim().split(/\s+/).filter(Boolean)[0] ?? "Your Bike Rental";
}

function queueCustomerMail(
  db: AppDatabase,
  booking: typeof bookings.$inferSelect,
  input: {
    kind: string;
    subjectDe: string;
    subjectEn: string;
    textDe: string;
    textEn: string;
    html?: string;
    idempotencyKey?: string;
  },
) {
  const locale = booking.communicationLocale;
  return (
    db
      .insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: input.idempotencyKey ?? `booking:${booking.id}:${input.kind}`,
        kind: input.kind,
        locale,
        recipient: booking.customerEmail,
        subject: locale === "de" ? input.subjectDe : input.subjectEn,
        plainText: locale === "de" ? input.textDe : input.textEn,
        html: input.html ?? null,
        status: "queued",
        attempts: 0,
        nextAttemptAt: now(),
        createdAt: now(),
      })
      .onConflictDoNothing()
      .returning({ id: mailOutbox.id })
      .get()?.id ?? null
  );
}

function event(
  db: AppDatabase,
  bookingId: number,
  type: string,
  fromStatus: BookingStatus | null,
  toStatus: BookingStatus | null,
  actorUserId?: string | null,
  reason = "",
  payload: unknown = {},
) {
  db.insert(bookingEvents)
    .values({
      bookingId,
      eventType: type,
      fromStatus,
      toStatus,
      actorUserId: actorUserId ?? null,
      reason,
      payloadJson: JSON.stringify(payload),
      occurredAt: now(),
    })
    .run();
}

function transition(
  db: AppDatabase,
  booking: typeof bookings.$inferSelect,
  target: BookingStatus,
  type: string,
  actorUserId?: string | null,
  reason = "",
  payload: unknown = {},
) {
  assertTransition(booking.status, target);
  db.update(bookings)
    .set({ status: target, version: booking.version + 1, updatedAt: now() })
    .where(eq(bookings.id, booking.id))
    .run();
  event(db, booking.id, type, booking.status, target, actorUserId, reason, payload);
}

export type LegacyStatusDetails = {
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  quotedTotalCents: number;
  assetsByRequestedItem: Record<number, number>;
  invoiceNumber?: string;
  reason?: string;
};

const legacyStatusesRequiringBookingDetails = new Set<BookingStatus>([
  "offer_sent",
  "confirmed",
  "checked_out",
  "completed",
]);
const legacyStatusesRequiringAssets = new Set<BookingStatus>(["offer_sent", "confirmed", "checked_out", "completed"]);
const legacyStatusesRequiringInvoice = new Set<BookingStatus>(["confirmed", "checked_out", "completed"]);

/** Imported historical records can be moved between states, but each state must have coherent data. */
export function setLegacyBookingStatus(
  db: AppDatabase,
  input: {
    bookingId: number;
    status: BookingStatus;
    details?: LegacyStatusDetails;
    reason?: string;
    actorUserId?: string | null;
  },
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking) throw new BookingCommandError("Booking not found");
    if (booking.source !== "legacy")
      throw new BookingCommandError("Der Status kann hier nur bei importierten Buchungen frei geändert werden");
    if (booking.status === input.status && !input.details) return booking;

    const requiresDetails = legacyStatusesRequiringBookingDetails.has(input.status);
    const requiresAssets = legacyStatusesRequiringAssets.has(input.status);
    const requiresInvoice = legacyStatusesRequiringInvoice.has(input.status);
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

    if (requiresInvoice) {
      const invoiceNumber = details?.invoiceNumber?.trim() ?? "";
      if (!invoiceNumberPattern.test(invoiceNumber))
        throw new BookingCommandError("Die Rechnungsnummer muss dem Format YBR-JJJJ-NNNN entsprechen");
      if (booking.invoiceNumber) {
        if (invoiceNumber !== booking.invoiceNumber)
          throw new BookingCommandError("Die bereits vergebene Rechnungsnummer darf nicht geändert werden");
      } else {
        let expectedInvoiceNumber: string;
        try {
          expectedInvoiceNumber = allocateInvoiceNumber(db, stamp);
        } catch (error) {
          throw new BookingCommandError(error instanceof Error ? error.message : "Rechnungsnummern sind ungültig");
        }
        if (invoiceNumber !== expectedInvoiceNumber)
          throw new BookingCommandError(`Die nächste zulässige Rechnungsnummer ist ${expectedInvoiceNumber}`);
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
            !isAssetSelectableForBooking(booking, {
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
              invoiceNumber: details.invoiceNumber!.trim(),
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
            itemPriceCents: item.dailyPriceCents,
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

    // Imported bookings have no historical offer/payment journal entries. Once
    // they become binding, create the receivable so "settled" does not mean
    // "no accounting data exists". The idempotency key prevents duplicates
    // when the booking later moves from confirmed to completed.
    if (["confirmed", "checked_out", "completed"].includes(input.status) && details && details.quotedTotalCents > 0) {
      appendJournalEntry(db, {
        bookingId: booking.id,
        kind: "rental_charge",
        actorUserId: input.actorUserId,
        idempotencyKey: `legacy_booking_charge:${booking.id}`,
        reason: "Offener Mietpreis der importierten Buchung",
        lines: [
          { account: "accounts_receivable", amountCents: details.quotedTotalCents },
          { account: "rental_revenue", amountCents: -details.quotedTotalCents },
        ],
      });
    }

    event(
      db,
      booking.id,
      "legacy_booking_status_changed",
      booking.status,
      input.status,
      input.actorUserId,
      "Status der importierten Buchung manuell geändert",
      {
        reason: details?.reason ?? input.reason ?? "",
        requiresBookingDetails: requiresDetails,
        invoiceNumber: requiresInvoice
          ? (details?.invoiceNumber?.trim() ?? booking.invoiceNumber)
          : booking.invoiceNumber,
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
            invoiceNumber: details.invoiceNumber!.trim(),
            invoiceIssuedAt: booking.invoiceNumber ? booking.invoiceIssuedAt : stamp,
          }
        : {}),
      version: booking.version + 1,
    };
  });
}

export function assignBooking(
  db: AppDatabase,
  input: { bookingId: number; assigneeUserId: string; actorUserId?: string | null },
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking) throw new BookingCommandError("Booking not found");
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
    if (!assignee) throw new BookingCommandError("Sachbearbeiter not found");
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
  throw new BookingCommandError("No free order number was available in the next seven days");
}

export type BookingRequestedItemCommand = {
  requestedLabel: string;
  heightCm: number;
  needsPedals?: boolean;
  pedalType?: string | null;
  needsComputerMount?: boolean;
  computerMountType?: string | null;
  needsHelmet?: boolean;
  needsClothing?: boolean;
  needsBikepackingBag?: boolean;
  needsGlasses?: boolean;
  bottleHolderIncluded?: boolean;
  repairKitIncluded?: boolean;
};

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
        pedalType: item.pedalType ?? null,
        needsComputerMount: item.needsComputerMount ?? false,
        computerMountType: item.computerMountType ?? null,
        needsHelmet: item.needsHelmet ?? false,
        needsClothing: item.needsClothing ?? false,
        needsBikepackingBag: item.needsBikepackingBag ?? false,
        needsGlasses: item.needsGlasses ?? false,
        bottleHolderIncluded: item.bottleHolderIncluded ?? true,
        repairKitIncluded: item.repairKitIncluded ?? true,
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
      throw new BookingCommandError("A concrete asset is required for every requested bike");
    const assetsByRequestedItem = Object.fromEntries(
      requested.map((item) => [item.id, input.assetsByPosition[item.position]!]),
    ) as Record<number, number>;
    const quote = buildOfferQuote(db, booking.id, assetsByRequestedItem);
    for (const item of quote.offeredItems) {
      if (hasAssetConflict(db, booking, item.assetId))
        throw new BookingCommandError("The selected asset is already booked for this period");
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
          itemPriceCents: item.dailyPriceCents,
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
      reason: "Anzahlung (50 %) für verbindliche Buchung",
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

export function createOffer(
  db: AppDatabase,
  input: {
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
    sendMail?: boolean;
  },
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking) throw new BookingCommandError("Booking not found");
    assertBookingHasAssignee(db, booking);
    if (booking.status !== "inquiry_received" && booking.status !== "offer_sent" && booking.status !== "expired")
      throw new BookingCommandError("An offer can only be made for an inquiry or replaced offer");
    const quote = applyCustomOfferPrice(
      buildOfferQuote(db, booking.id, input.assetsByRequestedItem, input.accessoriesByRequestedItem, input.isStudent),
      input.customTotalCents,
    );
    const alternative =
      Boolean(input.alternative) ||
      quote.offeredItems.some((item) => {
        const asset = db
          .select({ modelTitle: bikeModels.title, size: bikeVariants.size })
          .from(rentalAssets)
          .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
          .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
          .where(eq(rentalAssets.id, item.assetId))
          .get();
        return !asset || !bikeMatchesRequestedLabel(asset, item.requestedLabel);
      });
    if (alternative && !input.alternativeReason?.trim())
      throw new BookingCommandError("Für ein alternatives Fahrrad muss ein Änderungsgrund angegeben werden");
    for (const item of quote.offeredItems) {
      if (hasAssetConflict(db, booking, item.assetId))
        throw new BookingCommandError("The selected asset is already booked for this period");
    }
    const previous = db
      .select()
      .from(bookingOffers)
      .where(and(eq(bookingOffers.bookingId, booking.id), eq(bookingOffers.status, "sent")))
      .all();
    for (const offer of previous)
      db.update(bookingOffers).set({ status: "revoked", revokedAt: now() }).where(eq(bookingOffers.id, offer.id)).run();
    const number =
      (db
        .select({ number: sql<number>`coalesce(max(${bookingOffers.offerNumber}), 0)` })
        .from(bookingOffers)
        .where(eq(bookingOffers.bookingId, booking.id))
        .get()?.number ?? 0) + 1;
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 36 * 60 * 60 * 1_000);
    const offer = db
      .insert(bookingOffers)
      .values({
        bookingId: booking.id,
        offerNumber: number,
        tokenHash,
        totalCents: quote.totalCents,
        priceSnapshotJson: JSON.stringify(quote),
        expiresAt,
        createdBy: input.actorUserId ?? null,
        createdAt: now(),
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
      .set({ quotedTotalCents: quote.totalCents, version: booking.version + 1, updatedAt: now() })
      .where(eq(bookings.id, booking.id))
      .run();
    const content = renderOfferMail({
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
      periodFrom: booking.periodFrom,
      periodTo: booking.periodTo,
      pickupTime: booking.pickupTime,
      dropoffTime: booking.dropoffTime,
      location: booking.location,
      pickupAddress: getBookingPickupAddress(db, booking),
      token,
      senderFirstName: firstName(
        input.actorUserId
          ? db.select({ name: authUser.name }).from(authUser).where(eq(authUser.id, input.actorUserId)).get()?.name
          : undefined,
      ),
    });
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
          nextAttemptAt: now(),
          createdAt: now(),
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

/** Revokes the currently published offer without sending another customer email. */
export function revokeOffer(
  db: AppDatabase,
  input: { bookingId: number; actorUserId?: string | null; reason?: string },
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking) throw new BookingCommandError("Booking not found");
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

/** Side-effect-free admin preview. The supplied assets are checked again by the sending command. */
export function previewOffer(
  db: AppDatabase,
  input: {
    bookingId: number;
    assetsByRequestedItem: Record<number, number>;
    accessoriesByRequestedItem?: Record<number, OfferAccessorySelection>;
    isStudent?: boolean;
    alternative?: boolean;
    alternativeReason?: string;
    personalMessage?: string;
    customTotalCents?: number;
    actorUserId?: string | null;
  },
) {
  const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
  if (
    !booking ||
    (booking.status !== "inquiry_received" && booking.status !== "offer_sent" && booking.status !== "expired")
  )
    throw new BookingCommandError("An offer can only be made for an inquiry or replaced offer");
  assertBookingHasAssignee(db, booking);
  const quote = applyCustomOfferPrice(
    buildOfferQuote(db, booking.id, input.assetsByRequestedItem, input.accessoriesByRequestedItem, input.isStudent),
    input.customTotalCents,
  );
  const alternative =
    Boolean(input.alternative) ||
    quote.offeredItems.some((item) => {
      const asset = db
        .select({ modelTitle: bikeModels.title, size: bikeVariants.size })
        .from(rentalAssets)
        .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
        .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
        .where(eq(rentalAssets.id, item.assetId))
        .get();
      return !asset || !bikeMatchesRequestedLabel(asset, item.requestedLabel);
    });
  if (alternative && !input.alternativeReason?.trim())
    throw new BookingCommandError("Für ein alternatives Fahrrad muss ein Änderungsgrund angegeben werden");
  const mail = renderOfferMail({
    locale: booking.communicationLocale,
    alternative,
    alternativeReason: input.alternativeReason?.trim(),
    personalMessage: input.personalMessage?.trim(),
    name: booking.customerName,
    email: booking.customerEmail,
    phone: booking.customerPhone,
    customerMessage: booking.customerMessage,
    orderNumber: booking.orderNumber,
    requested: quote.offeredItems,
    totalCents: quote.totalCents,
    calculatedTotalCents: quote.calculatedTotalCents,
    periodFrom: booking.periodFrom,
    periodTo: booking.periodTo,
    pickupTime: booking.pickupTime,
    dropoffTime: booking.dropoffTime,
    location: booking.location,
    pickupAddress: getBookingPickupAddress(db, booking),
    token: "VORSCHAU",
    senderFirstName: firstName(
      input.actorUserId
        ? db.select({ name: authUser.name }).from(authUser).where(eq(authUser.id, input.actorUserId)).get()?.name
        : undefined,
    ),
  });
  return { quote, mail };
}

export type UpdateBookingCommand = {
  bookingId: number;
  expectedVersion: number;
  actorUserId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  customerMessage: string;
  communicationLocale: "de" | "en";
  requestedItems: Array<BookingRequestedItemCommand & { id: number }>;
  quotedTotalCents?: number;
  notifyCustomer?: boolean;
};

/** Updates editable booking details while keeping offers, allocations and the event history consistent. */
export function updateBooking(db: AppDatabase, input: UpdateBookingCommand) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking) throw new BookingCommandError("Booking not found");
    if (input.notifyCustomer && booking.status !== "confirmed")
      throw new BookingCommandError("Eine Änderungsmail kann nur für verbindlich gebuchte Buchungen versendet werden");
    if (booking.version !== input.expectedVersion)
      throw new BookingCommandError("Die Buchung wurde zwischenzeitlich geändert. Bitte lade sie neu.");
    const importedPriceEditingAllowed =
      booking.source === "legacy" && ["confirmed", "completed"].includes(booking.status);
    if (input.quotedTotalCents !== undefined && !importedPriceEditingAllowed)
      throw new BookingCommandError("Der Mietbetrag kann hier nur bei importierten Buchungen geändert werden");
    if (
      input.quotedTotalCents !== undefined &&
      (!Number.isSafeInteger(input.quotedTotalCents) || input.quotedTotalCents < 0)
    )
      throw new BookingCommandError("Der Mietbetrag ist ungültig");
    if (["completed", "rejected", "cancelled", "expired"].includes(booking.status) && !importedPriceEditingAllowed)
      throw new BookingCommandError("Eine abgeschlossene Buchung kann nicht mehr bearbeitet werden");
    if (
      !isValidIsoDate(input.periodFrom) ||
      !isValidIsoDate(input.periodTo) ||
      input.periodFrom > input.periodTo ||
      !isValidTime(input.pickupTime) ||
      !isValidTime(input.dropoffTime)
    )
      throw new BookingCommandError("Zeitraum und Uhrzeiten sind ungültig");

    const currentItems = db
      .select()
      .from(bookingRequestedItems)
      .where(eq(bookingRequestedItems.bookingId, booking.id))
      .all();
    const currentIds = new Set(currentItems.map((item) => item.id));
    if (
      input.requestedItems.length !== currentItems.length ||
      input.requestedItems.some((item) => !currentIds.has(item.id))
    )
      throw new BookingCommandError("Die Anzahl der Fahrräder kann hier nicht geändert werden");

    const bikeDetailsChanged = currentItems.some((current) => {
      const next = input.requestedItems.find((item) => item.id === current.id);
      return (
        !next ||
        current.requestedLabel !== next.requestedLabel ||
        current.heightCm !== next.heightCm ||
        current.needsPedals !== Boolean(next.needsPedals) ||
        current.pedalType !== (next.needsPedals ? (next.pedalType ?? null) : null) ||
        current.needsComputerMount !== Boolean(next.needsComputerMount) ||
        current.computerMountType !== (next.needsComputerMount ? (next.computerMountType ?? null) : null) ||
        current.needsHelmet !== Boolean(next.needsHelmet) ||
        current.needsClothing !== Boolean(next.needsClothing) ||
        current.needsBikepackingBag !== Boolean(next.needsBikepackingBag) ||
        current.needsGlasses !== Boolean(next.needsGlasses) ||
        current.bottleHolderIncluded !== (next.bottleHolderIncluded ?? true) ||
        current.repairKitIncluded !== (next.repairKitIncluded ?? true)
      );
    });
    const commercialChanged =
      booking.periodFrom !== input.periodFrom ||
      booking.periodTo !== input.periodTo ||
      booking.pickupTime !== input.pickupTime ||
      booking.dropoffTime !== input.dropoffTime ||
      bikeDetailsChanged;
    const quotedTotalChanged =
      input.quotedTotalCents !== undefined && input.quotedTotalCents !== booking.quotedTotalCents;
    if (commercialChanged && !["inquiry_received", "offer_sent"].includes(booking.status) && !input.notifyCustomer)
      throw new BookingCommandError(
        "Fahrrad- und Zeitraumdaten können nach der Bestätigung nicht mehr geändert werden",
      );
    const offerNeedsRevocation =
      booking.status === "offer_sent" &&
      (commercialChanged ||
        booking.customerName !== input.customerName ||
        booking.customerEmail !== input.customerEmail ||
        booking.communicationLocale !== input.communicationLocale);

    const stamp = now();
    const mailChanges: Array<{
      labelDe: string;
      labelEn: string;
      previous: string;
      current: string;
    }> = [];
    const addMailChange = (labelDe: string, labelEn: string, previous: string, current: string) => {
      if (previous !== current) mailChanges.push({ labelDe, labelEn, previous, current });
    };
    addMailChange("Name", "Name", booking.customerName, input.customerName);
    addMailChange("E-Mail", "Email", booking.customerEmail, input.customerEmail);
    addMailChange("Telefon", "Phone", booking.customerPhone, input.customerPhone);
    if (quotedTotalChanged)
      addMailChange(
        "Mietbetrag",
        "Rental amount",
        formatEuro(booking.quotedTotalCents),
        formatEuro(input.quotedTotalCents!),
      );
    addMailChange("Abholdatum", "Pickup date", booking.periodFrom, input.periodFrom);
    addMailChange("Rückgabedatum", "Return date", booking.periodTo, input.periodTo);
    addMailChange("Abholzeit", "Pickup time", booking.pickupTime, input.pickupTime);
    addMailChange("Rückgabezeit", "Return time", booking.dropoffTime, input.dropoffTime);
    addMailChange(
      "Kommunikationssprache",
      "Communication language",
      booking.communicationLocale === "de" ? "Deutsch" : "English",
      input.communicationLocale === "de" ? "Deutsch" : "English",
    );
    const formatRequestedItem = (item: BookingRequestedItemCommand) =>
      `${item.requestedLabel} (${item.heightCm} cm${item.needsHelmet ? ", Helm" : ""}${item.needsClothing ? ", Kleidung" : ""}${item.needsPedals ? `, Pedale${item.pedalType ? `: ${getPedalTypeLabel(item.pedalType, "de")}` : ""}` : ""}${item.needsComputerMount ? `, Computerhalterung${item.computerMountType ? `: ${getComputerMountTypeLabel(item.computerMountType, "de")}` : ""}` : ""}${item.needsBikepackingBag ? ", Bikepackingtasche" : ""}${item.needsGlasses ? ", Rennradbrille" : ""})`;
    const currentItemsSummary = currentItems.map(formatRequestedItem).join(", ");
    const nextItemsSummary = input.requestedItems.map(formatRequestedItem).join(", ");
    addMailChange("Fahrräder und Ausstattung", "Bikes and equipment", currentItemsSummary, nextItemsSummary);
    const confirmedPeriodChanged =
      booking.status === "confirmed" &&
      input.notifyCustomer === true &&
      (booking.periodFrom !== input.periodFrom ||
        booking.periodTo !== input.periodTo ||
        booking.pickupTime !== input.pickupTime ||
        booking.dropoffTime !== input.dropoffTime);
    const changedFields = [
      ...(booking.customerName !== input.customerName ? ["customerName"] : []),
      ...(booking.customerEmail !== input.customerEmail ? ["customerEmail"] : []),
      ...(booking.customerPhone !== input.customerPhone ? ["customerPhone"] : []),
      ...(booking.periodFrom !== input.periodFrom ? ["periodFrom"] : []),
      ...(booking.periodTo !== input.periodTo ? ["periodTo"] : []),
      ...(booking.pickupTime !== input.pickupTime ? ["pickupTime"] : []),
      ...(booking.dropoffTime !== input.dropoffTime ? ["dropoffTime"] : []),
      ...(booking.customerMessage !== input.customerMessage ? ["customerMessage"] : []),
      ...(booking.communicationLocale !== input.communicationLocale ? ["communicationLocale"] : []),
      ...(commercialChanged ? ["requestedItems"] : []),
      ...(quotedTotalChanged ? ["quotedTotalCents"] : []),
    ];
    let queuedMailId: number | null = null;
    if (confirmedPeriodChanged) {
      const activeAllocations = db
        .select()
        .from(bookingAssetAllocations)
        .where(
          and(eq(bookingAssetAllocations.bookingId, booking.id), sql`${bookingAssetAllocations.releasedAt} is null`),
        )
        .all();
      db.update(bookingAssetAllocations)
        .set({ releasedAt: stamp })
        .where(
          and(eq(bookingAssetAllocations.bookingId, booking.id), sql`${bookingAssetAllocations.releasedAt} is null`),
        )
        .run();
      const nextBooking = {
        ...booking,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        pickupTime: input.pickupTime,
        dropoffTime: input.dropoffTime,
      };
      if (activeAllocations.some((allocation) => hasAssetConflict(db, nextBooking, allocation.assetId)))
        throw new BookingCommandError("Das Fahrrad ist im neuen Zeitraum bereits anderweitig gebucht");
      for (const allocation of activeAllocations)
        db.update(bookingAssetAllocations)
          .set({
            periodFrom: input.periodFrom,
            periodTo: input.periodTo,
            pickupTime: input.pickupTime,
            dropoffTime: input.dropoffTime,
            releasedAt: null,
          })
          .where(eq(bookingAssetAllocations.id, allocation.id))
          .run();
      db.update(bookingAccessoryAllocations)
        .set({
          periodFrom: input.periodFrom,
          periodTo: input.periodTo,
          pickupTime: input.pickupTime,
          dropoffTime: input.dropoffTime,
        })
        .where(
          and(
            eq(bookingAccessoryAllocations.bookingId, booking.id),
            sql`${bookingAccessoryAllocations.releasedAt} is null`,
          ),
        )
        .run();
    }
    db.update(bookings)
      .set({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        pickupTime: input.pickupTime,
        dropoffTime: input.dropoffTime,
        quotedTotalCents: input.quotedTotalCents ?? booking.quotedTotalCents,
        customerMessage: input.customerMessage,
        communicationLocale: input.communicationLocale,
        version: booking.version + 1,
        updatedAt: stamp,
      })
      .where(eq(bookings.id, booking.id))
      .run();

    if (quotedTotalChanged) {
      const amountDifference = input.quotedTotalCents! - booking.quotedTotalCents;
      if (amountDifference !== 0) {
        appendJournalEntry(db, {
          bookingId: booking.id,
          kind: "rental_charge",
          actorUserId: input.actorUserId,
          idempotencyKey: "legacy_booking_price_change:" + booking.id + ":" + (booking.version + 1),
          reason: "Mietbetrag der importierten Buchung angepasst",
          lines: [
            { account: "accounts_receivable", amountCents: amountDifference },
            { account: "rental_revenue", amountCents: -amountDifference },
          ],
        });
      }

      const latestOffer = db
        .select()
        .from(bookingOffers)
        .where(eq(bookingOffers.bookingId, booking.id))
        .all()
        .sort((left, right) => right.offerNumber - left.offerNumber)[0];
      if (latestOffer) {
        let priceSnapshot: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(latestOffer.priceSnapshotJson) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            priceSnapshot = parsed as Record<string, unknown>;
        } catch {
          // Keep the snapshot valid even if an old imported record contains malformed JSON.
        }
        db.update(bookingOffers)
          .set({
            totalCents: input.quotedTotalCents!,
            priceSnapshotJson: JSON.stringify({ ...priceSnapshot, totalCents: input.quotedTotalCents }),
          })
          .where(eq(bookingOffers.id, latestOffer.id))
          .run();
      }
    }

    for (const item of input.requestedItems) {
      db.update(bookingRequestedItems)
        .set({
          requestedLabel: item.requestedLabel,
          heightCm: item.heightCm,
          needsPedals: Boolean(item.needsPedals),
          pedalType: item.needsPedals ? (item.pedalType ?? null) : null,
          needsComputerMount: Boolean(item.needsComputerMount),
          computerMountType: item.needsComputerMount ? (item.computerMountType ?? null) : null,
          needsHelmet: Boolean(item.needsHelmet),
          needsClothing: Boolean(item.needsClothing),
          needsBikepackingBag: Boolean(item.needsBikepackingBag),
          needsGlasses: Boolean(item.needsGlasses),
          bottleHolderIncluded: item.bottleHolderIncluded ?? true,
          repairKitIncluded: item.repairKitIncluded ?? true,
        })
        .where(and(eq(bookingRequestedItems.id, item.id), eq(bookingRequestedItems.bookingId, booking.id)))
        .run();
    }

    if (offerNeedsRevocation) {
      db.update(bookingOffers)
        .set({ status: "revoked", revokedAt: stamp })
        .where(and(eq(bookingOffers.bookingId, booking.id), eq(bookingOffers.status, "sent")))
        .run();
    }

    if (input.notifyCustomer && booking.status === "confirmed" && changedFields.length && mailChanges.length) {
      const notice = renderBookingInformationChangedMail({
        locale: input.communicationLocale,
        name: input.customerName,
        orderNumber: booking.orderNumber,
        location: booking.location,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        pickupTime: input.pickupTime,
        dropoffTime: input.dropoffTime,
        bikes: input.requestedItems.map((item) => item.requestedLabel),
        changes: mailChanges,
      });
      queuedMailId = queueCustomerMail(
        db,
        { ...booking, ...input },
        {
          kind: "booking_information_changed",
          idempotencyKey: `booking:${booking.id}:booking_information_changed:${booking.version + 1}`,
          subjectDe: notice.subject,
          subjectEn: notice.subject,
          textDe: notice.text,
          textEn: notice.text,
          html: notice.html,
        },
      );
    }

    event(
      db,
      booking.id,
      "booking_updated",
      booking.status,
      booking.status,
      input.actorUserId,
      "Buchungsdaten bearbeitet",
      {
        changedFields,
        revokedOffer: offerNeedsRevocation,
        customerNotified: Boolean(queuedMailId),
      },
    );
    return { bookingId: booking.id, version: booking.version + 1, mailId: queuedMailId };
  });
}

type StripeOfferPayment = {
  amountCents: number;
  sessionId: string;
};

function recognizedRentalChargeCents(db: AppDatabase, bookingId: number) {
  return db
    .select({ amountCents: journalLines.amountCents })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.bookingId, bookingId),
        eq(journalEntries.kind, "rental_charge"),
        eq(journalLines.account, "accounts_receivable"),
      ),
    )
    .all()
    .reduce((sum, line) => sum + line.amountCents, 0);
}

function confirmOfferRecord(
  db: AppDatabase,
  offer: typeof bookingOffers.$inferSelect,
  actorUserId?: string | null,
  payment?: StripeOfferPayment,
  offerToken?: string,
) {
  if (offer.status === "accepted") return { bookingId: offer.bookingId, alreadyConfirmed: true };
  if (offer.status !== "sent" || offer.expiresAt.getTime() <= Date.now())
    throw new BookingCommandError("This offer is no longer available");
  if (payment && (payment.amountCents !== offer.totalCents || !Number.isSafeInteger(payment.amountCents)))
    throw new BookingCommandError("The Stripe payment amount does not match the offer");

  const booking = db.select().from(bookings).where(eq(bookings.id, offer.bookingId)).get();
  if (!booking) throw new BookingCommandError("Booking not found");
  assertTransition(booking.status, "confirmed");
  if (!booking.invoiceNumber) {
    const invoiceIssuedAt = now();
    db.update(bookings)
      .set({ invoiceNumber: allocateInvoiceNumber(db, invoiceIssuedAt), invoiceIssuedAt, updatedAt: invoiceIssuedAt })
      .where(eq(bookings.id, booking.id))
      .run();
  }
  const offeredAssets = db.select().from(bookingOfferItems).where(eq(bookingOfferItems.offerId, offer.id)).all();
  if (!offeredAssets.length) throw new BookingCommandError("The offer has no allocated assets");
  for (const item of offeredAssets) {
    if (hasAssetConflict(db, booking, item.assetId))
      throw new BookingCommandError("One of the offered bikes is no longer available; the offer remains open");
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
  const offerSnapshot = JSON.parse(offer.priceSnapshotJson) as {
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
  db.update(bookingOffers).set({ status: "accepted", acceptedAt: now() }).where(eq(bookingOffers.id, offer.id)).run();
  transition(db, booking, "confirmed", "offer_confirmed", actorUserId, "", {
    offerId: offer.id,
    ...(payment ? { stripeSessionId: payment.sessionId, paidAmountCents: payment.amountCents } : {}),
  });

  const chargeCents = payment ? offer.totalCents : confirmedBookingChargeCents(booking.quotedTotalCents);
  appendJournalEntry(db, {
    bookingId: booking.id,
    kind: "rental_charge",
    actorUserId,
    reason: payment ? "Gesamtbetrag für verbindliche Buchung" : "Anzahlung (50 %) für verbindliche Buchung",
    lines: [
      { account: "accounts_receivable", amountCents: chargeCents },
      { account: "rental_revenue", amountCents: -chargeCents },
    ],
  });
  if (payment) {
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
  }
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
  queueCustomerMail(db, booking, {
    kind: "booking_confirmed",
    subjectDe: notice.subject,
    subjectEn: notice.subject,
    textDe: notice.text,
    textEn: notice.text,
    html: notice.html,
  });
  return { bookingId: booking.id, alreadyConfirmed: false };
}

export function confirmOffer(db: AppDatabase, token: string, actorUserId?: string | null) {
  const hash = createHash("sha256").update(token).digest("hex");
  return runInImmediateTransaction(db, () => {
    const offer = db.select().from(bookingOffers).where(eq(bookingOffers.tokenHash, hash)).get();
    if (!offer) throw new BookingCommandError("This offer is no longer available");
    return confirmOfferRecord(db, offer, actorUserId, undefined, token);
  });
}

export function confirmOfferWithStripePayment(
  db: AppDatabase,
  input: { offerId: number; amountCents: number; sessionId: string; offerToken?: string },
) {
  return runInImmediateTransaction(db, () => {
    const offer = db.select().from(bookingOffers).where(eq(bookingOffers.id, input.offerId)).get();
    if (!offer) throw new BookingCommandError("This offer is no longer available");
    return confirmOfferRecord(
      db,
      offer,
      null,
      { amountCents: input.amountCents, sessionId: input.sessionId },
      input.offerToken,
    );
  });
}

export function cancelBooking(
  db: AppDatabase,
  input: {
    bookingId: number;
    cancellationFeeCents: number;
    reason: string;
    personalMessage?: string;
    cancellationPeriod?: string;
    dueAt?: Date | null;
    actorUserId?: string | null;
  },
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking) throw new BookingCommandError("Booking not found");
    assertBookingHasAssignee(db, booking);
    if (input.cancellationFeeCents < 0 || input.cancellationFeeCents > booking.quotedTotalCents || !input.reason.trim())
      throw new BookingCommandError("Cancellation requires a reason and a fee between 0 and the order total");
    const paidCents = receivedPaymentCents(db, booking.id);
    const refundCents = Math.max(0, paidCents - input.cancellationFeeCents);
    transition(db, booking, "cancelled", "booking_cancelled", input.actorUserId, input.reason, {
      cancellationFeeCents: input.cancellationFeeCents,
      dueAt: input.dueAt?.toISOString() ?? null,
    });
    db.update(bookingAssetAllocations)
      .set({ releasedAt: now() })
      .where(and(eq(bookingAssetAllocations.bookingId, booking.id), sql`${bookingAssetAllocations.releasedAt} is null`))
      .run();
    db.update(bookingAccessoryAllocations)
      .set({ releasedAt: now() })
      .where(
        and(
          eq(bookingAccessoryAllocations.bookingId, booking.id),
          sql`${bookingAccessoryAllocations.releasedAt} is null`,
        ),
      )
      .run();
    const recognizedChargeCents = recognizedRentalChargeCents(db, booking.id);
    if (booking.status === "confirmed" && recognizedChargeCents > 0)
      appendJournalEntry(db, {
        bookingId: booking.id,
        kind: "credit_note",
        actorUserId: input.actorUserId,
        reason: `Storno: ${input.reason}`,
        lines: [
          { account: "accounts_receivable", amountCents: -recognizedChargeCents },
          { account: "rental_revenue", amountCents: recognizedChargeCents },
        ],
      });
    if (input.cancellationFeeCents)
      appendJournalEntry(db, {
        bookingId: booking.id,
        kind: "cancellation_fee",
        actorUserId: input.actorUserId,
        reason: `Stornogebühr: ${input.reason}`,
        dueAt: input.dueAt ?? null,
        lines: [
          { account: "accounts_receivable", amountCents: input.cancellationFeeCents },
          { account: "cancellation_fee_revenue", amountCents: -input.cancellationFeeCents },
        ],
      });
    const notice = renderBookingNotice({
      kind: "cancelled",
      locale: booking.communicationLocale,
      name: booking.customerName,
      orderNumber: booking.orderNumber,
      totalCents: booking.quotedTotalCents,
      paidCents,
      cancellationFeeCents: input.cancellationFeeCents,
      refundCents,
      cancellationReason: input.reason,
      cancellationPeriod: input.cancellationPeriod,
      personalMessage: input.personalMessage,
    });
    return queueCustomerMail(db, booking, {
      kind: "booking_cancelled",
      subjectDe: notice.subject,
      subjectEn: notice.subject,
      textDe: notice.text,
      textEn: notice.text,
      html: notice.html,
    });
  });
}

type BookingMoneyMovementInput = {
  bookingId: number;
  amountCents: number;
  bookedAt?: string;
  financialAccountId?: number;
  reason: string;
  actorUserId?: string | null;
  idempotencyKey?: string | null;
};

function recordBookingMoneyMovement(db: AppDatabase, input: BookingMoneyMovementInput, amountCents: number) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking) throw new BookingCommandError("Booking not found");
    assertBookingHasAssignee(db, booking);
    if (input.idempotencyKey) {
      const existing = db
        .select({ id: journalEntries.id })
        .from(journalEntries)
        .where(eq(journalEntries.idempotencyKey, input.idempotencyKey))
        .get();
      if (existing) return existing.id;
    }
    const bookedAt = input.bookedAt ?? new Date().toISOString().slice(0, 10);
    if (!isValidIsoDate(bookedAt)) throw new BookingCommandError("Bitte gib ein gültiges Erfassungsdatum an.");
    const account = input.financialAccountId
      ? db.select().from(financialAccounts).where(eq(financialAccounts.id, input.financialAccountId)).get()
      : db.select().from(financialAccounts).where(eq(financialAccounts.code, "cash_main")).get();
    if (!account) throw new BookingCommandError("Bitte wähle ein gültiges Zahlungskonto aus.");
    if (account.status !== "active" || account.currency !== "EUR")
      throw new BookingCommandError("Das Zahlungskonto ist nicht aktiv oder nicht in EUR geführt.");
    const incomeCategory = db
      .select()
      .from(financialCategories)
      .where(eq(financialCategories.code, "rental_revenue"))
      .get();
    if (!incomeCategory) throw new BookingCommandError("Die EÜR-Kategorie für Mieteinnahmen fehlt.");

    const isRefund = amountCents < 0;
    const absoluteAmountCents = Math.abs(amountCents);
    if (isRefund) {
      if (absoluteAmountCents > Math.max(0, receivedPaymentCents(db, booking.id)))
        throw new BookingCommandError("Die Erstattung darf die tatsächlich erhaltenen Zahlungen nicht überschreiten");
    } else if (receivedPaymentCents(db, booking.id) + absoluteAmountCents > booking.quotedTotalCents) {
      throw new BookingCommandError("Die Zahlung darf den Gesamtpreis der Buchung nicht überschreiten");
    }

    const occurredAt = new Date(`${bookedAt}T12:00:00.000Z`);
    const stamp = new Date();
    const transaction = db
      .insert(financialTransactions)
      .values({
        financialAccountId: account.id,
        source: "manual",
        provider: "manual_booking",
        kind: isRefund ? "refund" : "payment",
        status: "imported",
        amountCents,
        grossAmountCents: amountCents,
        netAmountCents: amountCents,
        currency: "EUR",
        bookedAt,
        reference: booking.invoiceNumber ?? booking.orderNumber,
        description: isRefund
          ? `Stornierung / Erstattung zu ${booking.invoiceNumber ?? booking.orderNumber}`
          : `Zahlung zu ${booking.invoiceNumber ?? booking.orderNumber}`,
        metadataJson: JSON.stringify({ bookingId: booking.id, invoiceNumber: booking.invoiceNumber, manual: true }),
        importedAt: stamp,
        createdAt: stamp,
        updatedAt: stamp,
      })
      .returning({ id: financialTransactions.id })
      .get();
    const journalEntryId = appendJournalEntry(db, {
      bookingId: input.bookingId,
      financialTransactionId: transaction.id,
      kind: isRefund ? "refund_issued" : "payment_received",
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      occurredAt,
      lines: [
        { account: account.code, amountCents },
        { account: "accounts_receivable", amountCents: -amountCents },
      ],
    });
    db.insert(financialTransactionAllocations)
      .values({
        transactionId: transaction.id,
        bookingId: booking.id,
        categoryId: incomeCategory.id,
        allocationKind: isRefund ? "booking_refund" : "booking_payment",
        matchMethod: "manual",
        amountCents,
        note: input.reason.trim(),
        matchedByUserId: input.actorUserId ?? null,
        matchedAt: stamp,
        journalEntryId,
        createdAt: stamp,
        updatedAt: stamp,
      })
      .run();
    db.update(financialTransactions)
      .set({ status: "posted", reconciledAt: stamp, reconciledByUserId: input.actorUserId ?? null, updatedAt: stamp })
      .where(eq(financialTransactions.id, transaction.id))
      .run();
    return journalEntryId;
  });
}

export function recordPayment(db: AppDatabase, input: BookingMoneyMovementInput) {
  if (!Number.isInteger(input.amountCents) || input.amountCents === 0 || !input.reason.trim())
    throw new BookingCommandError("A non-zero payment amount and reason are required");
  return recordBookingMoneyMovement(db, input, input.amountCents);
}

export function recordRefund(db: AppDatabase, input: BookingMoneyMovementInput) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || !input.reason.trim())
    throw new BookingCommandError("A positive refund amount and reason are required");
  return recordBookingMoneyMovement(db, input, -input.amountCents);
}

export function correctJournalEntry(
  db: AppDatabase,
  input: { bookingId: number; entryId: number; reason: string; actorUserId?: string | null },
) {
  if (!input.reason.trim()) throw new BookingCommandError("A correction reason is required");
  return runInImmediateTransaction(db, () => {
    const entry = db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, input.entryId), eq(journalEntries.bookingId, input.bookingId)))
      .get();
    if (!entry) throw new BookingCommandError("Journal entry not found");
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking) throw new BookingCommandError("Booking not found");
    assertBookingHasAssignee(db, booking);
    const lines = db.select().from(journalLines).where(eq(journalLines.entryId, entry.id)).all();
    if (!lines.length) throw new BookingCommandError("Journal entry has no lines");
    return appendJournalEntry(db, {
      bookingId: entry.bookingId ?? undefined,
      kind: "correction",
      actorUserId: input.actorUserId,
      reason: input.reason,
      reversesEntryId: entry.id,
      lines: lines.map((line) => ({ account: line.account, amountCents: -line.amountCents })),
    });
  });
}

export function recordExpense(
  db: AppDatabase,
  input: { amountCents: number; reason: string; actorUserId: string; bookingId?: number },
) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || !input.reason.trim())
    throw new BookingCommandError("A positive expense amount and reason are required");
  return runInImmediateTransaction(db, () =>
    appendJournalEntry(db, {
      bookingId: input.bookingId,
      kind: "expense",
      actorUserId: input.actorUserId,
      reason: input.reason,
      lines: [
        { account: "expense", amountCents: input.amountCents },
        { account: "bank_or_cash", amountCents: -input.amountCents },
      ],
    }),
  );
}

export function getBookingPaymentStatus(db: AppDatabase, bookingId: number) {
  return getReceivableStatus(db, bookingId);
}

export function advanceBooking(
  db: AppDatabase,
  bookingId: number,
  target: "rejected" | "expired" | "checked_out" | "completed",
  actorUserId?: string | null,
  reason = "",
  personalMessage?: string,
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
    if (!booking) throw new BookingCommandError("Booking not found");
    assertBookingHasAssignee(db, booking);
    transition(db, booking, target, `booking_${target}`, actorUserId, reason);
    if (target === "completed") {
      if (!booking.invoiceNumber) {
        const invoiceIssuedAt = now();
        db.update(bookings)
          .set({
            invoiceNumber: allocateInvoiceNumber(db, invoiceIssuedAt),
            invoiceIssuedAt,
            updatedAt: invoiceIssuedAt,
          })
          .where(eq(bookings.id, booking.id))
          .run();
      }
      const recognizedRentalCents = recognizedRentalChargeCents(db, booking.id);
      const remainingCents = Math.max(0, booking.quotedTotalCents - recognizedRentalCents);
      if (remainingCents > 0)
        appendJournalEntry(db, {
          bookingId: booking.id,
          kind: "rental_charge",
          actorUserId,
          reason: "Restzahlung (50 %) bei Abschluss der Buchung",
          lines: [
            { account: "accounts_receivable", amountCents: remainingCents },
            { account: "rental_revenue", amountCents: -remainingCents },
          ],
        });
    }
    let queuedMailId: number | null = null;
    if (target === "checked_out") {
      const feedbackToken = randomBytes(32).toString("hex");
      const feedbackMail = renderFeedbackRequestMail({
        locale: booking.communicationLocale,
        name: booking.customerName,
        orderNumber: booking.orderNumber,
        token: feedbackToken,
      });
      db.insert(bookingFeedback)
        .values({
          bookingId: booking.id,
          tokenHash: createHash("sha256").update(feedbackToken).digest("hex"),
          comment: "",
          createdAt: now(),
        })
        .onConflictDoNothing()
        .run();
      queuedMailId = queueCustomerMail(db, booking, {
        kind: "feedback_request",
        subjectDe: feedbackMail.subject,
        subjectEn: feedbackMail.subject,
        textDe: feedbackMail.text,
        textEn: feedbackMail.text,
        html: feedbackMail.html,
      });
    }
    if (target === "rejected") {
      const notice = renderBookingNotice({
        kind: "rejected",
        locale: booking.communicationLocale,
        name: booking.customerName,
        orderNumber: booking.orderNumber,
        senderFirstName: firstName(
          actorUserId
            ? db.select({ name: authUser.name }).from(authUser).where(eq(authUser.id, actorUserId)).get()?.name
            : undefined,
        ),
        personalMessage: personalMessage?.trim(),
      });
      queuedMailId = queueCustomerMail(db, booking, {
        kind: "booking_rejected",
        subjectDe: notice.subject,
        subjectEn: notice.subject,
        textDe: notice.text,
        textEn: notice.text,
        html: notice.html,
      });
    }
    return queuedMailId;
  });
}

/** Expiry is a command, never a background direct status update. */
export function expireDueOffers(db: AppDatabase) {
  return runInImmediateTransaction(db, () => {
    const due = db
      .select()
      .from(bookingOffers)
      .where(and(eq(bookingOffers.status, "sent"), sql`${bookingOffers.expiresAt} <= ${Date.now()}`))
      .all();
    for (const offer of due) {
      db.update(bookingOffers).set({ status: "expired" }).where(eq(bookingOffers.id, offer.id)).run();
      const booking = db.select().from(bookings).where(eq(bookings.id, offer.bookingId)).get();
      if (booking?.status === "offer_sent")
        transition(db, booking, "expired", "offer_expired", null, "Angebot nach 36 Stunden abgelaufen", {
          offerId: offer.id,
        });
    }
    return due.length;
  });
}
