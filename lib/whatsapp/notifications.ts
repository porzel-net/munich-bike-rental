import { createHash } from "node:crypto";

import { and, desc, eq, gt, lte, or } from "drizzle-orm";

import { getDatabase, runInImmediateTransaction, type AppDatabase } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import {
  bookingEvents,
  bookingRequestedItems,
  bookings,
  dashboardActivityDismissals,
  financialTransactions,
  whatsappNotificationOutbox,
  whatsappNotificationState,
} from "@/lib/db/schema";
import { BUSINESS_TIME_ZONE, berlinDateKey, formatDateOnly } from "@/lib/datetime";
import { getDashboardActivities, type DashboardActivity } from "@/lib/dashboard/activities";
import { rentalLocationLabels } from "@/lib/inquiries/catalog";

import { whatsappConnection } from "./connection";

const LEASE_MS = 60_000;
const RETRY_CAP_MS = 60 * 60 * 1_000;
const MAX_DRAIN_PER_CYCLE = 50;

type WhatsAppRecipient = { id: string; name: string; phone: string; role: string; locationKey: string | null };

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  return digits;
}

function recipientPhone(phone: string) {
  const normalized = normalizePhone(phone);
  return normalized.length >= 8 ? normalized : null;
}

function localTimeParts(value = new Date()) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: BUSINESS_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as { hour: string; minute: string };
}

function formatSince(timestamp: number | Date) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp instanceof Date ? timestamp : new Date(timestamp));
}

function activityFingerprint(activity: DashboardActivity) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        activity.id,
        activity.kind,
        activity.title,
        activity.entityName,
        activity.href,
        activity.occurredAt,
      ]),
    )
    .digest("hex")
    .slice(0, 24);
}

