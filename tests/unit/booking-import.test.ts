import { afterEach, describe, expect, it, vi } from "vitest";

import { createDatabaseConnection } from "@/lib/db/client";
import { bookings, communicationMessages } from "@/lib/db/schema";
import { setLegacyBookingStatus } from "@/lib/bookings/service";
import { importLegacyBookingEmails } from "@/lib/booking-import/service";
import { loadBookingCandidateMails } from "@/lib/booking-import/mail-client";
import { isBookingInquiry, isExportableBooking, parseBookingRequest } from "@/lib/booking-import/parser";
import type { BookingImportMail } from "@/lib/booking-import/types";

vi.mock("@/lib/booking-import/mail-client", () => ({ loadBookingCandidateMails: vi.fn() }));

function mail(bodyText: string, overrides: Partial<BookingImportMail> = {}): BookingImportMail {
  return {
    id: "mail-1",
    subject: "Neue Bike-Anfrage (1 Bike)",
    fromEmail: "anfrage@munich-bike-rental.de",
    fromName: "Munich Bike Rental",
    replyToEmail: null,
    sentAt: new Date("2026-08-11T10:00:00.000Z"),
    bodyText,
    bodyHtml: null,
    folderName: "INBOX",
    ...overrides,
  };
}

describe("historical booking e-mail import", () => {
  afterEach(() => vi.clearAllMocks());

  it("parses German form fields and keeps missing optional values visible", () => {
    const record = parseBookingRequest(
      mail(
        "Neue Bike-Anfrage\nName: Max Mustermann\nE-Mail: max@example.com\nTelefon: +49 171 1234567\nOrt: München\nZeitraum: 12.06.2025 - 15.06.2025\nAbholung: 10:00\nRückgabe: 18:00\nFahrrad: Endurace CF SL 8 - M\nKörpergröße: 182 cm\nPedale: Ja (Look Keo 2 Max)\nHelm: Ja\nNachricht: Bitte einen passenden Sattel vorbereiten.",
      ),
    );
    expect(record.email).toBe("max@example.com");
    expect(record.location).toBe("munich");
    expect(record.periodFrom).toBe("2025-06-12");
    expect(record.periodTo).toBe("2025-06-15");
    expect(record.pickupTime).toBe("10:00");
    expect(record.dropoffTime).toBe("18:00");
    expect(record.requestedItems[0]).toMatchObject({
      requestedLabel: "Endurace CF SL 8 - M",
      heightCm: 182,
      needsPedals: true,
      pedalType: "lookKeo2Max",
      needsHelmet: true,
      bottleHolderIncluded: true,
      repairKitIncluded: true,
    });
    expect(record.missingFields).toContain("requestedItems[0].needsClothing");
  });

  it("uses the form marker for locale instead of the free-text language", () => {
    const english = parseBookingRequest(
      mail(
        "New bike inquiry\nFull name: Jane Doe\nEmail address: jane@example.com\nRental period: June 12, 2025 to June 15, 2025\nPickup time: 10am\nDrop-off time: 6pm\nBike: Grail CF SL 7 - L\nMessage: Deutsche Nachricht und Grüße",
        { subject: "New bike inquiry" },
      ),
    );
    expect(english.locale).toBe("en");
    expect(english.periodFrom).toBe("2025-06-12");
    expect(english.pickupTime).toBe("10:00");
    expect(english.dropoffTime).toBe("18:00");
  });

  it("prefers Reply-To and never turns a phone number into an e-mail", () => {
    const record = parseBookingRequest(
      mail("Name: Andreas Luchner\nKontakt: 01735847250\nBike: Endurace CF SL 8 - L", {
        replyToEmail: "aluchner2017@gmail.com",
      }),
    );
    expect(record.email).toBe("aluchner2017@gmail.com");
    expect(record.phone).toBe("01735847250");
    expect(record.missingFields).not.toContain("email");
  });

  it("keeps heights attached to separate bike sections and infers missing height", () => {
    const record = parseBookingRequest(
      mail(
        "Name: Alex Example\nKontakt: alex@example.com\nBike 1\nKörpergröße: 164 cm\nRennrad: Endurace CF SL 8 - XS\nBike 2\nKörpergröße: 170 cm\nRennrad: Endurace CF SL 8 - S",
        { subject: "Neue Bike-Anfrage (2 Bikes)" },
      ),
    );
    expect(record.requestedItems.map((item) => item.heightCm)).toEqual([164, 170]);
    const inferred = parseBookingRequest(
      mail("Name: Alex Example\nKontakt: alex@example.com\nBike: Endurace CF SL 8 - M"),
    );
    expect(inferred.requestedItems[0].heightCm).toBe(181);
    expect(inferred.inferredFields).toContain("requestedItems[0].heightCm");
    expect(inferred.missingFields).toContain("requestedItems[0].heightCm");
  });

  it("takes only the first nested request block", () => {
    const record = parseBookingRequest(
      mail(
        "Antwort\n> Neue Bike-Anfrage\n> Name: Alex Example\n> Kontakt: alex@example.com\n> Bike: Endurace CF SL 8 - M\n>> Neue Bike-Anfrage\n>> Bike: Endurace CF SL 8 - M",
        { subject: "Re: Bike inquiry" },
      ),
    );
    expect(record.name).toBe("Alex Example");
    expect(record.requestedItems).toHaveLength(1);
  });

  it("filters non-inquiries, unknown models, and excluded customers", () => {
    expect(isBookingInquiry(mail("Name: A\nBike: Endurace CF SL 8"))).toBe(true);
    expect(isBookingInquiry(mail("Plain business mail", { subject: "Re: Booking" }))).toBe(false);
    expect(
      isExportableBooking(
        parseBookingRequest(mail("Name: Julius Porzel\nE-Mail: julius.porzel@web.de\nBike: Endurace CF SL 8 - M")),
      ),
    ).toBe(false);
    expect(isExportableBooking(parseBookingRequest(mail("Name: A\nE-Mail: a@example.com\nBike: unknown")))).toBe(false);
  });

  it("is safe to run repeatedly and imports a later new mail only once", async () => {
    const connection = createDatabaseConnection(":memory:");
    const first = mail(
      "Neue Bike-Anfrage\nName: A\nE-Mail: a@example.com\nZeitraum: 2026-08-20 - 2026-08-22\nBike: Endurace CF SL 8 - M",
      { id: "rfc-1" },
    );
    const second = mail(
      "Neue Bike-Anfrage\nName: B\nE-Mail: b@example.com\nZeitraum: 2026-08-23 - 2026-08-24\nBike: Grail CF SL 7 - S",
      { id: "rfc-2" },
    );
    vi.mocked(loadBookingCandidateMails)
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([first, second]);
    expect((await importLegacyBookingEmails(connection.db)).created).toBe(1);
    const imported = connection.db.select().from(bookings).get();
    expect(connection.db.select().from(communicationMessages).all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bookingId: imported?.id, rfcMessageId: "rfc-1", direction: "inbound" }),
      ]),
    );
    expect(imported?.status).toBe("rejected");
    setLegacyBookingStatus(connection.db, { bookingId: imported!.id, status: "confirmed" });
    expect(connection.db.select().from(bookings).get()?.status).toBe("confirmed");
    expect((await importLegacyBookingEmails(connection.db)).created).toBe(0);
    const third = await importLegacyBookingEmails(connection.db);
    expect(third.created).toBe(1);
    expect(third.skippedExisting).toBe(1);
    expect(connection.db.select().from(bookings).all()).toHaveLength(2);
    connection.close();
  });
});
