import { eq } from "drizzle-orm";

import { getDatabase, runInImmediateTransaction, type AppDatabase } from "@/lib/db/client";
import { webPushSubscriptions } from "@/lib/db/schema";

export const MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER = 10;

export type WebPushSubscriptionInput = {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  now?: Date;
};

export type WebPushSubscriptionUpsertResult = "created" | "updated" | "conflict" | "limit";

/**
 * Upserts one device subscription while keeping the per-user device count
 * bounded. The immediate transaction also prevents concurrent requests from
 * racing past the limit.
 */
export function upsertWebPushSubscription(
  input: WebPushSubscriptionInput,
  db: AppDatabase = getDatabase(),
): WebPushSubscriptionUpsertResult {
  const now = input.now ?? new Date();
  return runInImmediateTransaction(db, () => {
    const existing = db
      .select({ id: webPushSubscriptions.id, userId: webPushSubscriptions.userId })
      .from(webPushSubscriptions)
      .where(eq(webPushSubscriptions.endpoint, input.endpoint))
      .get();

    if (existing && existing.userId !== input.userId) return "conflict";

    if (existing) {
      db.update(webPushSubscriptions)
        .set({ p256dh: input.p256dh, auth: input.auth, updatedAt: now })
        .where(eq(webPushSubscriptions.id, existing.id))
        .run();
      return "updated";
    }

    const currentCount = db
      .select({ id: webPushSubscriptions.id })
      .from(webPushSubscriptions)
      .where(eq(webPushSubscriptions.userId, input.userId))
      .all().length;
    if (currentCount >= MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER) return "limit";

    db.insert(webPushSubscriptions)
      .values({
        userId: input.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return "created";
  });
}
