import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  getServerSession: vi.fn(),
  hasTrustedOrigin: vi.fn(),
  canUseAdminApi: vi.fn(),
  canAccessLocation: vi.fn(),
  createBooking: vi.fn(),
  createDirectBooking: vi.fn(),
  createHistoricalBooking: vi.fn(),
  dispatchNextOutboxMail: vi.fn(),
}));

vi.mock("../../lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/db/client")>();
  return { ...actual, getDatabase: routeMocks.getDatabase };
});
vi.mock("../../lib/auth/session", () => ({
  getServerSession: routeMocks.getServerSession,
  canUseAdminApi: routeMocks.canUseAdminApi,
  canAccessLocation: routeMocks.canAccessLocation,
}));
vi.mock("@/lib/auth/request", () => ({ hasTrustedOrigin: routeMocks.hasTrustedOrigin }));
vi.mock("../../lib/bookings/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/bookings/service")>();
  return {
    ...actual,
    createBooking: routeMocks.createBooking,
    createDirectBooking: routeMocks.createDirectBooking,
    createHistoricalBooking: routeMocks.createHistoricalBooking,
  };
});
vi.mock("../../lib/bookings/outbox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/bookings/outbox")>();
  return { ...actual, dispatchNextOutboxMail: routeMocks.dispatchNextOutboxMail };
});

import { POST } from "../../app/api/admin/bookings/route";
import { createDatabaseConnection } from "../../lib/db/client";
import { bookings, mailOutbox } from "../../lib/db/schema";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function request(body: unknown) {
  return new Request("http://localhost:3000/api/admin/bookings", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin booking creation API", () => {
  beforeEach(() => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    routeMocks.getDatabase.mockReset();
    routeMocks.getDatabase.mockReturnValue(connection.db);
    routeMocks.getServerSession.mockReset();
    routeMocks.getServerSession.mockResolvedValue({ user: { id: "admin", role: "admin" } });
    routeMocks.hasTrustedOrigin.mockReset();
    routeMocks.hasTrustedOrigin.mockReturnValue(true);
    routeMocks.canUseAdminApi.mockReset();
    routeMocks.canUseAdminApi.mockReturnValue(true);
    routeMocks.canAccessLocation.mockReset();
    routeMocks.canAccessLocation.mockReturnValue(true);
    routeMocks.createBooking.mockReset();
    routeMocks.createDirectBooking.mockReset();
    routeMocks.createHistoricalBooking.mockReset();
    routeMocks.dispatchNextOutboxMail.mockReset();
    routeMocks.dispatchNextOutboxMail.mockResolvedValue({ status: "sent" });

    routeMocks.createDirectBooking.mockImplementation((db: typeof connection.db) => {
      const timestamp = new Date();
      const booking = db
        .insert(bookings)
        .values({
          orderNumber: "#20260816170000",
          customerName: "Ada Lovelace",
          customerEmail: "ada@example.com",
          customerPhone: "+491701234567",
          location: "munich",
          periodFrom: "2026-08-20",
          periodTo: "2026-08-21",
          pickupTime: "10:00",
          dropoffTime: "10:00",
          customerMessage: "",
          communicationLocale: "de",
          source: "manual",
          status: "confirmed",
          quotedTotalCents: 10_000,
          version: 2,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .returning({ id: bookings.id })
        .get();
      db.insert(mailOutbox)
        .values({
          bookingId: booking.id,
          idempotencyKey: `booking:${booking.id}:booking_confirmed`,
          kind: "booking_confirmed",
          locale: "de",
          recipient: "ada@example.com",
          subject: "Buchung bestätigt #20260816170000",
          plainText: "Deine Buchung ist bestätigt.",
          status: "queued",
          attempts: 0,
          nextAttemptAt: timestamp,
          createdAt: timestamp,
        })
        .run();
      return { id: booking.id, orderNumber: "#20260816170000" };
    });
  });

  it("dispatches a direct booking confirmation immediately", async () => {
    const response = await POST(
      request({
        mode: "direct",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+491701234567",
        location: "munich",
        periodFrom: "2026-08-20",
        periodTo: "2026-08-21",
        pickupTime: "10:00",
        dropoffTime: "10:00",
        message: "",
        locale: "de",
        quotedTotalCents: 10_000,
        requestedItems: [{ requestedLabel: "Endurace - M", heightCm: 175 }],
        assetsByPosition: { "1": 1 },
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { mailStatus: string };
    expect(body.mailStatus).toBe("sent");
    const mail = connectionMailOutbox(routeMocks.getDatabase());
    expect(routeMocks.dispatchNextOutboxMail).toHaveBeenCalledWith(routeMocks.getDatabase(), mail.id);
  });

  it("routes a historical booking to the completed-booking command without sending mail", async () => {
    routeMocks.createHistoricalBooking.mockReturnValue({ id: 7, orderNumber: "#20260816170001" });

    const response = await POST(
      request({
        mode: "historical",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+491701234567",
        location: "munich",
        periodFrom: "2026-08-01",
        periodTo: "2026-08-03",
        pickupTime: "10:00",
        dropoffTime: "17:00",
        message: "Nachgetragen",
        locale: "de",
        quotedTotalCents: 12_500,
        invoiceNumber: "YBR-2026-0001",
        requestedItems: [{ requestedLabel: "Endurace - M", heightCm: 175 }],
        assetsByPosition: { "1": 12 },
      }),
    );

    expect(response.status).toBe(201);
    expect(routeMocks.createHistoricalBooking).toHaveBeenCalledWith(
      routeMocks.getDatabase(),
      expect.objectContaining({
        periodFrom: "2026-08-01",
        quotedTotalCents: 12_500,
        invoiceNumber: "YBR-2026-0001",
        assetsByPosition: { 1: 12 },
      }),
    );
    expect(routeMocks.dispatchNextOutboxMail).not.toHaveBeenCalled();
  });
});

function connectionMailOutbox(db: ReturnType<typeof createDatabaseConnection>["db"]) {
  return db.select().from(mailOutbox).get()!;
}
