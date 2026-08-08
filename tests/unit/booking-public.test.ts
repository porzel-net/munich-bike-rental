import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import { communicationMessages, mailOutbox } from "../../lib/db/schema";
import { getPublicBookingByToken, getPublicBookingContactEmail } from "../../lib/bookings/public";
import { createBooking } from "../../lib/bookings/service";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

describe("public booking link", () => {
  it("puts a durable status link into the initial customer confirmation", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);

    const created = createBooking(connection.db, {
      customerName: "Test Kunde",
      customerEmail: "test@example.com",
      customerPhone: "11111111111",
      location: "munich",
      periodFrom: "2027-02-03",
      periodTo: "2027-02-04",
      pickupTime: "20:00",
      dropoffTime: "12:00",
      customerMessage: "Ich würde gerne ein Bike reservieren.",
      communicationLocale: "de",
      source: "web",
      quotedTotalCents: 10_620,
      requestedItems: [{ requestedLabel: "Endurace CF SL 8 - S", heightCm: 180 }],
      outbox: {
        recipient: "hallo@example.com",
        subject: "Neue Bike-Anfrage {{orderNumber}}",
        plainText: "Neue Anfrage {{orderNumber}}",
        kind: "new_inquiry",
      },
    });

    const confirmation = connection.db.select().from(mailOutbox).where(eq(mailOutbox.kind, "inquiry_received")).get();
    const token = confirmation?.plainText.match(/\/angebot\/([A-Za-z0-9]+)/)?.[1];

    expect(confirmation?.recipient).toBe("test@example.com, hallo@munich-bike-rental.de");
    expect(confirmation?.plainText).toContain("Status: Anfrage eingegangen");
    expect(
      connection.db.select().from(communicationMessages).where(eq(communicationMessages.bookingId, created.id)).all(),
    ).toHaveLength(0);
    expect(token).toBeTruthy();
    const publicBooking = getPublicBookingByToken(connection.db, token!);
    expect(publicBooking).toMatchObject({
      offerId: null,
      totalCents: 10_620,
      booking: {
        id: created.id,
        orderNumber: created.orderNumber,
        status: "inquiry_received",
      },
    });
    expect(publicBooking?.booking).not.toHaveProperty("email");
    expect(publicBooking?.booking).not.toHaveProperty("phone");
    expect(publicBooking?.booking).not.toHaveProperty("message");
    expect(getPublicBookingContactEmail(connection.db, token!)).toBe("test@example.com");
  });
});
