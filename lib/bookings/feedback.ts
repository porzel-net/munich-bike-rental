import { createHash } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { runInImmediateTransaction, type AppDatabase } from "../db/client";
import { bookingFeedback, bookings } from "../db/schema";
import { siteConfig } from "../site";

import { feedbackCriteria, type FeedbackRatings, type PublicFeedback } from "./feedback-shared";

export { feedbackCriteria } from "./feedback-shared";
export type { FeedbackRatingKey, FeedbackRatings, PublicFeedback } from "./feedback-shared";

export class FeedbackError extends Error {}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function feedbackPageUrl(token: string) {
  return new URL(`/feedback/${token}`, siteConfig.url).toString();
}

function getFeedbackRow(db: AppDatabase, token: string) {
  if (!token || token.length > 200) return null;
  return (
    db
      .select({ feedback: bookingFeedback, booking: bookings })
      .from(bookingFeedback)
      .innerJoin(bookings, eq(bookingFeedback.bookingId, bookings.id))
      .where(eq(bookingFeedback.tokenHash, hashToken(token)))
      .get() ?? null
  );
}

export function getPublicFeedbackByToken(db: AppDatabase, token: string): PublicFeedback | null {
  const row = getFeedbackRow(db, token);
  if (!row) return null;
  return {
    bookingId: row.booking.id,
    orderNumber: row.booking.orderNumber,
    customerName: row.booking.customerName,
    locale: row.booking.communicationLocale,
    submittedAt: row.feedback.submittedAt?.toISOString() ?? null,
    ratings: {
      bikeRating: row.feedback.bikeRating,
      handoverRating: row.feedback.handoverRating,
      communicationRating: row.feedback.communicationRating,
      priceRating: row.feedback.priceRating,
      overallRating: row.feedback.overallRating,
    },
    comment: row.feedback.comment,
  };
}

export function submitPublicFeedback(db: AppDatabase, token: string, input: FeedbackRatings & { comment: string }) {
  if (Object.values(input).some((value) => typeof value !== "number" && typeof value !== "string"))
    throw new FeedbackError("Ungültiges Feedback");
  if (feedbackCriteria.some(({ key }) => !Number.isInteger(input[key]) || input[key] < 1 || input[key] > 5))
    throw new FeedbackError("Bitte bewerte alle Punkte mit 1 bis 5 Sternen.");
  if (input.comment.length > 2_000) throw new FeedbackError("Der Kommentar ist zu lang.");

  return runInImmediateTransaction(db, () => {
    const row = getFeedbackRow(db, token);
    if (!row) throw new FeedbackError("Dieser Feedback-Link ist nicht gültig.");
    if (row.feedback.submittedAt) throw new FeedbackError("Dieses Feedback wurde bereits abgegeben.");
    const submittedAt = new Date();
    db.update(bookingFeedback)
      .set({
        bikeRating: input.bikeRating,
        handoverRating: input.handoverRating,
        communicationRating: input.communicationRating,
        priceRating: input.priceRating,
        overallRating: input.overallRating,
        comment: input.comment,
        submittedAt,
      })
      .where(and(eq(bookingFeedback.id, row.feedback.id), isNull(bookingFeedback.submittedAt)))
      .run();
    return submittedAt;
  });
}
