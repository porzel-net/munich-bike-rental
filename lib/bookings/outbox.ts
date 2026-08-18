import { and, desc, eq, lte, or } from "drizzle-orm";

import { getDatabase, runInImmediateTransaction, type AppDatabase } from "../db/client";
import { bookingOffers, bookingRequestedItems, bookings, communicationMessages, mailOutbox } from "../db/schema";
import { renderInvoicePdf } from "./invoice-pdf";
import { getBookingPaymentStatus } from "./service";
import type { OfferQuote } from "./quotes";
import { findLatestBookingThreadMessage } from "../inquiries/mailbox";
import { reviewBookingEmailThread } from "../inquiries/email-action";
import { buildMailThreadReferences, parseMailMessageIds } from "../inquiries/mail-thread";
import { rentalLocationLabels } from "../inquiries/catalog";
import { sendConfiguredMail } from "../inquiries/server";

const LEASE_MS = 60_000;
const RETRY_CAP_MS = 60 * 60 * 1_000;

function usesRequestAccount(kind: string) {
  return kind === "new_inquiry" || kind === "inquiry_received";
}

async function buildPaidBookingInvoiceAttachment(db: AppDatabase, bookingId: number) {
  const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  const payment = getBookingPaymentStatus(db, bookingId);
  if (!booking?.invoiceNumber || payment.status !== "settled") return null;

  const offer = db
    .select()
    .from(bookingOffers)
    .where(and(eq(bookingOffers.bookingId, bookingId), eq(bookingOffers.status, "accepted")))
    .orderBy(desc(bookingOffers.offerNumber))
    .get();
  if (!offer) return null;

  const requestedItems = db
    .select()
    .from(bookingRequestedItems)
    .where(eq(bookingRequestedItems.bookingId, bookingId))
    .all();
  const quote = JSON.parse(offer.priceSnapshotJson) as OfferQuote;
  const location =
    rentalLocationLabels.de[booking.location as keyof typeof rentalLocationLabels.de] ?? booking.location;
  const content = await renderInvoicePdf({
    invoiceNumber: booking.invoiceNumber,
    issuedAt: booking.invoiceIssuedAt ?? new Date(),
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    orderNumber: booking.orderNumber,
    periodFrom: booking.periodFrom,
    periodTo: booking.periodTo,
    pickupTime: booking.pickupTime,
    dropoffTime: booking.dropoffTime,
    location,
    quote: {
      ...quote,
      offeredItems: quote.offeredItems.filter((item) =>
        requestedItems.some((requested) => requested.id === item.requestedItemId),
      ),
    },
    paidAmountCents: quote.totalCents - payment.openCents,
  });
  return {
    filename: `${booking.invoiceNumber}.pdf`,
    content,
    contentType: "application/pdf",
  };
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
  const localParent = messages.find((message) => Boolean(message.rfcMessageId)) ?? null;
  const latestRemote = await findLatestBookingThreadMessage(orderNumber);
  const localTimestamp = localParent?.sentAt.getTime() ?? Number.NEGATIVE_INFINITY;
  const useRemoteParent = Boolean(latestRemote && latestRemote.timestamp >= localTimestamp);
  const parentMessageId = useRemoteParent
    ? latestRemote?.messageId
    : (localParent?.rfcMessageId ?? fallbackInReplyTo ?? latestRemote?.messageId);
  if (!parentMessageId) return { inReplyTo: null, referencesHeader: null, threadMessageId: null };

  const parent =
    messages.find((message) => message.rfcMessageId === parentMessageId) ?? (useRemoteParent ? null : localParent);
  const remoteReferences = latestRemote?.messageId === parentMessageId ? latestRemote.referencesHeader : null;
  const references = parent
    ? buildMailThreadReferences(parentMessageId, parent, messages)
    : parseMailMessageIds(remoteReferences ?? fallbackReferencesHeader).concat(parentMessageId);
  const threadMessageId =
    parent?.threadMessageId ?? parseMailMessageIds(remoteReferences ?? fallbackReferencesHeader)[0] ?? parentMessageId;
  return {
    inReplyTo: parentMessageId,
    referencesHeader: [...new Set(references)].join(" ") || null,
    threadMessageId,
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
    const attachments =
      job.kind === "booking_confirmed" ? await buildPaidBookingInvoiceAttachment(db, job.bookingId) : null;
    const sent = await sendConfiguredMail({
      account: usesRequestAccount(job.kind) ? "request" : "main",
      to: job.recipient,
      subject: job.subject,
      text: job.plainText,
      html: job.html ?? undefined,
      attachments: attachments ? [attachments] : undefined,
      inReplyTo: inReplyTo ?? undefined,
      references: referencesHeader ?? undefined,
    });
    if (!sent) throw new Error("Für den Versand ist kein Mailkonto eingerichtet. Prüfe die SMTP-Konfiguration.");
    let outboundMessageId: number | null = null;
    runInImmediateTransaction(db, () => {
      const sentAt = new Date();
      db.update(mailOutbox)
        .set({
          status: "sent",
          sentAt,
          providerMessageId: sent.messageId,
          sentMailboxPath: sent.sentMailbox?.mailbox ?? null,
          sentMailboxAt: sent.sentMailbox?.copied ? sentAt : null,
          sentMailboxError:
            sent.sentMailbox?.configured && !sent.sentMailbox.copied
              ? (sent.sentMailbox.reason ?? "copy_failed")
              : null,
          lastError: null,
        })
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
    if (result) {
      results.push(result);
      continue;
    }
    // An idempotent retry can find a mail that the original request already
    // sent. Report that durable state so the retry still receives a success
    // response and never attempts a second delivery.
    const current = db.select({ status: mailOutbox.status }).from(mailOutbox).where(eq(mailOutbox.id, job.id)).get();
    if (current?.status === "sent" || current?.status === "failed") {
      results.push({ id: job.id, status: current.status });
    }
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
