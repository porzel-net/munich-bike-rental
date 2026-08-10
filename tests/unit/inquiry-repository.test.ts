import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "../../lib/db/client";
import {
  accountingRevenues,
  rentalBookingConfirmationTokens,
  rentalInquiryBikes,
  rentalInquiries,
} from "../../lib/db/schema";
import { createBookingConfirmationToken, expirePendingBookingConfirmations } from "../../lib/inquiries/confirmation";
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
      needsBikepackingBag: false,
      needsGlasses: false,
      bottleHolderIncluded: true,
      repairKitIncluded: true,
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
      needsBikepackingBag: false,
      needsGlasses: false,
      bottleHolderIncluded: true,
      repairKitIncluded: true,
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

    saveRentalInquiry(db, validContact, "#20260717120000", 12_345, submittedAt);

    const inquiry = db.select().from(rentalInquiries).get();
    const bikes = db.select().from(rentalInquiryBikes).orderBy(rentalInquiryBikes.position).all();
    expect(inquiry).toMatchObject({
      orderNumber: "#20260717120000",
      name: "Max Mustermann",
      email: "max@example.com",
      location: "munich",
      affiliateKey: "partner-42",
      totalPriceCents: 12_345,
      mailStatus: "sent",
      status: "unanswered",
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
    const orderNumber = "#20260717120000";
    saveRentalInquiry(db, validContact, orderNumber, 12_345);

    db.delete(rentalInquiries).run();
    expect(db.select().from(rentalInquiryBikes).all()).toEqual([]);
  });

  it("creates revenue only for confirmed bookings", () => {
    const { db } = createTestDatabase();

    saveRentalInquiry(db, validContact, "#20260717120001", 12_345, new Date(), "pending");
    expect(db.select().from(accountingRevenues).all()).toEqual([]);

    saveRentalInquiry(db, validContact, "#20260717120002", 12_345, new Date(), "confirmed");
    saveRentalInquiry(db, validContact, "#20260717120003", 12_345, new Date(), "cancelled");
    expect(db.select().from(accountingRevenues).all()).toEqual([
      expect.objectContaining({ amountCents: 12_345 }),
      expect.objectContaining({ amountCents: 6_173 }),
    ]);
  });

  it("moves pending bookings back to unanswered after the confirmation link expires", () => {
    const { db } = createTestDatabase();
    const submittedAt = new Date("2026-07-17T10:00:00.000Z");
    saveRentalInquiry(db, validContact, "#20260717120003", 12_345, submittedAt, "pending");

    const { expiresAt } = createBookingConfirmationToken(db, 1);
    db.update(rentalBookingConfirmationTokens)
      .set({ expiresAt: new Date(expiresAt.getTime() - 1) })
      .run();

    expect(expirePendingBookingConfirmations(db, expiresAt)).toBe(1);
    expect(db.select({ status: rentalInquiries.status }).from(rentalInquiries).get()).toEqual({
      status: "unanswered",
    });
  });
});
