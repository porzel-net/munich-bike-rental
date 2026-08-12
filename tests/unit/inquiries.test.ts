import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";

const { createTransport, sendMail } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { createTransport: vi.fn(() => ({ sendMail })), sendMail };
});
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const { getDatabase, getLocationInventory, isRequestAvailable, calculateInquiryPrice, createBooking } = vi.hoisted(
  () => ({
    getDatabase: vi.fn(),
    getLocationInventory: vi.fn(),
    isRequestAvailable: vi.fn(),
    calculateInquiryPrice: vi.fn(),
    createBooking: vi.fn(),
  }),
);
const { dispatchOutboxForBooking } = vi.hoisted(() => ({ dispatchOutboxForBooking: vi.fn() }));
vi.mock("../../lib/db/client", () => ({ getDatabase }));
vi.mock("../../lib/inventory/repository", () => ({ getLocationInventory, isRequestAvailable }));
vi.mock("../../lib/inventory/pricing", () => ({ calculateInquiryPrice }));
vi.mock("../../lib/bookings/service", () => ({ createBooking }));
vi.mock("../../lib/bookings/outbox", () => ({ dispatchOutboxForBooking }));

import { POST as contactPost } from "../../app/api/contact/route";
import { contactInquirySchema } from "../../lib/inquiries/schemas";
import {
  consumeRateLimit,
  createOrderNumber,
  getMailConfig,
  resetRateLimitsForTests,
  sendConfiguredMail,
} from "../../lib/inquiries/server";

const validContact = {
  name: "Max Mustermann",
  contact: "max@example.com",
  phone: "+49 123456789",
  location: "munich",
  bikes: [
    {
      height: "180",
      bikeSize: "Endurace CF SL 8 - M",
      needsPedals: false,
      pedalType: "",
      needsComputerMount: false,
      computerMountType: "",
      needsHelmet: false,
      needsClothing: false,
    },
  ],
  periodFrom: "2026-07-20",
  periodTo: "2026-07-21",
  pickupTime: "10:00",
  dropoffTime: "16:00",
  needsPedals: false,
  needsComputerMount: false,
  needsHelmet: false,
  needsClothing: false,
  message: "Bitte Verfügbarkeit bestätigen.",
  locale: "de",
  website: "",
};

