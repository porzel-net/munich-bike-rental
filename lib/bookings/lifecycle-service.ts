import { createHash, randomBytes } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import {
  authUser,
  bookingAccessoryAllocations,
  bookingAssetAllocations,
  bookingFeedback,
  bookingOffers,
  bookings,
} from "../db/schema";

import { BookingCommandError } from "./errors";
import { allocateInvoiceNumber } from "./invoice-number";
import { appendJournalEntry, getReceivedPaymentCents } from "./ledger";
import { renderBookingNotice, renderFeedbackRequestMail } from "./messages";
import { recognizedRentalChargeCents } from "./payment-service";
import { assertBookingHasAssignee, firstName, now, queueCustomerMail, transition } from "./service-shared";

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
    sendMail?: boolean;
  },
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, input.bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    assertBookingHasAssignee(db, booking);
    if (input.cancellationFeeCents < 0 || input.cancellationFeeCents > booking.quotedTotalCents || !input.reason.trim())
      throw new BookingCommandError(
        "Für die Stornierung musst du einen Grund und eine Gebühr zwischen 0 € und dem Gesamtpreis angeben.",
      );
    const paidCents = getReceivedPaymentCents(db, booking.id);
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
    db.update(bookingOffers)
      .set({ status: "revoked", revokedAt: now() })
      .where(and(eq(bookingOffers.bookingId, booking.id), eq(bookingOffers.status, "sent")))
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
    if (input.sendMail === false) return null;
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
      mail: notice,
    });
  });
}

export function advanceBooking(
  db: AppDatabase,
  bookingId: number,
  target: "rejected" | "expired" | "checked_out" | "completed",
  actorUserId?: string | null,
  reason = "",
  personalMessage?: string,
  sendMail = true,
) {
  return runInImmediateTransaction(db, () => {
    const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
    if (!booking)
      throw new BookingCommandError("Die Buchung wurde nicht gefunden. Aktualisiere die Seite und versuche es erneut.");
    assertBookingHasAssignee(db, booking);
    transition(db, booking, target, `booking_${target}`, actorUserId, reason);
    if (target === "expired")
      db.update(bookingOffers)
        .set({ status: "expired" })
        .where(and(eq(bookingOffers.bookingId, booking.id), eq(bookingOffers.status, "sent")))
        .run();
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
          reason: "Nachbuchung des noch offenen Gesamtbetrags bei Abschluss der Buchung",
          lines: [
            { account: "accounts_receivable", amountCents: remainingCents },
            { account: "rental_revenue", amountCents: -remainingCents },
          ],
        });
    }
    let queuedMailId: number | null = null;
    if (target === "checked_out" && sendMail) {
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
        mail: feedbackMail,
      });
    }
    if (target === "rejected" && sendMail) {
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
        mail: notice,
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
