import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "../../lib/db/client";
import { rentalInquiryBikes, rentalInquiries } from "../../lib/db/schema";
import { saveRentalInquiry } from "../../lib/inquiries/repository";
import type { ContactInquiry } from "../../lib/inquiries/schemas";

const validContact: ContactInquiry = {
  name: "Max Mustermann",
  contact: "max@example.com",
  phone: "+49 123456789",
  location: "munich",
  bikes: [
    {
      height: "180",
      bikeSize: "Endurace CF SL 8 - M",
      needsPedals: true,
      pedalType: "spdSl",
      needsComputerMount: true,
      computerMountType: "garmin",
      needsHelmet: true,
      needsClothing: false,
    },
    {
      height: "172",
      bikeSize: "Grail CF SL 7 - M",
      needsPedals: false,
      pedalType: "",
      needsComputerMount: false,
      computerMountType: "",
      needsHelmet: false,
      needsClothing: true,
    },
  ],
  periodFrom: "2026-07-20",
  periodTo: "2026-07-21",
  pickupTime: "10:00",
  dropoffTime: "16:00",
  message: "Bitte Verfügbarkeit bestätigen.",
  bikeTitle: "Rennrad",
  locale: "de",
  affiliateKey: "partner-42",
  website: "",
};

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function createTestDatabase() {
  const connection = createDatabaseConnection(":memory:");
  connections.push(connection);
  return connection;
}

describe("rental inquiry repository", () => {
  it("persists all request details and individual bikes in one transaction", () => {
    const { db } = createTestDatabase();
    const submittedAt = new Date("2026-07-17T10:00:00.000Z");

    saveRentalInquiry(db, validContact, "#20260717120000-deadbeef", submittedAt);

    const inquiry = db.select().from(rentalInquiries).get();
    const bikes = db.select().from(rentalInquiryBikes).orderBy(rentalInquiryBikes.position).all();
    expect(inquiry).toMatchObject({
      orderNumber: "#20260717120000-deadbeef",
      name: "Max Mustermann",
      email: "max@example.com",
      location: "munich",
      affiliateKey: "partner-42",
      mailStatus: "sent",
      mailSentAt: submittedAt,
      submittedAt,
    });
    expect(bikes).toEqual([
      expect.objectContaining({
        position: 1,
        heightCm: 180,
        needsPedals: true,
        pedalType: "spdSl",
        needsComputerMount: true,
        computerMountType: "garmin",
      }),
      expect.objectContaining({
        position: 2,
        heightCm: 172,
        needsPedals: false,
        pedalType: null,
        needsComputerMount: false,
        computerMountType: null,
        needsClothing: true,
      }),
    ]);
  });

  it("cascades bike records when a sent inquiry is removed", () => {
    const { db } = createTestDatabase();
    const orderNumber = "#20260717120000-deadbeef";
    saveRentalInquiry(db, validContact, orderNumber);

    db.delete(rentalInquiries).run();
    expect(db.select().from(rentalInquiryBikes).all()).toEqual([]);
  });
});
