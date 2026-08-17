import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import { bookingEvents, bookingRequestedItems, bookings, mailOutbox } from "../../lib/db/schema";
import { createBooking } from "../../lib/bookings/service";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function input(submissionId: string) {
  return {
    customerName: "Ada Lovelace",
    customerEmail: "ada@example.com",
    customerPhone: "+49 170 1234567",
    location: "munich" as const,
    periodFrom: "2026-08-20",
    periodTo: "2026-08-21",
    pickupTime: "10:00",
    dropoffTime: "16:00",
    customerMessage: "Bitte Verfügbarkeit bestätigen.",
    communicationLocale: "de" as const,
    source: "web" as const,
    quotedTotalCents: 10_000,
    submissionId,
    requestedItems: [{ requestedLabel: "Endurace CF SL 8 - M", heightCm: 180 }],
  };
}

describe("public booking idempotency", () => {
  it("reuses the booking, number, link, event, and mail on a repeated submission", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);

    const first = createBooking(connection.db, input("6e7c76c0-9c9b-4c49-a7dd-3d2d4bcb5f2a"));
    const repeated = createBooking(connection.db, input("6e7c76c0-9c9b-4c49-a7dd-3d2d4bcb5f2a"));

    expect(repeated).toEqual(first);
    expect(connection.db.select().from(bookings).all()).toHaveLength(1);
    expect(connection.db.select().from(bookingRequestedItems).all()).toHaveLength(1);
    expect(connection.db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, first.id)).all()).toHaveLength(
      1,
    );
    const mails = connection.db.select().from(mailOutbox).where(eq(mailOutbox.bookingId, first.id)).all();
    expect(mails).toHaveLength(1);
    expect(mails[0]?.subject).toContain(first.orderNumber);
    expect(mails[0]?.plainText).toContain(first.orderNumber);
  });
});
