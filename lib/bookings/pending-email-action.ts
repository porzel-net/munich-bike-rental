import { and, desc, inArray } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/client";
import { bookingEvents, emailActionReviews } from "@/lib/db/schema";
import type { BookingStatus } from "@/lib/db/schema";
import { EMAIL_ACTION_START_AT, isEmailQuestionsManuallyResolved } from "@/lib/inquiries/email-action";

type BookingForEmailAction = {
  id: number;
  status: BookingStatus;
  createdAt: Date;
};

/** Returns bookings that should display the open customer-question indicator. */
export function getPendingEmailActionBookingIds(db: AppDatabase, bookingRows: BookingForEmailAction[]) {
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
        inArray(bookingEvents.eventType, ["email_questions_resolved", "email_questions_reopened"]),
      ),
    )
    .orderBy(desc(bookingEvents.occurredAt), desc(bookingEvents.id))
    .all();
  const latestEmailQuestionEventByBooking = new Map<number, (typeof emailQuestionEvents)[number]>();
  for (const event of emailQuestionEvents) {
    if (!latestEmailQuestionEventByBooking.has(event.bookingId))
      latestEmailQuestionEventByBooking.set(event.bookingId, event);
  }

  return new Set(
    bookingRows
      .filter((booking) => {
        const latestActionReview = latestActionReviewByBooking.get(booking.id);
        const latestEmailQuestionEvent = latestEmailQuestionEventByBooking.get(booking.id) ?? null;
        return (
          !isEmailQuestionsManuallyResolved(latestActionReview ?? null, latestEmailQuestionEvent) &&
          (latestActionReview?.status === "needs_action" ||
            latestActionReview?.status === "error" ||
            (!latestActionReview &&
              booking.status === "inquiry_received" &&
              booking.createdAt.getTime() >= EMAIL_ACTION_START_AT.getTime()))
        );
      })
      .map((booking) => booking.id),
  );
}
