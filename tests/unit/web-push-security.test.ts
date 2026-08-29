import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "../../lib/db/client";
import { authUser, webPushSubscriptions } from "../../lib/db/schema";
import { isAllowedWebPushEndpoint } from "../../lib/web-push/endpoint";
import { MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER, upsertWebPushSubscription } from "../../lib/web-push/subscriptions";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

describe("Web-Push-Sicherheitsprüfungen", () => {
  it("erlaubt nur HTTPS-Endpunkte bekannter Push-Dienste", () => {
    expect(isAllowedWebPushEndpoint("https://fcm.googleapis.com/fcm/send/subscription")).toBe(true);
    expect(isAllowedWebPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/subscription")).toBe(true);
    expect(isAllowedWebPushEndpoint("https://web.push.apple.com/subscription")).toBe(true);
    expect(isAllowedWebPushEndpoint("https://wns2.notify.windows.com/w/?token=subscription")).toBe(true);

    expect(isAllowedWebPushEndpoint("http://fcm.googleapis.com/fcm/send/subscription")).toBe(false);
    expect(isAllowedWebPushEndpoint("https://127.0.0.1:443/internal")).toBe(false);
    expect(isAllowedWebPushEndpoint("https://localhost/internal")).toBe(false);
    expect(isAllowedWebPushEndpoint("https://attacker.example/subscription")).toBe(false);
    expect(isAllowedWebPushEndpoint("https://fcm.googleapis.com:8443/subscription")).toBe(false);
    expect(isAllowedWebPushEndpoint("https://user:password@fcm.googleapis.com/subscription")).toBe(false);
    expect(isAllowedWebPushEndpoint("https://fcm.googleapis.com.evil.example/subscription")).toBe(false);
  });

  it("hält das Geräte-Limit transaktionssicher ein und aktualisiert bestehende Geräte", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const now = new Date("2026-08-29T10:00:00.000Z");
    db.insert(authUser)
      .values({
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    for (let index = 0; index < MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER; index += 1) {
      expect(
        upsertWebPushSubscription(
          {
            userId: "user-1",
            endpoint: `https://fcm.googleapis.com/fcm/send/${index}`,
            p256dh: `p256dh-${index}`,
            auth: `auth-${index}`,
            now,
          },
          db,
        ),
      ).toBe("created");
    }

    expect(
      upsertWebPushSubscription(
        {
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/overflow",
          p256dh: "p256dh-overflow",
          auth: "auth-overflow",
          now,
        },
        db,
      ),
    ).toBe("limit");

    expect(
      upsertWebPushSubscription(
        {
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/0",
          p256dh: "p256dh-updated",
          auth: "auth-updated",
          now: new Date(now.getTime() + 1_000),
        },
        db,
      ),
    ).toBe("updated");

    expect(
      db
        .select()
        .from(webPushSubscriptions)
        .all()
        .find((subscription) => subscription.endpoint.endsWith("/0")),
    ).toMatchObject({ p256dh: "p256dh-updated", auth: "auth-updated" });
  });

  it("übernimmt ein bereits registriertes Endpoint nicht für einen anderen Benutzer", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const now = new Date("2026-08-29T10:00:00.000Z");
    db.insert(authUser)
      .values([
        { id: "user-1", name: "User 1", email: "one@example.com", role: "admin", createdAt: now, updatedAt: now },
        { id: "user-2", name: "User 2", email: "two@example.com", role: "admin", createdAt: now, updatedAt: now },
      ])
      .run();
    const input = {
      endpoint: "https://fcm.googleapis.com/fcm/send/shared",
      p256dh: "p256dh-shared",
      auth: "auth-shared",
      now,
    };

    expect(upsertWebPushSubscription({ ...input, userId: "user-1" }, db)).toBe("created");
    expect(upsertWebPushSubscription({ ...input, userId: "user-2" }, db)).toBe("conflict");
    expect(db.select().from(webPushSubscriptions).all()).toHaveLength(1);
  });
});