function request(body: object, ip = "198.51.100.10") {
  return new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      "x-real-ip": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("inquiry schemas", () => {
  it("accepts multiline messages but rejects invalid dates and header injection", () => {
    expect(contactInquirySchema.safeParse({ ...validContact, message: "First line\nSecond line" }).success).toBe(true);
    expect(contactInquirySchema.safeParse({ ...validContact, periodFrom: "2026-02-31" }).success).toBe(false);
    expect(contactInquirySchema.safeParse({ ...validContact, name: " " }).success).toBe(false);
    expect(
      contactInquirySchema.safeParse({ ...validContact, bikeTitle: "Bike\r\nBcc: spam@example.com" }).success,
    ).toBe(false);
  });

  it("validates each bike independently", () => {
    expect(
      contactInquirySchema.safeParse({
        ...validContact,
        bikes: [
          ...validContact.bikes,
          {
            height: "172",
            bikeSize: "Grail CF SL 7 - M",
            needsPedals: true,
            pedalType: "spdSl",
            needsComputerMount: true,
            computerMountType: "garmin",
            needsHelmet: true,
            needsClothing: false,
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      contactInquirySchema.safeParse({
        ...validContact,
        bikes: [{ ...validContact.bikes[0], needsPedals: true, pedalType: "" }],
      }).success,
    ).toBe(false);
    expect(
      contactInquirySchema.safeParse({
        ...validContact,
        bikes: Array.from({ length: 11 }, () => validContact.bikes[0]),
      }).success,
    ).toBe(false);
  });
});

describe("inquiry server helpers", () => {
  beforeEach(() => resetRateLimitsForTests());

  it("limits a client after three attempts in one window", () => {
    expect(consumeRateLimit("contact:test", 0)).toBe(true);
    expect(consumeRateLimit("contact:test", 1)).toBe(true);
    expect(consumeRateLimit("contact:test", 2)).toBe(true);
    expect(consumeRateLimit("contact:test", 3)).toBe(false);
  });

  it("uses the timestamp as the order number and validates mail configuration", async () => {
    expect(createOrderNumber(new Date("2026-07-17T10:00:00Z"))).toBe("#20260717120000");
    expect(
      await getMailConfig({
        SMTP_HOST: "smtp.example.com",
        SMTP_REQUEST_USER: "user",
        SMTP_REQUEST_PASSWORD: "secret",
        SMTP_PORT: "70000",
      }),
    ).toBeNull();
    expect(
      (
        await getMailConfig({
          SMTP_HOST: "smtp.example.com",
          SMTP_REQUEST_USER: "user",
          SMTP_REQUEST_PASSWORD: "secret",
          MAIL_TIMEOUT_SECONDS: "20",
        })
      )?.timeout,
    ).toBe(20_000);
    expect(
      (
        await getMailConfig({
          SMTP_HOST: "smtp.example.com",
          SMTP_REQUEST_USER: "user",
          SMTP_REQUEST_PASSWORD_FILE: fileURLToPath(new URL("../fixtures/smtp-password.txt", import.meta.url)),
        })
      )?.password,
    ).toBe("test-password-from-file");
  });

  it("falls back from blank Compose account overrides to shared SMTP settings", async () => {
    await expect(
      getMailConfig({
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "465",
        SMTP_SECURE: "true",
        SMTP_USER: "legacy-user",
        SMTP_PASSWORD: "legacy-password",
        SMTP_REQUEST_HOST: "",
        SMTP_REQUEST_PORT: "",
        SMTP_REQUEST_USER: "",
        SMTP_REQUEST_PASSWORD: "",
      }),
    ).resolves.toMatchObject({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      user: "legacy-user",
      password: "legacy-password",
    });
  });

  it("keeps recipients in the SMTP envelope when an aligned sender is configured", async () => {
    process.env = {
      ...process.env,
      SMTP_HOST: "smtp.example.com",
      SMTP_MAIN_USER: "main@example.com",
      SMTP_MAIN_PASSWORD: "secret",
      SMTP_MAIN_PORT: "465",
      SMTP_MAIN_SECURE: "true",
      MAIL_MAIN_FROM_ADDRESS: "main@example.com",
    };
    sendMail.mockResolvedValue({ messageId: "<test@example.com>" });

    await sendConfiguredMail({
      account: "main",
      to: "customer@example.com",
      subject: "Test",
      text: "Test",
    });

    expect(sendMail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        envelope: { from: "main@example.com", to: "customer@example.com" },
        html: expect.stringContaining('src="cid:your-bike-rental-logo@munich-bike-rental.de"'),
        attachments: [
          expect.objectContaining({
            filename: "favicon-96.png",
            contentType: "image/png",
            cid: "your-bike-rental-logo@munich-bike-rental.de",
          }),
        ],
      }),
    );
  });
});

describe("contact route", () => {
  const environment = process.env;

  beforeEach(() => {
    resetRateLimitsForTests();
    sendMail.mockReset();
    sendMail.mockResolvedValue({});
    getDatabase.mockReset();
    getDatabase.mockReturnValue({});
    getLocationInventory.mockReset();
    getLocationInventory.mockReturnValue({});
    isRequestAvailable.mockReset();
    isRequestAvailable.mockReturnValue(true);
    calculateInquiryPrice.mockReset();
    calculateInquiryPrice.mockReturnValue({ totalCents: 23_100 });
    createBooking.mockReset();
    createBooking.mockReturnValue({ id: 1, orderNumber: "#20260717120000" });
    dispatchOutboxForBooking.mockReset();
    dispatchOutboxForBooking.mockResolvedValue([{ id: 1, status: "sent" }]);
    process.env = {
      ...environment,
      SMTP_HOST: "smtp.example.com",
      SMTP_REQUEST_USER: "user",
      SMTP_REQUEST_PASSWORD: "secret",
      SMTP_PORT: "587",
      MAIL_TIMEOUT_SECONDS: "20",
      APP_ORIGIN: "http://localhost:3000",
    };
  });

  it("sends a valid inquiry and rejects bot and invalid input", async () => {
    expect((await contactPost(request(validContact))).status).toBe(200);
    expect(createBooking).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerName: validContact.name,
        customerEmail: validContact.contact,
        quotedTotalCents: 23_100,
      }),
    );
    expect(
      (await contactPost(request({ ...validContact, website: "https://bot.invalid" }, "198.51.100.11"))).status,
    ).toBe(400);
    expect((await contactPost(request({ ...validContact, name: "" }, "198.51.100.12"))).status).toBe(400);
  });

  it("keeps all bike details on the booking and skips the old internal inquiry mail", async () => {
    const response = await contactPost(
      request({
        ...validContact,
        bikes: [
          validContact.bikes[0],
          {
            height: "172",
            bikeSize: "Grail CF SL 7 - M",
            needsPedals: true,
            pedalType: "spdSl",
            needsComputerMount: true,
            computerMountType: "garmin",
            needsHelmet: true,
            needsClothing: true,
            repairKitIncluded: true,
            needsGlasses: true,
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    const command = createBooking.mock.calls[0]?.[1];
    expect(command.outbox).toBeUndefined();
    expect(command.requestedItems).toHaveLength(2);
    expect(command.requestedItems[1]).toMatchObject({
      requestedLabel: "Grail CF SL 7 - M",
      heightCm: 172,
      needsPedals: true,
      pedalType: "spdSl",
      needsComputerMount: true,
      computerMountType: "garmin",
      needsHelmet: true,
      needsClothing: true,
      needsBikepackingBag: false,
      needsGlasses: true,
      bottleHolderIncluded: true,
      repairKitIncluded: true,
    });
  });

  it("queues the inquiry without SMTP credentials", async () => {
    delete process.env.SMTP_HOST;
    dispatchOutboxForBooking.mockResolvedValueOnce([{ id: 1, status: "failed" }]);
    expect((await contactPost(request(validContact))).status).toBe(502);
    expect(createBooking).toHaveBeenCalledOnce();
  });

  it("does not persist an inquiry when mail delivery throws", async () => {
    createBooking.mockImplementationOnce(() => {
      throw new Error("Database unavailable");
    });
    expect((await contactPost(request(validContact))).status).toBe(500);
  });
});
