import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const mocks = vi.hoisted(() => {
  const state = {
    trustedOrigin: true,
    user: {
      id: "admin",
      role: "admin",
      locationKey: null as string | null,
      twoFactorEnabled: true,
      mustChangePassword: false,
    },
  };
  return {
    state,
    getDatabase: vi.fn(),
    getServerSession: vi.fn(async () => ({ user: state.user })),
    hasTrustedOrigin: vi.fn(() => state.trustedOrigin),
    canUseAdminApi: (user: typeof state.user) =>
      user.twoFactorEnabled === true &&
      user.mustChangePassword !== true &&
      (user.role === "admin" || (user.role === "standortuser" && Boolean(user.locationKey))),
    runInImmediateTransaction: vi.fn((_db: unknown, work: () => unknown) => work()),
  };
});

vi.mock("../../lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/db/client")>();
  return { ...actual, getDatabase: mocks.getDatabase, runInImmediateTransaction: mocks.runInImmediateTransaction };
});
vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...actual, getDatabase: mocks.getDatabase, runInImmediateTransaction: mocks.runInImmediateTransaction };
});
vi.mock("../../lib/auth/session", () => ({
  getServerSession: mocks.getServerSession,
  canUseAdminApi: mocks.canUseAdminApi,
}));
vi.mock("@/lib/auth/session", () => ({
  getServerSession: mocks.getServerSession,
  canUseAdminApi: mocks.canUseAdminApi,
}));
vi.mock("../../lib/auth/request", () => ({ hasTrustedOrigin: mocks.hasTrustedOrigin }));
vi.mock("@/lib/auth/request", () => ({ hasTrustedOrigin: mocks.hasTrustedOrigin }));

import {
  DELETE as calendarAccountDelete,
  GET as calendarAccountGet,
  POST as calendarAccountPost,
} from "../../app/api/admin/calendar-account/route";
import { authenticateCalendarRequest } from "../../lib/calendar/basic-auth";
import { createDatabaseConnection } from "../../lib/db/client";
import { authUser, calendarAccounts } from "../../lib/db/schema";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];
let testDb: ReturnType<typeof createDatabaseConnection>["db"];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function request(method: string) {
  return new Request(`http://localhost:3000/api/admin/calendar-account`, {
    method,
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
  });
}

function setup() {
  const connection = createDatabaseConnection(":memory:");
  connections.push(connection);
  connection.db
    .insert(authUser)
    .values({
      id: "admin",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      twoFactorEnabled: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  testDb = connection.db;
  mocks.state.trustedOrigin = true;
  mocks.state.user = {
    id: "admin",
    role: "admin",
    locationKey: null,
    twoFactorEnabled: true,
    mustChangePassword: false,
  };
  mocks.getDatabase.mockReturnValue(testDb);
}

function basicRequest(username: string, password: string) {
  return new Request("http://localhost:3000/api/calendar/feed.ics", {
    headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` },
  });
}

describe("calendar account API", () => {
  it("creates, rotates, exposes only metadata, and revokes credentials", async () => {
    setup();
    const firstResponse = await calendarAccountPost(request("POST"));
    if (!firstResponse) throw new Error("Calendar account POST returned no response");
    expect(firstResponse.status).toBe(201);
    const firstBody = (await firstResponse.json()) as { credentials: { username: string; password: string } };
    const firstAccount = testDb.select().from(calendarAccounts).where(eq(calendarAccounts.userId, "admin")).get();
    expect(firstAccount?.passwordHash).toMatch(/^scrypt-v1\$/);
    expect(firstAccount?.passwordHash).not.toContain(firstBody.credentials.password);
    await expect(
      authenticateCalendarRequest(basicRequest(firstBody.credentials.username, firstBody.credentials.password), testDb),
    ).resolves.toMatchObject({ id: "admin" });

    const metadataResponse = await calendarAccountGet(request("GET"));
    if (!metadataResponse) throw new Error("Calendar account GET returned no response");
    const metadata = (await metadataResponse.json()) as { account: Record<string, unknown> };
    expect(metadata.account).not.toHaveProperty("passwordHash");
    expect(metadata.account).not.toHaveProperty("password");

    const secondResponse = await calendarAccountPost(request("POST"));
    if (!secondResponse) throw new Error("Calendar account rotation returned no response");
    expect(secondResponse.status).toBe(200);
    const secondBody = (await secondResponse.json()) as { credentials: { username: string; password: string } };
    await expect(
      authenticateCalendarRequest(basicRequest(firstBody.credentials.username, firstBody.credentials.password), testDb),
    ).resolves.toBeNull();
    await expect(
      authenticateCalendarRequest(
        basicRequest(secondBody.credentials.username, secondBody.credentials.password),
        testDb,
      ),
    ).resolves.toMatchObject({ id: "admin" });

    const deleteResponse = await calendarAccountDelete(request("DELETE"));
    if (!deleteResponse) throw new Error("Calendar account DELETE returned no response");
    expect(deleteResponse.status).toBe(204);
    await expect(
      authenticateCalendarRequest(
        basicRequest(secondBody.credentials.username, secondBody.credentials.password),
        testDb,
      ),
    ).resolves.toBeNull();
  });

  it("rejects mutations without the trusted browser origin", async () => {
    setup();
    mocks.state.trustedOrigin = false;
    const response = await calendarAccountPost(request("POST"));
    if (!response) throw new Error("Calendar account POST returned no response");
    expect(response.status).toBe(403);
    expect(testDb.select().from(calendarAccounts).all()).toHaveLength(0);
  });
});
