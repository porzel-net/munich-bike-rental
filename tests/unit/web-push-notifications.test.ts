import { createECDH } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import { authUser, bookings, webPushNotificationOutbox, webPushSubscriptions } from "../../lib/db/schema";
import { queueWebPushNotifications } from "../../lib/web-push/notifications";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];
const originalEnvironment = {
  publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY,
  privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
  subject: process.env.WEB_PUSH_VAPID_SUBJECT,
};

afterEach(() => {
  while (connections.length) connections.pop()?.close();
  if (originalEnvironment.publicKey === undefined) delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  else process.env.WEB_PUSH_VAPID_PUBLIC_KEY = originalEnvironment.publicKey;
  if (originalEnvironment.privateKey === undefined) delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  else process.env.WEB_PUSH_VAPID_PRIVATE_KEY = originalEnvironment.privateKey;
  if (originalEnvironment.subject === undefined) delete process.env.WEB_PUSH_VAPID_SUBJECT;
  else process.env.WEB_PUSH_VAPID_SUBJECT = originalEnvironment.subject;
});

describe("Browser-Push-Aktivitätsbenachrichtigungen", () => {
  it("reiht eine Dashboard-Aktivität pro Gerät idempotent ein", () => {
    const vapid = createECDH("prime256v1");
    const vapidPublicKey = vapid.generateKeys();
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = vapidPublicKey.toString("base64url");
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = vapid.getPrivateKey().toString("base64url");
    process.env.WEB_PUSH_VAPID_SUBJECT = "mailto:test@example.com";

    const client = createECDH("prime256v1");
    const clientPublicKey = client.generateKeys();
    const createdAt = new Date("2026-08-27T09:00:00.000Z");
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;

    db.insert(authUser)
      .values({
        id: "admin-1",
        name: "Ada Admin",
        email: "ada@example.com",
        role: "admin",
        createdAt,
        updatedAt: createdAt,
      })
      .run();
    const booking = db
      .insert(bookings)
      .values({
        orderNumber: "#20260827090000",
        assignedUserId: "admin-1",
        customerName: "Max Mustermann",
        customerEmail: "max@example.com",
        customerPhone: "+49 170 7654321",
        location: "munich",
        periodFrom: "2026-08-30",
        periodTo: "2026-09-01",
        pickupTime: "10:00",
        dropoffTime: "10:00",
        customerMessage: "",
        communicationLocale: "de",
        source: "web",
        status: "inquiry_received",
        createdAt,
        updatedAt: createdAt,
      })
      .run();
    db.insert(webPushSubscriptions)
      .values({
        userId: "admin-1",
        endpoint: "https://push.example.test/subscription-1",
        p256dh: clientPublicKey.toString("base64url"),
        auth: Buffer.alloc(16, 7).toString("base64url"),
        createdAt,
        updatedAt: createdAt,
      })
      .run();

    queueWebPushNotifications(db, createdAt);
    queueWebPushNotifications(db, new Date(createdAt.getTime() + 60_000));

    const jobs = db
      .select()
      .from(webPushNotificationOutbox)
      .where(eq(webPushNotificationOutbox.activityId, `incoming-booking-${booking.lastInsertRowid}`))
      .all();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.body).toBe("Max Mustermann");
  });
});
