import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, lte, or } from "drizzle-orm";

import { getDatabase, runInImmediateTransaction, type AppDatabase } from "@/lib/db/client";
import {
  authUser,
  bookings,
  dashboardActivityDismissals,
  webPushNotificationOutbox,
  webPushSubscriptions,
} from "@/lib/db/schema";
import { getDashboardActivities, type DashboardActivity } from "@/lib/dashboard/activities";

import { isWebPushConfigured, sendWebPushNotification, WebPushEndpointGoneError } from "./client";

const LEASE_MS = 60_000;
const RETRY_CAP_MS = 60 * 60 * 1_000;
const MAX_DRAIN_PER_CYCLE = 50;

type PushSubscriptionRow = {
  id: number;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  role: string;
  locationKey: string | null;
};

function activityBookingId(activityId: string) {
  const match = activityId.match(/^(?:expired-booking|paid-booking|incoming-booking)-([0-9]+)$/);
  return match ? Number(match[1]) : null;
}

function activityFinancialTransactionId(activityId: string) {
  const match = activityId.match(/^bank-transaction-([0-9]+)$/);
  return match ? Number(match[1]) : null;
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

function recipientsForActivity(db: AppDatabase, activity: DashboardActivity, subscriptions: PushSubscriptionRow[]) {
  const bookingId = activityBookingId(activity.id);
  if (bookingId) {
    const booking = db
      .select({ assignedUserId: bookings.assignedUserId, location: bookings.location })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .get();
    if (!booking) return [];
    if (booking.assignedUserId)
      return subscriptions.filter((subscription) => subscription.userId === booking.assignedUserId);
    return subscriptions.filter(
      (subscription) => subscription.role === "admin" || subscription.locationKey === booking.location,
    );
  }
  if (activityFinancialTransactionId(activity.id))
    return subscriptions.filter((subscription) => subscription.role === "admin");
  return [];
}

function subscriptionPayload(subscription: Pick<PushSubscriptionRow, "endpoint" | "p256dh" | "auth">) {
  return {
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
  };
}

/** Finds dashboard activities and queues one browser notification per device. */
export function queueWebPushNotifications(db: AppDatabase = getDatabase(), now = new Date()) {
  if (!isWebPushConfigured()) return { activities: 0, subscriptions: 0, queued: 0 };
  return runInImmediateTransaction(db, () => {
    const subscriptions = db
      .select({
        id: webPushSubscriptions.id,
        userId: webPushSubscriptions.userId,
        endpoint: webPushSubscriptions.endpoint,
        p256dh: webPushSubscriptions.p256dh,
        auth: webPushSubscriptions.auth,
        role: authUser.role,
        locationKey: authUser.locationKey,
      })
      .from(webPushSubscriptions)
      .innerJoin(authUser, eq(webPushSubscriptions.userId, authUser.id))
      .all();
    const activities = getDashboardActivities(db, { isAdmin: true, location: null });
    const dismissedByUser = new Map<string, Set<string>>();
    const userIds = [...new Set(subscriptions.map((subscription) => subscription.userId))];
    if (userIds.length > 0) {
      for (const dismissal of db
        .select({ userId: dashboardActivityDismissals.userId, activityId: dashboardActivityDismissals.activityId })
        .from(dashboardActivityDismissals)
        .where(inArray(dashboardActivityDismissals.userId, userIds))
        .all()) {
        const dismissed = dismissedByUser.get(dismissal.userId) ?? new Set<string>();
        dismissed.add(dismissal.activityId);
        dismissedByUser.set(dismissal.userId, dismissed);
      }
    }
    let queued = 0;
    for (const activity of activities) {
      const fingerprint = activityFingerprint(activity);
      for (const subscription of recipientsForActivity(db, activity, subscriptions)) {
        if (dismissedByUser.get(subscription.userId)?.has(activity.id)) continue;
        const result = db
          .insert(webPushNotificationOutbox)
          .values({
            subscriptionId: subscription.id,
            activityId: activity.id,
            idempotencyKey: `activity:${activity.id}:${fingerprint}:${subscription.id}`,
            title: activity.title,
            body: activity.entityName,
            href: activity.href,
            tag: `dashboard-${activity.id}`,
            status: "queued",
            attempts: 0,
            nextAttemptAt: now,
            createdAt: now,
          })
          .onConflictDoNothing({ target: webPushNotificationOutbox.idempotencyKey })
          .run();
        queued += result.changes;
      }
    }
    return { activities: activities.length, subscriptions: subscriptions.length, queued };
  });
}

export function releaseExpiredWebPushLeases(db: AppDatabase = getDatabase()) {
  const cutoff = new Date(Date.now() - LEASE_MS);
  return db
    .update(webPushNotificationOutbox)
    .set({ status: "queued", leasedAt: null, nextAttemptAt: new Date() })
    .where(and(eq(webPushNotificationOutbox.status, "leased"), lte(webPushNotificationOutbox.leasedAt, cutoff)))
    .run();
}

export async function dispatchNextWebPushNotification(db: AppDatabase = getDatabase()) {
  const job = runInImmediateTransaction(db, () => {
    const current = new Date();
    const due = and(
      or(
        eq(webPushNotificationOutbox.status, "queued"),
        and(eq(webPushNotificationOutbox.status, "failed"), lte(webPushNotificationOutbox.nextAttemptAt, current)),
      ),
      lte(webPushNotificationOutbox.nextAttemptAt, current),
    );
    const row = db
      .select()
      .from(webPushNotificationOutbox)
      .where(due)
      .orderBy(desc(webPushNotificationOutbox.createdAt), asc(webPushNotificationOutbox.id))
      .limit(1)
      .get();
    if (!row) return null;
    db.update(webPushNotificationOutbox)
      .set({ status: "leased", leasedAt: current, attempts: row.attempts + 1 })
      .where(eq(webPushNotificationOutbox.id, row.id))
      .run();
    return { ...row, attempts: row.attempts + 1 };
  });
  if (!job) return null;

  const subscription = db
    .select()
    .from(webPushSubscriptions)
    .where(eq(webPushSubscriptions.id, job.subscriptionId))
    .get();
  if (!subscription) return { id: job.id, status: "discarded" as const };

  try {
    await sendWebPushNotification(
      subscriptionPayload(subscription),
      JSON.stringify({
        title: job.title,
        body: job.body,
        url: job.href,
        tag: job.tag,
      }),
    );
    db.update(webPushNotificationOutbox)
      .set({ status: "sent", sentAt: new Date(), leasedAt: null, lastError: null })
      .where(and(eq(webPushNotificationOutbox.id, job.id), eq(webPushNotificationOutbox.status, "leased")))
      .run();
    return { id: job.id, status: "sent" as const };
  } catch (error) {
    if (error instanceof WebPushEndpointGoneError) {
      db.delete(webPushSubscriptions).where(eq(webPushSubscriptions.id, subscription.id)).run();
      return { id: job.id, status: "removed" as const };
    }
    const retryInMs = Math.min(RETRY_CAP_MS, 1_000 * 2 ** Math.min(job.attempts, 12));
    db.update(webPushNotificationOutbox)
      .set({
        status: "failed",
        leasedAt: null,
        nextAttemptAt: new Date(Date.now() + retryInMs),
        lastError: error instanceof Error ? error.message.slice(0, 500) : "unknown send failure",
      })
      .where(and(eq(webPushNotificationOutbox.id, job.id), eq(webPushNotificationOutbox.status, "leased")))
      .run();
    return { id: job.id, status: "failed" as const };
  }
}

export async function runWebPushNotificationCycle(db: AppDatabase = getDatabase()) {
  if (!isWebPushConfigured()) return { activities: 0, subscriptions: 0, queued: 0, dispatched: 0, failed: 0 };
  const queued = queueWebPushNotifications(db);
  releaseExpiredWebPushLeases(db);
  const results: Array<{ status: string }> = [];
  for (let index = 0; index < MAX_DRAIN_PER_CYCLE; index += 1) {
    const result = await dispatchNextWebPushNotification(db);
    if (!result) break;
    results.push(result);
  }
  return {
    ...queued,
    dispatched: results.length,
    failed: results.filter((result) => result.status === "failed").length,
  };
}
