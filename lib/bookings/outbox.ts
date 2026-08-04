import { and, eq, lte, or } from "drizzle-orm";

import { getDatabase, runInImmediateTransaction, type AppDatabase } from "../db/client";
import { bookingOffers, communicationMessages, mailOutbox } from "../db/schema";
import { sendConfiguredMail } from "../inquiries/server";

const LEASE_MS = 60_000;
const RETRY_CAP_MS = 60 * 60 * 1_000;

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
    const sent = await sendConfiguredMail({
      account: job.kind === "new_inquiry" ? "request" : "main",
      to: job.recipient,
      subject: job.subject,
      text: job.plainText,
      inReplyTo: job.inReplyTo ?? undefined,
    });
    if (!sent) throw new Error("Mail account is not configured");
    runInImmediateTransaction(db, () => {
      const sentAt = new Date();
      db.update(mailOutbox)
        .set({ status: "sent", sentAt, providerMessageId: sent.messageId, lastError: null })
        .where(and(eq(mailOutbox.id, job.id), eq(mailOutbox.status, "leased")))
        .run();
      if (job.offerId) db.update(bookingOffers).set({ sentAt }).where(eq(bookingOffers.id, job.offerId)).run();
      db.insert(communicationMessages)
        .values({
          bookingId: job.bookingId,
          direction: "outbound",
          rfcMessageId: sent.messageId,
          inReplyTo: job.inReplyTo ?? null,
          sender: "system",
          recipients: job.recipient,
          subject: job.subject,
          plainText: job.plainText,
          sentAt,
          archivedAt: sentAt,
        })
        .onConflictDoNothing()
        .run();
    });
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
