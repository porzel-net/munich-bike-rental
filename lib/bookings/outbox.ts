import { and, asc, desc, eq, gte, lte, lt, or } from "drizzle-orm";

import { getDatabase, runInImmediateTransaction, type AppDatabase } from "../db/client";
import {
  authUser,
  bookingOffers,
  bookingRequestedItems,
  bookings,
  communicationMessages,
  mailOutbox,
} from "../db/schema";
import { companyToVCard, contactCardFileName } from "../contacts/contact-card";
import { renderInvoicePdf } from "./invoice-pdf";
import { getBookingPaymentStatus } from "./service";
import { applyCustomOfferPrice, parseOfferQuoteSnapshot, type OfferQuote } from "./quotes";
import { findLatestBookingThreadMessage } from "../inquiries/mailbox";
import { reviewBookingEmailThread } from "../inquiries/email-action";
import { buildMailThreadReferences, parseMailMessageIds } from "../inquiries/mail-thread";
import { rentalLocationLabels } from "../inquiries/catalog";
import { sendConfiguredMail } from "../inquiries/server";
import { MAX_MAIL_ATTEMPTS } from "./outbox-constants";
import {
  AUTOMATIC_LOCATION_REJECTION_KIND,
  automaticLocationRejectionReason,
  shouldAutomaticallyRejectLocation,
} from "./automatic-location-rejection";
import { event } from "./service-shared";

export { MAX_MAIL_ATTEMPTS } from "./outbox-constants";

const LEASE_MS = 60_000;
const RETRY_CAP_MS = 60 * 60 * 1_000;
function usesRequestAccount(kind: string) {
  return kind === "new_inquiry" || kind === "inquiry_received";
}

function isAutomaticLocationRejectionDue(job: typeof mailOutbox.$inferSelect, db: AppDatabase) {
  if (job.kind !== AUTOMATIC_LOCATION_REJECTION_KIND) return true;
  const booking = db
    .select({ source: bookings.source, location: bookings.location, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, job.bookingId))
    .get();
  return Boolean(
    booking &&
    booking.status === "inquiry_received" &&
    shouldAutomaticallyRejectLocation(booking.source, booking.location),
  );
}

function cancelSkippedAutomaticLocationRejection(db: AppDatabase, mailId: number) {
  db.update(mailOutbox)
    .set({
      status: "cancelled",
      leasedAt: null,
      nextAttemptAt: new Date(),
      lastError: "Automatische Standort-Absage nicht mehr erforderlich",
    })
    .where(and(eq(mailOutbox.id, mailId), eq(mailOutbox.status, "leased")))
    .run();
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
  const storedQuote = parseOfferQuoteSnapshot(offer.priceSnapshotJson) as OfferQuote;
  const quote = applyCustomOfferPrice(
    {
      ...storedQuote,
      offeredItems: storedQuote.offeredItems.filter((item) =>
        requestedItems.some((requested) => requested.id === item.requestedItemId),
      ),
    },
    booking.quotedTotalCents,
  );
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
    quote,
    paidAmountCents: quote.totalCents - payment.openCents,
  });
  return {
    filename: `${booking.invoiceNumber}.pdf`,
    content,
    contentType: "application/pdf",
  };
}

