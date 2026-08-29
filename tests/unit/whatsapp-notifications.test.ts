import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import { authUser, bookings, whatsappNotificationOutbox } from "../../lib/db/schema";
import { queueWhatsAppNotifications } from "../../lib/whatsapp/notifications";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

describe("WhatsApp activity notifications", () => {
  it("queues a new activity and one daily summary idempotently", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const createdAt = new Date("2026-08-27T09:00:00.000Z");

    db.insert(authUser)
      .values({
        id: "admin-1",
        name: "Ada Admin",
        email: "ada@example.com",
        role: "admin",
        whatsappPhone: "+49 170 1234567",
        createdAt,
        updatedAt: createdAt,
      })
      .run();
    db.insert(bookings)
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

    queueWhatsAppNotifications(db, new Date("2026-08-27T10:00:00.000Z"));
    queueWhatsAppNotifications(db, new Date("2026-08-27T10:01:00.000Z"));

    const jobs = db
      .select()
      .from(whatsappNotificationOutbox)
      .where(eq(whatsappNotificationOutbox.recipientUserId, "admin-1"))
      .all();
    expect(jobs).toHaveLength(2);
    expect(jobs.some((job) => job.kind === "activity" && job.messageText.includes("Max Mustermann"))).toBe(true);
    expect(
      jobs.some(
        (job) =>
          job.kind === "daily_summary" &&
          job.messageText.includes("seit") &&
          job.messageText.includes("*_📋 Tagesübersicht offene Aktivitäten_*"),
      ),
    ).toBe(true);
  });
});
