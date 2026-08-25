import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import { bookingEvents, bookings } from "../../lib/db/schema";
import { getPendingBookingAttentionBookingIds } from "../../lib/bookings/pending-email-action";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

describe("booking attention indicator", () => {
  it("shows an expired offer until it has been acknowledged", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const expiredAt = new Date("2026-08-25T10:00:00.000Z");
    const booking = db
      .insert(bookings)
      .values({
        orderNumber: "#20260825100000",
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
        customerPhone: "+49",
        location: "munich",
        periodFrom: "2026-09-12",
        periodTo: "2026-09-14",
        pickupTime: "10:00",
        dropoffTime: "16:00",
        customerMessage: "",
        communicationLocale: "de",
        source: "web",
        status: "expired",
        quotedTotalCents: 100,
        createdAt: new Date("2026-08-23T10:00:00.000Z"),
        updatedAt: expiredAt,
      })
      .returning({ id: bookings.id })
      .get();
    db.insert(bookingEvents)
      .values({
        bookingId: booking.id,
        eventType: "offer_expired",
        fromStatus: "offer_sent",
        toStatus: "expired",
        reason: "Angebot nach 36 Stunden abgelaufen",
        occurredAt: expiredAt,
      })
      .run();

    expect(
      getPendingBookingAttentionBookingIds(db, [db.select().from(bookings).where(eq(bookings.id, booking.id)).get()!]),
    ).toEqual(new Set([booking.id]));

    db.insert(bookingEvents)
      .values({
        bookingId: booking.id,
        eventType: "booking_attention_acknowledged",
        fromStatus: "expired",
        toStatus: "expired",
        reason: "Kenntnis genommen",
        occurredAt: new Date("2026-08-25T10:01:00.000Z"),
      })
      .run();

    expect(
      getPendingBookingAttentionBookingIds(db, [db.select().from(bookings).where(eq(bookings.id, booking.id)).get()!]),
    ).toEqual(new Set());
  });
});
