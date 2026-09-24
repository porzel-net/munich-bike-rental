import { afterEach, describe, expect, it } from "vitest";
import { createDatabaseConnection } from "../../lib/db/client";
import { authUser, bookings, mailOutbox, whatsappNotificationOutbox } from "../../lib/db/schema";
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
        twoFactorEnabled: true,
        mustChangePassword: false,
        createdAt,
        updatedAt: createdAt,
      })
      .run();
    db.insert(authUser)
      .values({
        id: "munich-1",
        name: "München Team",
        email: "munich@example.com",
        role: "standortuser",
        locationKey: "munich",
        whatsappPhone: "+49 170 2222222",
        twoFactorEnabled: true,
        mustChangePassword: false,
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

    const jobs = db.select().from(whatsappNotificationOutbox).all();
    expect(jobs).toHaveLength(4);
    expect(jobs.filter((job) => job.recipientUserId === "admin-1")).toHaveLength(2);
    expect(jobs.filter((job) => job.recipientUserId === "munich-1")).toHaveLength(2);
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

  it("does not queue notifications for a banned user", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const createdAt = new Date("2026-08-27T09:00:00.000Z");

    db.insert(authUser)
      .values({
        id: "banned-1",
        name: "Banned User",
        email: "banned@example.com",
        role: "admin",
        whatsappPhone: "+49 170 9999999",
        twoFactorEnabled: true,
        mustChangePassword: false,
        banned: true,
        createdAt,
        updatedAt: createdAt,
      })
      .run();

    queueWhatsAppNotifications(db, createdAt);

    expect(db.select().from(whatsappNotificationOutbox).all()).toHaveLength(0);
  });

  it("notifies only admins when a mail is permanently aborted", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const createdAt = new Date("2026-08-27T09:00:00.000Z");
    for (const user of [
      {
        id: "admin-1",
        name: "Ada Admin",
        email: "ada@example.com",
        role: "admin" as const,
        locationKey: null,
        whatsappPhone: "+49 170 1234567",
      },
      {
        id: "regensburg-1",
        name: "Regensburg Team",
        email: "regensburg@example.com",
        role: "standortuser" as const,
        locationKey: "regensburg" as const,
        whatsappPhone: "+49 170 7654321",
      },
    ]) {
      db.insert(authUser)
        .values({ ...user, twoFactorEnabled: true, mustChangePassword: false, createdAt, updatedAt: createdAt })
        .run();
    }
    const booking = db
      .insert(bookings)
      .values({
        orderNumber: "#20260827100000",
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
        status: "offer_sent",
        quotedTotalCents: 10_000,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: bookings.id })
      .get();
    const mail = db
      .insert(mailOutbox)
      .values({
        bookingId: booking.id,
        idempotencyKey: "mail-failure:1",
        kind: "offer",
        locale: "de",
        recipient: "max@example.com",
        subject: "Angebot",
        plainText: "Angebot",
        status: "cancelled",
        attempts: 10,
        nextAttemptAt: createdAt,
        createdAt,
        lastError: "SMTP offline",
      })
      .returning({ id: mailOutbox.id })
      .get();

    queueWhatsAppNotifications(db, createdAt);

    const jobs = db
      .select()
      .from(whatsappNotificationOutbox)
      .all()
      .filter((job) => job.kind === "activity" && job.activityId === `mail-delivery-failed-${mail.id}`);
    expect(jobs).toHaveLength(1);
    expect(jobs.map((job) => job.recipientUserId)).toEqual(["admin-1"]);
    expect(jobs[0]?.messageText).toContain("E-Mail-Versand abgebrochen");
    expect(jobs[0]?.messageText).toContain("10/10");
  });
});
