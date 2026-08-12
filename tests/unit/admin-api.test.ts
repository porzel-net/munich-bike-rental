import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const adminApiMocks = vi.hoisted(() => {
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
  const isCompletedAdmin = (user: typeof state.user) =>
    user.twoFactorEnabled === true && user.mustChangePassword !== true;
  const canUseAdminApi = (user: typeof state.user) =>
    isCompletedAdmin(user) && (user.role === "admin" || (user.role === "standortuser" && Boolean(user.locationKey)));
  return {
    state,
    getDatabase: vi.fn(),
    getServerSession: vi.fn(async () => ({ user: state.user })),
    hasTrustedOrigin: vi.fn(() => state.trustedOrigin),
    runInImmediateTransaction: vi.fn((_db: unknown, work: () => unknown) => work()),
    canUseAdminApi,
    canUseAdminApiAsAdmin: (user: typeof state.user) => canUseAdminApi(user) && user.role === "admin",
  };
});

vi.mock("../../lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/db/client")>();
  return {
    ...actual,
    getDatabase: adminApiMocks.getDatabase,
    runInImmediateTransaction: adminApiMocks.runInImmediateTransaction,
  };
});
vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/db/client")>();
  return {
    ...actual,
    getDatabase: adminApiMocks.getDatabase,
    runInImmediateTransaction: adminApiMocks.runInImmediateTransaction,
  };
});
vi.mock("../../lib/auth/session", () => ({
  getServerSession: adminApiMocks.getServerSession,
  canUseAdminApi: adminApiMocks.canUseAdminApi,
  canUseAdminApiAsAdmin: adminApiMocks.canUseAdminApiAsAdmin,
}));
vi.mock("@/lib/auth/session", () => ({
  getServerSession: adminApiMocks.getServerSession,
  canUseAdminApi: adminApiMocks.canUseAdminApi,
  canUseAdminApiAsAdmin: adminApiMocks.canUseAdminApiAsAdmin,
}));
vi.mock("../../lib/auth/request", () => ({ hasTrustedOrigin: adminApiMocks.hasTrustedOrigin }));
vi.mock("@/lib/auth/request", () => ({ hasTrustedOrigin: adminApiMocks.hasTrustedOrigin }));