function buildCompanyContactCardAttachment(db: AppDatabase, bookingId: number) {
  const booking = db.select({ location: bookings.location }).from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking) return null;

  const staff = db
    .select({ name: authUser.name, phone: authUser.whatsappPhone })
    .from(authUser)
    .where(or(eq(authUser.role, "admin"), eq(authUser.locationKey, booking.location)))
    .all();

  const staffPhones = staff
    .filter((person) => person.name.trim() && person.phone?.trim())
    .map((person) => ({ name: person.name, phone: person.phone! }));

  return {
    filename: contactCardFileName(),
    content: Buffer.from(companyToVCard(staffPhones), "utf8"),
    contentType: "text/vcard; charset=utf-8",
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
    const expiredLeaseCutoff = new Date(current.getTime() - LEASE_MS);
    // A crashed worker must not block the queue forever. The same transaction
    // both reclaims stale work and checks that no other worker is active.
    const expiredLease = and(eq(mailOutbox.status, "leased"), lte(mailOutbox.leasedAt, expiredLeaseCutoff));
    db.update(mailOutbox)
      .set({
        status: "cancelled",
        leasedAt: null,
        nextAttemptAt: current,
        lastError: "Maximale Versandversuche erreicht",
      })
      .where(and(expiredLease, gte(mailOutbox.attempts, MAX_MAIL_ATTEMPTS)))
      .run();
    db.update(mailOutbox)
      .set({ status: "cancelled", nextAttemptAt: current, lastError: "Maximale Versandversuche erreicht" })
      .where(and(eq(mailOutbox.status, "queued"), gte(mailOutbox.attempts, MAX_MAIL_ATTEMPTS)))
      .run();
    db.update(mailOutbox)
      .set({ status: "queued", leasedAt: null, nextAttemptAt: current })
      .where(and(expiredLease, lt(mailOutbox.attempts, MAX_MAIL_ATTEMPTS)))
      .run();
    const activeLease = db
      .select({ id: mailOutbox.id })
      .from(mailOutbox)
      .where(eq(mailOutbox.status, "leased"))
      .limit(1)
      .get();
    if (activeLease) return null;

    const due = and(
      or(
        and(eq(mailOutbox.status, "queued"), lt(mailOutbox.attempts, MAX_MAIL_ATTEMPTS)),
        and(
          eq(mailOutbox.status, "failed"),
          lt(mailOutbox.attempts, MAX_MAIL_ATTEMPTS),
          lte(mailOutbox.nextAttemptAt, current),
        ),
      ),
      lte(mailOutbox.nextAttemptAt, current),
    );
    const row = db
      .select()
      .from(mailOutbox)
      .where(due)
      .orderBy(asc(mailOutbox.createdAt), asc(mailOutbox.id))
      .limit(1)
      .get();
    if (!row || (mailId !== undefined && row.id !== mailId)) return null;
    db.update(mailOutbox)
      .set({ status: "leased", leasedAt: current, attempts: row.attempts + 1 })
      .where(eq(mailOutbox.id, row.id))
      .run();
    return { ...row, attempts: row.attempts + 1 };
  });
  if (!job) return null;
  try {
    if (!isAutomaticLocationRejectionDue(job, db)) {
      cancelSkippedAutomaticLocationRejection(db, job.id);
      return { id: job.id, status: "cancelled" as const };
    }
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
    const invoiceAttachment =
      job.kind === "booking_confirmed" ? await buildPaidBookingInvoiceAttachment(db, job.bookingId) : null;
    const contactCardAttachment = buildCompanyContactCardAttachment(db, job.bookingId);
    const attachments = [
      ...(contactCardAttachment ? [contactCardAttachment] : []),
      ...(invoiceAttachment ? [invoiceAttachment] : []),
    ];
    const sent = await sendConfiguredMail({
      account: usesRequestAccount(job.kind) ? "request" : "main",
      to: job.recipient,
      subject: job.subject,
      text: job.plainText,
      html: job.html ?? undefined,
      attachments: attachments.length ? attachments : undefined,
      inReplyTo: inReplyTo ?? undefined,
      references: referencesHeader ?? undefined,
    });
    if (!sent) throw new Error("Für den Versand ist kein Mailkonto eingerichtet. Prüfe die SMTP-Konfiguration.");
    let outboundMessageId: number | null = null;
    runInImmediateTransaction(db, () => {
      const sentAt = new Date();
      if (job.kind === AUTOMATIC_LOCATION_REJECTION_KIND) {
        const currentBooking = db.select().from(bookings).where(eq(bookings.id, job.bookingId)).get();
        if (
          currentBooking &&
          currentBooking.status === "inquiry_received" &&
          shouldAutomaticallyRejectLocation(currentBooking.source, currentBooking.location)
        ) {
          db.update(bookings)
            .set({ status: "rejected", version: currentBooking.version + 1, updatedAt: sentAt })
            .where(and(eq(bookings.id, currentBooking.id), eq(bookings.status, "inquiry_received")))
            .run();
          event(
            db,
            currentBooking.id,
            "booking_auto_rejected",
            "inquiry_received",
            "rejected",
            null,
            automaticLocationRejectionReason[currentBooking.communicationLocale],
            { location: currentBooking.location },
            sentAt,
          );
        }
      }
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
    const permanentlyAborted = job.attempts >= MAX_MAIL_ATTEMPTS;
    const retryInMs = Math.min(RETRY_CAP_MS, 1_000 * 2 ** Math.min(job.attempts, 12));
    runInImmediateTransaction(db, () =>
      db
        .update(mailOutbox)
        .set({
          status: permanentlyAborted ? "cancelled" : "failed",
          leasedAt: null,
          nextAttemptAt: permanentlyAborted ? new Date() : new Date(Date.now() + retryInMs),
          lastError: error instanceof Error ? error.message.slice(0, 500) : "unknown send failure",
        })
        .where(eq(mailOutbox.id, job.id))
        .run(),
    );
    return { id: job.id, status: permanentlyAborted ? ("cancelled" as const) : ("failed" as const) };
  }
}

export function releaseExpiredOutboxLeases(db: AppDatabase = getDatabase()) {
  const cutoff = new Date(Date.now() - LEASE_MS);
  const expiredLease = and(eq(mailOutbox.status, "leased"), lte(mailOutbox.leasedAt, cutoff));
  db.update(mailOutbox)
    .set({
      status: "cancelled",
      leasedAt: null,
      nextAttemptAt: new Date(),
      lastError: "Maximale Versandversuche erreicht",
    })
    .where(and(expiredLease, gte(mailOutbox.attempts, MAX_MAIL_ATTEMPTS)))
    .run();
  return db
    .update(mailOutbox)
    .set({ status: "queued", leasedAt: null, nextAttemptAt: new Date() })
    .where(and(expiredLease, lt(mailOutbox.attempts, MAX_MAIL_ATTEMPTS)))
    .run();
}

/** Makes a failed mail eligible for the next worker cycle without changing its history. */
export function retryFailedOutboxMail(db: AppDatabase = getDatabase(), mailId: number) {
  return (
    db
      .update(mailOutbox)
      .set({ status: "queued", leasedAt: null, nextAttemptAt: new Date(), lastError: null })
      .where(
        and(eq(mailOutbox.id, mailId), eq(mailOutbox.status, "failed"), lt(mailOutbox.attempts, MAX_MAIL_ATTEMPTS)),
      )
      .run().changes > 0
  );
}

/** Stops a queued or retryable mail before the next SMTP attempt. */
export function cancelOutboxMail(db: AppDatabase = getDatabase(), mailId: number) {
  return (
    db
      .update(mailOutbox)
      .set({
        status: "cancelled",
        leasedAt: null,
        nextAttemptAt: new Date(),
        lastError: "Versand manuell abgebrochen",
      })
      .where(and(eq(mailOutbox.id, mailId), or(eq(mailOutbox.status, "queued"), eq(mailOutbox.status, "failed"))))
      .run().changes > 0
  );
}

/** Marks a mail that exhausted all send attempts as reviewed by an admin. */
export function acknowledgeOutboxMail(db: AppDatabase = getDatabase(), mailId: number) {
  const acknowledgedAt = new Date();
  return (
    db
      .update(mailOutbox)
      .set({ status: "cancelled", leasedAt: null, acknowledgedAt })
      .where(
        and(
          eq(mailOutbox.id, mailId),
          gte(mailOutbox.attempts, MAX_MAIL_ATTEMPTS),
          or(eq(mailOutbox.status, "failed"), eq(mailOutbox.status, "cancelled")),
        ),
      )
      .run().changes > 0
  );
}
