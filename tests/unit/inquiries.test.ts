import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";

const { createTransport, sendMail } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { createTransport: vi.fn(() => ({ sendMail })), sendMail };
});
vi.mock("nodemailer", () => ({ default: { createTransport } }));

import { POST as contactPost } from "../../app/api/contact/route";
import { contactInquirySchema, maintenanceInquirySchema } from "../../lib/inquiries/schemas";
import {
  consumeRateLimit,
  createOrderNumber,
  getMailConfig,
  resetRateLimitsForTests,
} from "../../lib/inquiries/server";

const validContact = {
  name: "Max Mustermann",
  contact: "max@example.com",
  phone: "+49 123456789",
  height: "180",
  location: "munich",
  bikeSize: "Endurace CF SL 8 - M",
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

  it("requires a known maintenance service", () => {
    expect(
      maintenanceInquirySchema.safeParse({
        name: "Max",
        contact: "max@example.com",
        bikeModel: "Canyon",
        serviceType: "unknown",
        pickup: false,
        message: "Bitte prüfen",
        locale: "de",
        website: "",
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

  it("uses unique order number suffixes and validates mail configuration", async () => {
    expect(createOrderNumber(new Date("2026-07-17T10:00:00Z"), "abcdef-0000")).toMatch(/-abcdef$/);
    expect(createOrderNumber(new Date("2026-07-17T10:00:00Z"), "123456-0000")).not.toBe(
      createOrderNumber(new Date("2026-07-17T10:00:00Z"), "abcdef-0000"),
    );
    expect(
      await getMailConfig({
        SMTP_HOST: "smtp.example.com",
        SMTP_USER: "user",
        SMTP_PASSWORD: "secret",
        SMTP_PORT: "70000",
      }),
    ).toBeNull();
    expect(
      (
        await getMailConfig({
          SMTP_HOST: "smtp.example.com",
          SMTP_USER: "user",
          SMTP_PASSWORD: "secret",
          MAIL_TIMEOUT_SECONDS: "20",
        })
      )?.timeout,
    ).toBe(20_000);
    expect(
      (
        await getMailConfig({
          SMTP_HOST: "smtp.example.com",
          SMTP_USER: "user",
          SMTP_PASSWORD_FILE: fileURLToPath(new URL("../fixtures/smtp-password.txt", import.meta.url)),
        })
      )?.password,
    ).toBe("test-password-from-file");
  });
});

describe("contact route", () => {
  const environment = process.env;

  beforeEach(() => {
    resetRateLimitsForTests();
    sendMail.mockReset();
    sendMail.mockResolvedValue({});
    process.env = {
      ...environment,
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "user",
      SMTP_PASSWORD: "secret",
      SMTP_PORT: "587",
      MAIL_TIMEOUT_SECONDS: "20",
      APP_ORIGIN: "http://localhost:3000",
    };
  });

  it("sends a valid inquiry and rejects bot and invalid input", async () => {
    expect((await contactPost(request(validContact))).status).toBe(200);
    expect(sendMail).toHaveBeenCalledOnce();
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ disableFileAccess: true, disableUrlAccess: true }),
    );
    expect(
      (await contactPost(request({ ...validContact, website: "https://bot.invalid" }, "198.51.100.11"))).status,
    ).toBe(400);
    expect((await contactPost(request({ ...validContact, name: "" }, "198.51.100.12"))).status).toBe(400);
  });

  it("returns a configuration error without SMTP credentials", async () => {
    delete process.env.SMTP_HOST;
    expect((await contactPost(request(validContact))).status).toBe(500);
  });
});