import { POST as invitationPost } from "../../app/api/admin/invitations/route";
import { POST as usersPost, PATCH as usersPatch, DELETE as usersDelete } from "../../app/api/admin/users/route";
import {
  DELETE as inventoryDelete,
  PATCH as inventoryPatch,
  POST as inventoryPost,
} from "../../app/api/admin/inventory/route";
import { POST as financialTransactionPost } from "../../app/api/admin/financial/transactions/[id]/route";
import { POST as manualTransactionPost } from "../../app/api/admin/financial/transactions/manual/route";
import { PATCH as financialAccountPatch } from "../../app/api/admin/financial/accounts/[id]/route";
import { POST as depreciationPost } from "../../app/api/admin/financial/assets/depreciation/route";
import { POST as disposalPost } from "../../app/api/admin/financial/assets/disposal/route";
import {
  authInvitation,
  authUser,
  financialAccounts,
  financialCategories,
  financialTransactions,
  fixedAssets,
  rentalAssets,
  rentalLocationBikeSizes,
  rentalLocationBikes,
  rentalLocationEquipment,
} from "../../lib/db/schema";
import { createDatabaseConnection } from "../../lib/db/client";
import { hashInvitationToken } from "../../lib/auth/invitations";
import { seedRentalInventoryIfEmpty } from "../../lib/inventory/seed";
import { createFixedAsset } from "../../lib/financial/fixed-assets";
import { importLegacyInventoryIntoBookingInventory } from "../../lib/bookings/inventory-bootstrap";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];
let testDb: ReturnType<typeof createDatabaseConnection>["db"];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function request(path: string, method: string, body?: unknown) {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function setup() {
  const connection = createDatabaseConnection(":memory:");
  connections.push(connection);
  const { db } = connection;
  db.insert(authUser)
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
  seedRentalInventoryIfEmpty(db);
  testDb = db;
  adminApiMocks.getDatabase.mockReturnValue(db);
  adminApiMocks.state.trustedOrigin = true;
  adminApiMocks.state.user = {
    id: "admin",
    role: "admin",
    locationKey: null,
    twoFactorEnabled: true,
    mustChangePassword: false,
  };
  return db;
}

describe("admin inventory API", () => {
  beforeEach(() => setup());

  it("creates, updates and soft-deletes bikes and equipment", async () => {
    const db = testDb;
    const bikeResponse = await inventoryPost(
      request("/api/admin/inventory", "POST", {
        location: "munich",
        type: "bike",
        title: "Edge Bike",
        nickname: "Blitz",
        size: "M",
        frameNumber: "EDGE-1",
        priceCents: 4_500,
        discountTextDe: "10%\nNur im Mai",
        discountTextEn: "10%\nMay only",
        isAvailable: true,
      }),
    );
    expect(bikeResponse.status).toBe(201);
    const bikeBody = (await bikeResponse.json()) as { item: { id: number; bikeKey: string } };
    expect(bikeBody.item.bikeKey).toBe("edge-bike-m");
    expect(
      db
        .select()
        .from(rentalLocationBikeSizes)
        .where(eq(rentalLocationBikeSizes.locationBikeId, bikeBody.item.id))
        .all(),
    ).toHaveLength(1);
    expect(
      db
        .select({ de: rentalLocationBikes.discountTextDe, en: rentalLocationBikes.discountTextEn })
        .from(rentalLocationBikes)
        .where(eq(rentalLocationBikes.id, bikeBody.item.id))
        .get(),
    ).toEqual({ de: "10%\nNur im Mai", en: "10%\nMay only" });
    expect(
      db
        .select({ nickname: rentalLocationBikes.nickname })
        .from(rentalLocationBikes)
        .where(eq(rentalLocationBikes.id, bikeBody.item.id))
        .get(),
    ).toEqual({ nickname: "Blitz" });

    importLegacyInventoryIntoBookingInventory(db);
    expect(
      db
        .select({ nickname: rentalAssets.nickname, displayName: rentalAssets.displayName })
        .from(rentalAssets)
        .where(eq(rentalAssets.legacyLocationBikeId, bikeBody.item.id))
        .get(),
    ).toMatchObject({ nickname: "Blitz", displayName: "Edge Bike - M" });

    expect(
      (
        await inventoryPost(
          request("/api/admin/inventory", "POST", {
            location: "munich",
            type: "bike",
            title: "Edge Bike",
            size: "M",
            priceCents: 4_500,
            isAvailable: true,
          }),
        )
      ).status,
    ).toBe(409);

    expect(
      (
        await inventoryPatch(
          request("/api/admin/inventory", "PATCH", {
            id: bikeBody.item.id,
            location: "munich",
            type: "bike",
            title: "Edge Bike Updated",
            nickname: "Turbo",
            size: "L",
            frameNumber: "EDGE-2",
            priceCents: 5_000,
            isAvailable: true,
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      db.select().from(rentalLocationBikes).where(eq(rentalLocationBikes.id, bikeBody.item.id)).get(),
    ).toMatchObject({
      title: "Edge Bike Updated",
      nickname: "Turbo",
      frameNumber: "EDGE-2",
      priceCentsPerDay: 5_000,
      discountTextDe: "10%\nNur im Mai",
      discountTextEn: "10%\nMay only",
    });
    expect(
      db
        .select({ nickname: rentalAssets.nickname, displayName: rentalAssets.displayName })
        .from(rentalAssets)
        .where(eq(rentalAssets.legacyLocationBikeId, bikeBody.item.id))
        .get(),
    ).toMatchObject({ nickname: "Turbo", displayName: "Edge Bike Updated - L" });
    expect(
      db
        .select()
        .from(rentalLocationBikeSizes)
        .where(eq(rentalLocationBikeSizes.locationBikeId, bikeBody.item.id))
        .get(),
    ).toMatchObject({ size: "L", isAvailable: true });

    const equipmentResponse = await inventoryPost(
      request("/api/admin/inventory", "POST", {
        location: "munich",
        type: "equipment",
        category: "pedal",
        labelDe: "Edge Pedal",
        labelEn: "Edge Pedal",
        priceCents: 300,
        isAvailable: true,
      }),
    );
    expect(equipmentResponse.status).toBe(201);
    const equipmentBody = (await equipmentResponse.json()) as { item: { id: number; equipmentKey: string } };
    expect(equipmentBody.item.equipmentKey).toBe("pedal-edge-pedal");
    expect(
      (
        await inventoryDelete(
          request("/api/admin/inventory", "DELETE", {
            type: "bike",
            id: bikeBody.item.id,
            location: "munich",
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      db.select().from(rentalLocationBikes).where(eq(rentalLocationBikes.id, bikeBody.item.id)).get()?.isAvailable,
    ).toBe(false);
    expect(
      db.select().from(rentalLocationEquipment).where(eq(rentalLocationEquipment.id, equipmentBody.item.id)).get(),
    ).toBeDefined();
  });

  it("enforces origin, role setup and location scope", async () => {
    adminApiMocks.state.trustedOrigin = false;
    expect(
      (
        await inventoryPost(
          request("/api/admin/inventory", "POST", {
            location: "munich",
            type: "bike",
            title: "Blocked",
            size: "M",
            priceCents: 1_000,
            isAvailable: true,
          }),
        )
      ).status,
    ).toBe(401);

    adminApiMocks.state.trustedOrigin = true;
    adminApiMocks.state.user = {
      id: "standort",
      role: "standortuser",
      locationKey: "munich",
      twoFactorEnabled: true,
      mustChangePassword: false,
    };
    expect(
      (
        await inventoryPost(
          request("/api/admin/inventory", "POST", {
            location: "regensburg",
            type: "bike",
            title: "Wrong Location",
            size: "M",
            priceCents: 1_000,
            isAvailable: true,
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await inventoryPost(
          request("/api/admin/inventory", "POST", {
            location: "munich",
            type: "bike",
            title: "Allowed Location",
            size: "M",
            priceCents: 1_000,
            isAvailable: true,
          }),
        )
      ).status,
    ).toBe(201);
  });
});

describe("admin users and invitation APIs", () => {
  beforeEach(() => setup());

  it("creates an opaque invitation and persists only its hash", async () => {
    const response = await invitationPost(
      request("/api/admin/invitations", "POST", {
        name: "Standort Team",
        role: "standortuser",
        locationKey: "munich",
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { invitation: { link: string } };
    const token = body.invitation.link.split("/").at(-1)!;
    const invitation = testDb.select().from(authInvitation).get();
    expect(invitation).toMatchObject({ name: "Standort Team", role: "standortuser", locationKey: "munich" });
    expect(invitation?.tokenHash).toBe(hashInvitationToken(token));
    expect(invitation?.tokenHash).not.toContain(token);
  });

  it("rejects invalid role/location combinations and protects the admin account", async () => {
    expect(
      (
        await invitationPost(
          request("/api/admin/invitations", "POST", { name: "Bad Admin", role: "admin", locationKey: "munich" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await usersPost(
          request("/api/admin/users", "POST", { name: "Bad User", role: "standortuser", locationKey: null }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await usersPatch(
          request("/api/admin/users", "PATCH", { userId: "admin", role: "standortuser", locationKey: "munich" }),
        )
      )?.status,
    ).toBe(400);
    expect((await usersDelete(request("/api/admin/users", "DELETE", { userId: "admin" })))?.status).toBe(400);
  });

  it("changes and deletes another user while recording the audit trail", async () => {
    const db = testDb;
    db.insert(authUser)
      .values({
        id: "target",
        name: "Target",
        email: "target@example.com",
        role: "standortuser",
        locationKey: "munich",
        twoFactorEnabled: true,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const update = await usersPatch(
      request("/api/admin/users", "PATCH", { userId: "target", role: "admin", locationKey: null }),
    );
    if (!update) throw new Error("Users PATCH returned no response");
    expect(update.status).toBe(200);
    expect(db.select().from(authUser).where(eq(authUser.id, "target")).get()).toMatchObject({
      role: "admin",
      locationKey: null,
    });

    expect((await usersDelete(request("/api/admin/users", "DELETE", { userId: "target" })))?.status).toBe(204);
    expect(db.select().from(authUser).where(eq(authUser.id, "target")).get()).toBeUndefined();
  });

  it("does not let a setup-incomplete or non-admin user call admin-only APIs", async () => {
    adminApiMocks.state.user = {
      id: "local",
      role: "standortuser",
      locationKey: "munich",
      twoFactorEnabled: true,
      mustChangePassword: false,
    };
    expect(
      (
        await invitationPost(
          request("/api/admin/invitations", "POST", { name: "Nope", role: "standortuser", locationKey: "munich" }),
        )
      ).status,
    ).toBe(401);
    adminApiMocks.state.user.mustChangePassword = true;
    expect(
      (
        await usersPost(
          request("/api/admin/users", "POST", { name: "Nope", role: "standortuser", locationKey: "munich" }),
        )
      ).status,
    ).toBe(401);
  });
});

describe("admin financial APIs", () => {
  beforeEach(() => setup());

  it("posts and ignores transactions through the same admin endpoint", async () => {
    const db = testDb;
    const bank = db.select().from(financialAccounts).where(eq(financialAccounts.code, "cash_main")).get()!;
    const maintenance = db.select().from(financialCategories).where(eq(financialCategories.code, "maintenance")).get()!;
    const tx = db
      .insert(financialTransactions)
      .values({
        financialAccountId: bank.id,
        source: "cash",
        kind: "cash_expense",
        status: "needs_review",
        amountCents: -1_000,
        currency: "EUR",
        bookedAt: "2026-08-10",
        description: "Admin Finanztest",
        importedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .get();

    const posted = await financialTransactionPost(
      request(`/api/admin/financial/transactions/${tx.id}`, "POST", {
        action: "post",
        categoryId: maintenance.id,
        note: "Wartung",
      }),
      { params: Promise.resolve({ id: String(tx.id) }) },
    );
    expect(posted.status).toBe(200);
    expect(db.select().from(financialTransactions).where(eq(financialTransactions.id, tx.id)).get()?.status).toBe(
      "posted",
    );

    const ignoredTx = db
      .insert(financialTransactions)
      .values({
        financialAccountId: bank.id,
        source: "cash",
        kind: "cash_expense",
        status: "needs_review",
        amountCents: -500,
        currency: "EUR",
        bookedAt: "2026-08-10",
        description: "Doppelt",
        importedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .get();
    expect(
      (
        await financialTransactionPost(
          request(`/api/admin/financial/transactions/${ignoredTx.id}`, "POST", {
            action: "ignore",
            reason: "Doppelt importiert",
          }),
          { params: Promise.resolve({ id: String(ignoredTx.id) }) },
        )
      ).status,
    ).toBe(200);
    expect(
      db.select().from(financialTransactions).where(eq(financialTransactions.id, ignoredTx.id)).get()?.status,
    ).toBe("ignored");
  });

  it("rejects malformed financial requests and validates opening balances", async () => {
    const db = testDb;
    expect(
      (
        await financialTransactionPost(
          request("/api/admin/financial/transactions/not-a-number", "POST", { action: "ignore", reason: "x" }),
          { params: Promise.resolve({ id: "not-a-number" }) },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await manualTransactionPost(
          request("/api/admin/financial/transactions/manual", "POST", {
            source: "cash",
            bookedAt: "2026-02-30",
            amountCents: 1_000,
            categoryId: 1,
            description: "Ungültiges Datum",
          }),
        )
      ).status,
    ).toBe(400);

    const maintenance = db.select().from(financialCategories).where(eq(financialCategories.code, "maintenance")).get()!;
    const manual = await manualTransactionPost(
      request("/api/admin/financial/transactions/manual", "POST", {
        source: "cash",
        bookedAt: "2026-08-10",
        amountCents: 500,
        categoryId: maintenance.id,
        description: "Kleine Reparatur",
      }),
    );
    expect(manual.status).toBe(200);
    expect(
      db
        .select()
        .from(financialTransactions)
        .all()
        .some((row) => row.status === "posted"),
    ).toBe(true);

    const bank = db
      .insert(financialAccounts)
      .values({
        code: "opening_test_bank",
        name: "Opening-Test",
        type: "bank",
        currency: "EUR",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .get();
    expect(
      (
        await financialAccountPatch(
          request(`/api/admin/financial/accounts/${bank.id}`, "PATCH", {
            openingBalanceCents: 1_000,
            openingBalanceDate: "2026-02-30",
          }),
          { params: Promise.resolve({ id: String(bank.id) }) },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await financialAccountPatch(
          request(`/api/admin/financial/accounts/${bank.id}`, "PATCH", {
            openingBalanceCents: 1_000,
            openingBalanceDate: "2026-01-01",
          }),
          { params: Promise.resolve({ id: String(bank.id) }) },
        )
      ).status,
    ).toBe(200);
  });

  it("runs AfA through the admin API idempotently and disposes assets with validated dates", async () => {
    const db = testDb;
    const cash = db.select().from(financialAccounts).where(eq(financialAccounts.code, "cash_main")).get()!;
    const asset = createFixedAsset(db, {
      name: "Admin-API-Anlage",
      assetType: "bike",
      acquisitionDate: "2026-01-01",
      inServiceDate: "2026-01-01",
      acquisitionCostCents: 12_000,
      usefulLifeMonths: 12,
      createdByUserId: "admin",
    });

    expect(
      (await depreciationPost(request("/api/admin/financial/assets/depreciation", "POST", { throughMonth: "2026-01" })))
        .status,
    ).toBe(200);
    expect(
      (await depreciationPost(request("/api/admin/financial/assets/depreciation", "POST", { throughMonth: "2026-01" })))
        .status,
    ).toBe(200);
    expect(
      (await depreciationPost(request("/api/admin/financial/assets/depreciation", "POST", { throughMonth: "2026-13" })))
        .status,
    ).toBe(400);

    expect(
      (
        await disposalPost(
          request("/api/admin/financial/assets/disposal", "POST", {
            assetId: asset.id,
            financialAccountId: cash.id,
            disposedAt: "2026-02-30",
            disposalProceedsCents: 0,
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await disposalPost(
          request("/api/admin/financial/assets/disposal", "POST", {
            assetId: asset.id,
            financialAccountId: cash.id,
            disposedAt: "2026-02-01",
            disposalProceedsCents: 0,
          }),
        )
      ).status,
    ).toBe(200);
    expect(db.select().from(fixedAssets).where(eq(fixedAssets.id, asset.id)).get()?.status).toBe("disposed");
  });
});
