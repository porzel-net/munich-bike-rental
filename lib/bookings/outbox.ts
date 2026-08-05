import { and, desc, eq, lte, or } from "drizzle-orm";

import { getDatabase, runInImmediateTransaction, type AppDatabase } from "../db/client";
import { bookingOffers, bookings, communicationMessages, mailOutbox } from "../db/schema";
import { findBookingThreadMessageId } from "../inquiries/mailbox";
import { reviewBookingEmailThread } from "../inquiries/email-action";
import { buildMailThreadReferences, parseMailMessageIds } from "../inquiries/mail-thread";
import { sendConfiguredMail } from "../inquiries/server";

const LEASE_MS = 60_000;
const RETRY_CAP_MS = 60 * 60 * 1_000;

function usesRequestAccount(kind: string) {
  return kind === "new_inquiry" || kind === "inquiry_received";
}

async function resolveThread(
  db: AppDatabase,
  bookingId: number,
  orderNumber: string,
  fallbackInReplyTo: string | null,
  fallbackReferencesHeader: string | null,
) {
  const messages = db
    .select()
    .from(communicationMessages)
    .where(eq(communicationMessages.bookingId, bookingId))
    .orderBy(desc(communicationMessages.sentAt), desc(communicationMessages.id))
    .all();
  const parent = messages.find((message) => Boolean(message.rfcMessageId)) ?? null;
  const parentMessageId = parent?.rfcMessageId ?? fallbackInReplyTo ?? (await findBookingThreadMessageId(orderNumber));
  if (!parentMessageId) return { inReplyTo: null, referencesHeader: null, threadMessageId: null };

  const references = parent
    ? buildMailThreadReferences(parentMessageId, parent, messages)
    : parseMailMessageIds(fallbackReferencesHeader).concat(parentMessageId);
  return {
    inReplyTo: parentMessageId,
    referencesHeader: [...new Set(references)].join(" ") || null,
    threadMessageId: parent?.threadMessageId ?? parentMessageId,
  };
}

/** Processes one durable mail job. It is safe to call every minute from cron. */
export async function dispatchNextOutboxMail(db: AppDatabase = getDatabase(), mailId?: number) {
  const job = runInImmediateTransaction(db, () => {
    const current = new Date();
    const due = and(
      or(eq(mailOutbox.status, "queued"), and(eq(mailOutbox.status, "failed"), lte(mailOutbox.nextAttemptAt, current))),
      lte(mailOutbox.nextAttemptAt, current),
    );
    const row = db
      .select()
      .from(mailOutbox)
      .where(mailId ? and(eq(mailOutbox.id, mailId), due) : due)
      .limit(1)
      .get();
    if (!row) return null;
    db.update(mailOutbox)
      .set({ status: "leased", leasedAt: current, attempts: row.attempts + 1 })
      .where(eq(mailOutbox.id, row.id))
      .run();
    return { ...row, attempts: row.attempts + 1 };
  });
  if (!job) return null;
  try {
    const booking = db
      .select({ orderNumber: bookings.orderNumber })
      .from(bookings)
      .where(eq(bookings.id, job.bookingId))
      .get();
    const thread =
      booking && !usesRequestAccount(job.kind)
        ? await resolveThread(db, job.bookingId, booking.orderNumber, job.inReplyTo, job.referencesHeader)
        : { inReplyTo: null, referencesHeader: null, threadMessageId: null };
    const inReplyTo = thread.inReplyTo ?? (usesRequestAccount(job.kind) ? null : job.inReplyTo);
    const referencesHeader = thread.referencesHeader ?? (usesRequestAccount(job.kind) ? null : job.referencesHeader);
    db.update(mailOutbox)
      .set({ inReplyTo, referencesHeader })
      .where(and(eq(mailOutbox.id, job.id), eq(mailOutbox.status, "leased")))
      .run();
    const sent = await sendConfiguredMail({
      account: usesRequestAccount(job.kind) ? "request" : "main",
      to: job.recipient,
      subject: job.subject,
      text: job.plainText,
      inReplyTo: inReplyTo ?? undefined,
      references: referencesHeader ?? undefined,
    });
    if (!sent) throw new Error("Mail account is not configured");
    let outboundMessageId: number | null = null;
    runInImmediateTransaction(db, () => {
      const sentAt = new Date();
      db.update(mailOutbox)
        .set({ status: "sent", sentAt, providerMessageId: sent.messageId, lastError: null })
        .where(and(eq(mailOutbox.id, job.id), eq(mailOutbox.status, "leased")))
        .run();
      if (job.offerId) db.update(bookingOffers).set({ sentAt }).where(eq(bookingOffers.id, job.offerId)).run();
      outboundMessageId =
        db
          .insert(communicationMessages)
          .values({
            bookingId: job.bookingId,
            direction: "outbound",
            rfcMessageId: sent.messageId,
            threadMessageId: thread.threadMessageId ?? sent.messageId,
            inReplyTo,
            referencesHeader,
            sender: "system",
            recipients: job.recipient,
            subject: job.subject,
            plainText: job.plainText,
            sentAt,
            archivedAt: sentAt,
          })
          .onConflictDoNothing()
          .returning({ id: communicationMessages.id })
          .get()?.id ?? null;
    });
    if (outboundMessageId) await reviewBookingEmailThread(db, job.bookingId, outboundMessageId);
    return { id: job.id, status: "sent" as const };
  } catch (error) {
    const retryInMs = Math.min(RETRY_CAP_MS, 1_000 * 2 ** Math.min(job.attempts, 12));
    runInImmediateTransaction(db, () =>
      db
        .update(mailOutbox)
        .set({
          status: "failed",
          leasedAt: null,
          nextAttemptAt: new Date(Date.now() + retryInMs),
          lastError: error instanceof Error ? error.message.slice(0, 500) : "unknown send failure",
        })
        .where(eq(mailOutbox.id, job.id))
        .run(),
    );
    return { id: job.id, status: "failed" as const };
  }
}

/** Sends all currently due messages for one booking immediately after a user action. */
export async function dispatchOutboxForBooking(db: AppDatabase, bookingId: number) {
  const jobs = db.select({ id: mailOutbox.id }).from(mailOutbox).where(eq(mailOutbox.bookingId, bookingId)).all();
  const results = [];
  for (const job of jobs) {
    const result = await dispatchNextOutboxMail(db, job.id);
    if (result) results.push(result);
  }
  return results;
}

export function releaseExpiredOutboxLeases(db: AppDatabase = getDatabase()) {
  const cutoff = new Date(Date.now() - LEASE_MS);
  return db
    .update(mailOutbox)
    .set({ status: "queued", leasedAt: null, nextAttemptAt: new Date() })
    .where(and(eq(mailOutbox.status, "leased"), lte(mailOutbox.leasedAt, cutoff)))
    .run();
}
