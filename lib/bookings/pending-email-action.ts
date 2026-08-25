import { and, desc, inArray } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/client";
import { bookingEvents, emailActionReviews } from "@/lib/db/schema";
import type { BookingStatus } from "@/lib/db/schema";
import { EMAIL_ACTION_START_AT, isEmailQuestionsManuallyResolved } from "@/lib/inquiries/email-action";

type BookingForEmailAction = {
  id: number;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
};

/** Returns bookings that should display the red attention indicator. */
export function getPendingBookingAttentionBookingIds(db: AppDatabase, bookingRows: BookingForEmailAction[]) {
  if (!bookingRows.length) return new Set<number>();

  const bookingIds = bookingRows.map((booking) => booking.id);
  const actionReviews = db
    .select()
    .from(emailActionReviews)
    .where(inArray(emailActionReviews.bookingId, bookingIds))
    .orderBy(desc(emailActionReviews.createdAt), desc(emailActionReviews.id))
    .all();
  const latestActionReviewByBooking = new Map<number, (typeof actionReviews)[number]>();
  for (const review of actionReviews) {
    if (!latestActionReviewByBooking.has(review.bookingId)) latestActionReviewByBooking.set(review.bookingId, review);
  }

  const emailQuestionEvents = db
    .select({
      bookingId: bookingEvents.bookingId,
      eventType: bookingEvents.eventType,
      occurredAt: bookingEvents.occurredAt,
      id: bookingEvents.id,
    })
    .from(bookingEvents)
    .where(
      and(
        inArray(bookingEvents.bookingId, bookingIds),
        inArray(bookingEvents.eventType, [
          "booking_attention_acknowledged",
          "email_questions_resolved",
          "email_questions_reopened",
          "offer_expired",
        ]),
      ),
    )
    .orderBy(desc(bookingEvents.occurredAt), desc(bookingEvents.id))
    .all();
  const latestEmailQuestionEventByBooking = new Map<number, (typeof emailQuestionEvents)[number]>();
  const latestAttentionAcknowledgedEventByBooking = new Map<number, (typeof emailQuestionEvents)[number]>();
  const latestOfferExpiredEventByBooking = new Map<number, (typeof emailQuestionEvents)[number]>();
  for (const event of emailQuestionEvents) {
    if (
      (event.eventType === "email_questions_resolved" || event.eventType === "email_questions_reopened") &&
      !latestEmailQuestionEventByBooking.has(event.bookingId)
    )
      latestEmailQuestionEventByBooking.set(event.bookingId, event);
    if (
      event.eventType === "booking_attention_acknowledged" &&
      !latestAttentionAcknowledgedEventByBooking.has(event.bookingId)
    )
      latestAttentionAcknowledgedEventByBooking.set(event.bookingId, event);
    if (event.eventType === "offer_expired" && !latestOfferExpiredEventByBooking.has(event.bookingId))
      latestOfferExpiredEventByBooking.set(event.bookingId, event);
  }

  return new Set(
    bookingRows
      .filter((booking) => {
        const latestActionReview = latestActionReviewByBooking.get(booking.id);
        const latestEmailQuestionEvent = latestEmailQuestionEventByBooking.get(booking.id) ?? null;
        const latestAcknowledgedAt =
          latestAttentionAcknowledgedEventByBooking.get(booking.id)?.occurredAt.getTime() ?? 0;
        const emailQuestionIsPending =
          !isEmailQuestionsManuallyResolved(latestActionReview ?? null, latestEmailQuestionEvent) &&
          (latestActionReview?.status === "needs_action" ||
            latestActionReview?.status === "error" ||
            (!latestActionReview &&
              booking.status === "inquiry_received" &&
              booking.createdAt.getTime() >= EMAIL_ACTION_START_AT.getTime()));
        const emailQuestionTriggerAt = Math.max(
          latestActionReview?.createdAt.getTime() ?? booking.createdAt.getTime(),
          latestEmailQuestionEvent?.occurredAt.getTime() ?? 0,
        );
        const offerExpiredTriggerAt =
          latestOfferExpiredEventByBooking.get(booking.id)?.occurredAt.getTime() ?? booking.updatedAt.getTime();
        const hasUnacknowledgedEmailQuestion = emailQuestionIsPending && emailQuestionTriggerAt > latestAcknowledgedAt;
        const hasUnacknowledgedOfferExpiry =
          booking.status === "expired" && offerExpiredTriggerAt > latestAcknowledgedAt;
        return hasUnacknowledgedEmailQuestion || hasUnacknowledgedOfferExpiry;
      })
      .map((booking) => booking.id),
  );
}

/** Backwards-compatible name for callers that only care about email-question attention. */
export const getPendingEmailActionBookingIds = getPendingBookingAttentionBookingIds;