function activityBookingId(activityId: string) {
  const match = activityId.match(/^(?:expired-booking|paid-booking|incoming-booking)-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function activityFinancialTransactionId(activityId: string) {
  const match = activityId.match(/^bank-transaction-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function getRecipientsForActivity(db: AppDatabase, activity: DashboardActivity, users: WhatsAppRecipient[]) {
  const bookingId = activityBookingId(activity.id);
  if (bookingId) {
    const booking = db
      .select({ assignedUserId: bookings.assignedUserId, location: bookings.location })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .get();
    if (!booking) return [];
    // Assignment controls who may work on the booking, not who receives the
    // operational notification. Notify the complete responsible team for the
    // booking's location, including admins.
    return users.filter((user) => user.role === "admin" || user.locationKey === booking.location);
  }

  if (activityFinancialTransactionId(activity.id)) return users.filter((user) => user.role === "admin");
  return [];
}

function formatAmount(amountCents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amountCents / 100);
}

function bookingDetails(db: AppDatabase, bookingId: number) {
  const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking) return null;
  const requestedItems = db
    .select({ label: bookingRequestedItems.requestedLabel })
    .from(bookingRequestedItems)
    .where(eq(bookingRequestedItems.bookingId, bookingId))
    .orderBy(bookingRequestedItems.position)
    .all()
    .map((item) => item.label)
    .join(", ");
  const location =
    rentalLocationLabels.de[booking.location as keyof typeof rentalLocationLabels.de] ?? booking.location;
  return [
    `*Kunde:* ${booking.customerName}`,
    `*Auftrag:* ${booking.orderNumber}`,
    `*Standort:* ${location}`,
    `*Zeitraum:* ${formatDateOnly(booking.periodFrom)} – ${formatDateOnly(booking.periodTo)}`,
    `*Abholung:* ${booking.pickupTime}`,
    `*Rückgabe:* ${booking.dropoffTime}`,
    requestedItems ? `*Fahrräder:* ${requestedItems}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function activityMessage(db: AppDatabase, activity: DashboardActivity) {
  const origin = process.env.APP_ORIGIN?.trim() || process.env.SITE_URL?.trim();
  const link = origin ? `${origin.replace(/\/$/, "")}${activity.href}` : "";
  const bookingId = activityBookingId(activity.id);
  const details = bookingId ? bookingDetails(db, bookingId) : null;
  if (details) {
    const icon = activity.kind === "paid_booking" ? "💳" : activity.kind === "expired_booking" ? "⏰" : "🚨";
    return `${icon} *${activity.title}*\n\n${details}${link ? `\n\n${link}` : ""}`;
  }
  const transactionId = activityFinancialTransactionId(activity.id);
  if (transactionId) {
    const transaction = db
      .select({
        counterparty: financialTransactions.counterpartyNameSnapshot,
        description: financialTransactions.description,
        reference: financialTransactions.reference,
        amountCents: financialTransactions.amountCents,
        bookedAt: financialTransactions.bookedAt,
      })
      .from(financialTransactions)
      .where(eq(financialTransactions.id, transactionId))
      .get();
    if (transaction) {
      return `🏦 *${activity.title}*\n\n*Gegenpartei:* ${transaction.counterparty?.trim() || "Unbekannt"}\n*Betrag:* ${formatAmount(transaction.amountCents)}\n*Buchungsdatum:* ${formatDateOnly(transaction.bookedAt)}\n*Verwendungszweck:* ${transaction.description?.trim() || transaction.reference?.trim() || "–"}${link ? `\n\n${link}` : ""}`;
    }
  }
  return `🚨 *${activity.title}*\n\n*Eintrag:* ${activity.entityName}${link ? `\n\n${link}` : ""}`;
}

function bookingEventMessage(
  booking: { customerName: string; orderNumber: string; id: number },
  event: typeof bookingEvents.$inferSelect,
) {
  const status = event.toStatus?.replaceAll("_", " ");
  const reason = event.reason?.trim();
  const origin = process.env.APP_ORIGIN?.trim() || process.env.SITE_URL?.trim();
  const link = origin ? `${origin.replace(/\/$/, "")}/admin/bookings/${booking.id}` : "";
  return `🔔 *Buchung aktualisiert*\n\n*Kunde:* ${booking.customerName}\n*Auftrag:* ${booking.orderNumber}\n${status ? `*Status:* ${status}\n` : ""}${reason ? `*Hinweis:* ${reason}\n` : ""}${link}`.trim();
}

function enqueue(
  db: AppDatabase,
  input: {
    recipient: WhatsAppRecipient;
    kind: string;
    activityId?: string;
    idempotencyKey: string;
    messageText: string;
    createdAt: Date;
  },
) {
  db.insert(whatsappNotificationOutbox)
    .values({
      recipientUserId: input.recipient.id,
      phone: input.recipient.phone,
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      activityId: input.activityId ?? null,
      messageText: input.messageText,
      status: "queued",
      attempts: 0,
      nextAttemptAt: input.createdAt,
      createdAt: input.createdAt,
    })
    .onConflictDoNothing()
    .run();
}

function getUsersWithWhatsApp(db: AppDatabase) {
  return db
    .select({
      id: authUser.id,
      name: authUser.name,
      phone: authUser.whatsappPhone,
      role: authUser.role,
      locationKey: authUser.locationKey,
    })
    .from(authUser)
    .all()
    .flatMap((user) => {
      const phone = user.phone ? recipientPhone(user.phone) : null;
      return phone ? [{ ...user, phone }] : [];
    });
}

function queueDailySummaries(db: AppDatabase, users: WhatsAppRecipient[], activities: DashboardActivity[], now: Date) {
  const { hour } = localTimeParts(now);
  if (Number(hour) < 12) return;
  const dateKey = berlinDateKey(now);

  for (const user of users) {
    const dismissed = new Set(
      db
        .select({ activityId: dashboardActivityDismissals.activityId })
        .from(dashboardActivityDismissals)
        .where(eq(dashboardActivityDismissals.userId, user.id))
        .all()
        .map((row) => row.activityId),
    );
    const openActivities = activities
      .filter((activity) => !dismissed.has(activity.id) && getRecipientsForActivity(db, activity, [user]).length > 0)
      .sort((left, right) => left.occurredAt - right.occurredAt);
    const lines = openActivities.length
      ? openActivities.map(
          (activity, index) =>
            `${index + 1}. *${activity.title}*\n   ${activity.entityName}\n   _Meldung vorhanden seit:_ ${formatSince(activity.occurredAt)}`,
        )
      : ["Keine offenen Aktivitäten."];
    const message = `*_📋 Tagesübersicht offene Aktivitäten_*\n\n*Datum:* ${dateKey}\n*Anzahl:* ${openActivities.length}\n\n${lines.join("\n\n")}`;
    enqueue(db, {
      recipient: user,
      kind: "daily_summary",
      idempotencyKey: `daily-summary:${user.id}:${user.phone}:${dateKey}`,
      messageText: message,
      createdAt: now,
    });
  }
}

function queueNewBookingEvents(db: AppDatabase, users: WhatsAppRecipient[], now: Date) {
  const currentState = db.select().from(whatsappNotificationState).where(eq(whatsappNotificationState.id, 1)).get();
  const newestEventId =
    db.select({ id: bookingEvents.id }).from(bookingEvents).orderBy(desc(bookingEvents.id)).get()?.id ?? 0;
  if (!currentState) {
    db.insert(whatsappNotificationState).values({ id: 1, lastBookingEventId: newestEventId, initializedAt: now }).run();
    return;
  }

  const events = db
    .select()
    .from(bookingEvents)
    .where(gt(bookingEvents.id, currentState.lastBookingEventId))
    .orderBy(bookingEvents.id)
    .all();
  for (const event of events) {
    if (
      [
        "booking_created",
        "booking_attention_acknowledged",
        "email_questions_resolved",
        "email_questions_reopened",
      ].includes(event.eventType)
    )
      continue;
    const booking = db
      .select({
        id: bookings.id,
        customerName: bookings.customerName,
        orderNumber: bookings.orderNumber,
        assignedUserId: bookings.assignedUserId,
        location: bookings.location,
      })
      .from(bookings)
      .where(eq(bookings.id, event.bookingId))
      .get();
    if (!booking) continue;
    const recipients = users.filter((user) => user.role === "admin" || user.locationKey === booking.location);
    for (const recipient of recipients) {
      enqueue(db, {
        recipient,
        kind: "booking_event",
        idempotencyKey: `booking-event:${event.id}:${recipient.id}:${recipient.phone}`,
        messageText: bookingEventMessage(booking, event),
        createdAt: now,
      });
    }
  }
  db.update(whatsappNotificationState)
    .set({ lastBookingEventId: newestEventId })
    .where(eq(whatsappNotificationState.id, 1))
    .run();
}

/** Finds newly visible/changed dashboard activities and queues WhatsApp messages. */
export function queueWhatsAppNotifications(db: AppDatabase = getDatabase(), now = new Date()) {
  return runInImmediateTransaction(db, () => {
    const users = getUsersWithWhatsApp(db);
    const activities = getDashboardActivities(db, { isAdmin: true, location: null });
    for (const activity of activities) {
      const fingerprint = activityFingerprint(activity);
      for (const recipient of getRecipientsForActivity(db, activity, users)) {
        enqueue(db, {
          recipient,
          kind: "activity",
          activityId: activity.id,
          idempotencyKey: `activity:${activity.id}:${fingerprint}:${recipient.id}:${recipient.phone}`,
          messageText: activityMessage(db, activity),
          createdAt: now,
        });
      }
    }
    queueNewBookingEvents(db, users, now);
    queueDailySummaries(db, users, activities, now);
    return { activities: activities.length, recipients: users.length };
  });
}

export function releaseExpiredWhatsAppLeases(db: AppDatabase = getDatabase()) {
  const cutoff = new Date(Date.now() - LEASE_MS);
  return db
    .update(whatsappNotificationOutbox)
    .set({ status: "queued", leasedAt: null, nextAttemptAt: new Date() })
    .where(and(eq(whatsappNotificationOutbox.status, "leased"), lte(whatsappNotificationOutbox.leasedAt, cutoff)))
    .run();
}

export async function dispatchNextWhatsAppNotification(db: AppDatabase = getDatabase(), notificationId?: number) {
  const job = runInImmediateTransaction(db, () => {
    const current = new Date();
    const due = and(
      or(
        eq(whatsappNotificationOutbox.status, "queued"),
        and(eq(whatsappNotificationOutbox.status, "failed"), lte(whatsappNotificationOutbox.nextAttemptAt, current)),
      ),
      lte(whatsappNotificationOutbox.nextAttemptAt, current),
    );
    const row = db
      .select()
      .from(whatsappNotificationOutbox)
      .where(notificationId ? and(eq(whatsappNotificationOutbox.id, notificationId), due) : due)
      .orderBy(whatsappNotificationOutbox.nextAttemptAt, whatsappNotificationOutbox.id)
      .limit(1)
      .get();
    if (!row) return null;
    db.update(whatsappNotificationOutbox)
      .set({ status: "leased", leasedAt: current, attempts: row.attempts + 1 })
      .where(eq(whatsappNotificationOutbox.id, row.id))
      .run();
    return { ...row, attempts: row.attempts + 1 };
  });
  if (!job) return null;

  try {
    await whatsappConnection.sendTextMessage(job.phone, job.messageText);
    db.update(whatsappNotificationOutbox)
      .set({ status: "sent", sentAt: new Date(), leasedAt: null, lastError: null })
      .where(and(eq(whatsappNotificationOutbox.id, job.id), eq(whatsappNotificationOutbox.status, "leased")))
      .run();
    return { id: job.id, status: "sent" as const };
  } catch (error) {
    const retryInMs = Math.min(RETRY_CAP_MS, 1_000 * 2 ** Math.min(job.attempts, 12));
    db.update(whatsappNotificationOutbox)
      .set({
        status: "failed",
        leasedAt: null,
        nextAttemptAt: new Date(Date.now() + retryInMs),
        lastError: error instanceof Error ? error.message.slice(0, 500) : "unknown send failure",
      })
      .where(and(eq(whatsappNotificationOutbox.id, job.id), eq(whatsappNotificationOutbox.status, "leased")))
      .run();
    return { id: job.id, status: "failed" as const };
  }
}

export async function runWhatsAppNotificationCycle(db: AppDatabase = getDatabase()) {
  if (["idle", "logged_out", "error"].includes(whatsappConnection.getSnapshot().status)) {
    await whatsappConnection.start().catch(() => undefined);
  }
  const queued = queueWhatsAppNotifications(db);
  releaseExpiredWhatsAppLeases(db);
  const results = [];
  for (let index = 0; index < MAX_DRAIN_PER_CYCLE; index += 1) {
    const result = await dispatchNextWhatsAppNotification(db);
    if (!result) break;
    results.push(result);
  }
  return {
    ...queued,
    dispatched: results.length,
    failed: results.filter((result) => result.status === "failed").length,
  };
}
