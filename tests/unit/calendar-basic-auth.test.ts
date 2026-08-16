import { afterEach, describe, expect, it } from "vitest";

import { authenticateCalendarRequest } from "../../lib/calendar/basic-auth";
import { calendarUsername } from "../../lib/calendar/account";
import { generateCarddavPassword, hashCarddavPassword } from "../../lib/carddav/auth";
import { createDatabaseConnection } from "../../lib/db/client";
import { authUser, calendarAccounts } from "../../lib/db/schema";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function request(username: string, password: string) {
  const authorization = Buffer.from(`${username}:${password}`).toString("base64");
  return new Request("https://example.com/api/calendar/feed.ics", {
    headers: { Authorization: `Basic ${authorization}` },
  });
}

async function setup() {
  const connection = createDatabaseConnection(":memory:");
  connections.push(connection);
  const password = generateCarddavPassword();
  const userId = "calendar-user";
  connection.db
    .insert(authUser)
    .values({
      id: userId,
      name: "Calendar User",
      email: "calendar@example.com",
      role: "admin",
      twoFactorEnabled: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  connection.db
    .insert(calendarAccounts)
    .values({
      userId,
      username: calendarUsername(userId),
      passwordHash: await hashCarddavPassword(password),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  return { db: connection.db, username: calendarUsername(userId), password };
}

describe("calendar Basic Auth", () => {
  it("accepts generated credentials without using environment passwords", async () => {
    const setupResult = await setup();
    await expect(
      authenticateCalendarRequest(request(setupResult.username, setupResult.password), setupResult.db),
    ).resolves.toMatchObject({ id: "calendar-user", role: "admin" });
  });

  it("rejects missing and invalid credentials", async () => {
    const setupResult = await setup();
    const missing = new Request("https://example.com/api/calendar/feed.ics");

    await expect(authenticateCalendarRequest(missing, setupResult.db)).resolves.toBeNull();
    await expect(
      authenticateCalendarRequest(request(setupResult.username, `${setupResult.password}x`), setupResult.db),
    ).resolves.toBeNull();
  });

  it("rejects revoked accounts and incomplete admin setup", async () => {
    const setupResult = await setup();
    setupResult.db.update(calendarAccounts).set({ enabled: false }).run();
    await expect(
      authenticateCalendarRequest(request(setupResult.username, setupResult.password), setupResult.db),
    ).resolves.toBeNull();
  });

  it("rejects banned, expired, and setup-incomplete users", async () => {
    const setupResult = await setup();
    setupResult.db.update(authUser).set({ banned: true }).run();
    await expect(
      authenticateCalendarRequest(request(setupResult.username, setupResult.password), setupResult.db),
    ).resolves.toBeNull();

    setupResult.db
      .update(authUser)
      .set({ banned: false, banExpires: new Date(Date.now() - 1_000) })
      .run();
    await expect(
      authenticateCalendarRequest(request(setupResult.username, setupResult.password), setupResult.db),
    ).resolves.toBeNull();

    setupResult.db.update(authUser).set({ banExpires: null, twoFactorEnabled: false }).run();
    await expect(
      authenticateCalendarRequest(request(setupResult.username, setupResult.password), setupResult.db),
    ).resolves.toBeNull();
  });

  it("accepts a location user only with a valid assigned location", async () => {
    const setupResult = await setup();
    setupResult.db.update(authUser).set({ role: "standortuser", locationKey: "munich" }).run();
    await expect(
      authenticateCalendarRequest(request(setupResult.username, setupResult.password), setupResult.db),
    ).resolves.toMatchObject({ role: "standortuser", locationKey: "munich" });

    setupResult.db.update(authUser).set({ locationKey: null }).run();
    await expect(
      authenticateCalendarRequest(request(setupResult.username, setupResult.password), setupResult.db),
    ).resolves.toBeNull();
  });
});
