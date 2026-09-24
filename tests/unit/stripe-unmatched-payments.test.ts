import { afterEach, describe, expect, it } from "vitest";

import { getDashboardActivities } from "../../lib/dashboard/activities";
import { createDatabaseConnection } from "../../lib/db/client";
import { stripeUnmatchedPayments, authUser, whatsappNotificationOutbox } from "../../lib/db/schema";
import { recordUnmatchedStripePayment } from "../../lib/financial/stripe-unmatched-payment";
import { queueWhatsAppNotifications } from "../../lib/whatsapp/notifications";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

describe("unmatched Stripe payments", () => {
  it("keeps an unmatched payment as an urgent admin activity and notifies the admin once", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const detectedAt = new Date("2026-09-23T09:00:00.000Z");
    db.insert(authUser)
      .values({
        id: "admin-1",
        name: "Ada Admin",
        email: "ada@example.com",
        role: "admin",
        whatsappPhone: "+49 170 1234567",
        twoFactorEnabled: true,
        mustChangePassword: false,
        createdAt: detectedAt,
        updatedAt: detectedAt,
      })
      .run();

    const session = {
      id: "cs_unmatched_123",
      url: null,
      created: 1_790_154_000,
      payment_status: "paid",
      amount_total: 12_500,
      currency: "eur",
      customer_email: "customer@example.com",
      payment_intent: "pi_unmatched_123",
      metadata: {},
    };
    recordUnmatchedStripePayment(db, session, "Keine gültige Angebotsreferenz in der Stripe-Session.", detectedAt);
    recordUnmatchedStripePayment(db, session, "Keine gültige Angebotsreferenz in der Stripe-Session.", detectedAt);

    const activities = getDashboardActivities(db, { isAdmin: true, location: null });
    expect(activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "stripe_unmatched_payment",
          title: "Stripe-Zahlung ohne Buchungszuordnung",
          entityName: expect.stringContaining("125,00 €"),
          isUrgent: true,
        }),
      ]),
    );
    expect(db.select().from(stripeUnmatchedPayments).all()).toHaveLength(1);
    expect(getDashboardActivities(db, { isAdmin: false, location: "munich" })).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "stripe_unmatched_payment" })]),
    );

    queueWhatsAppNotifications(db, detectedAt);
    queueWhatsAppNotifications(db, new Date("2026-09-23T09:01:00.000Z"));

    const jobs = db.select().from(whatsappNotificationOutbox).all();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      kind: "activity",
      recipientUserId: "admin-1",
      activityId: "stripe-unmatched-payment-1",
    });
    expect(jobs[0]?.messageText).toContain("cs_unmatched_123");
    expect(jobs[0]?.messageText).toContain("125,00 €");
  });
});
