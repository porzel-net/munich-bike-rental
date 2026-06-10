import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

import { siteConfig } from "../../../lib/site";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ContactPayload = {
  name?: string;
  contact?: string;
  height?: string;
  bikeSize?: string;
  periodFrom?: string;
  periodTo?: string;
  message?: string;
  bikeTitle?: string;
  locale?: "de" | "en";
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeLine(value: string, maxLength = 200) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhoneNumber(value: string) {
  return /^[+\d][\d\s()./-]{5,}$/.test(value);
}

function jsonError(status: number, code: string, error: string) {
  return NextResponse.json({ ok: false, code, error }, { status, headers: { "Cache-Control": "no-store" } });
}

function getExpectedOrigin(request: Request) {
  const configuredOrigin = process.env.APP_ORIGIN ?? new URL(siteConfig.url).origin;
  const localhostOrigins = new Set([
    "http://localhost",
    "https://localhost",
    "http://localhost:3000",
    "https://localhost:3000",
    "http://127.0.0.1",
    "https://127.0.0.1",
    "http://127.0.0.1:3000",
    "https://127.0.0.1:3000",
  ]);
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const forwardedOrigin = `${forwardedProto}://${forwardedHost}`;

  if (localhostOrigins.has(forwardedOrigin)) {
    return forwardedOrigin;
  }

  return configuredOrigin;
}

function createMailBody(
  payload: Required<
    Pick<
      ContactPayload,
      "name" | "contact" | "height" | "bikeSize" | "periodFrom" | "periodTo" | "message" | "bikeTitle" | "locale"
    >
  >,
) {
  const periodLine =
    payload.periodFrom && payload.periodTo
      ? `${payload.periodFrom} - ${payload.periodTo}`
      : payload.periodFrom || payload.periodTo || "-";

  if (payload.locale === "de") {
    return [
      "Neue Bike-Anfrage",
      "",
      `Name: ${payload.name}`,
      `Kontakt: ${payload.contact}`,
      `Körpergröße: ${payload.height}`,
      `Rennradgröße: ${payload.bikeSize}`,
      `Zeitraum: ${periodLine}`,
      payload.bikeTitle ? `Bike: ${payload.bikeTitle}` : "Bike: -",
      "",
      "Nachricht:",
      payload.message,
    ].join("\n");
  }

  return [
    "New bike inquiry",
    "",
    `Name: ${payload.name}`,
    `Contact: ${payload.contact}`,
    `Height: ${payload.height}`,
    `Bike size: ${payload.bikeSize}`,
    `Rental period: ${periodLine}`,
    payload.bikeTitle ? `Bike: ${payload.bikeTitle}` : "Bike: -",
    "",
    "Message:",
    payload.message,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const expectedOrigin = getExpectedOrigin(request);

    if (!origin || origin !== expectedOrigin) {
      return jsonError(403, "invalid_origin", "Invalid request origin");
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return jsonError(415, "unsupported_content_type", "Unsupported content type");
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return jsonError(413, "payload_too_large", "Payload too large");
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return jsonError(413, "payload_too_large", "Payload too large");
    }

    let body: ContactPayload;
    try {
      body = JSON.parse(rawBody) as ContactPayload;
    } catch {
      return jsonError(400, "invalid_json", "Invalid JSON");
    }

    const name = sanitizeLine(asText(body?.name), 120);
    const contact = sanitizeLine(asText(body?.contact), 254);
    const height = sanitizeLine(asText(body?.height), 8);
    const bikeSize = sanitizeLine(asText(body?.bikeSize), 2);
    const periodFrom = sanitizeLine(asText(body?.periodFrom), 32);
    const periodTo = sanitizeLine(asText(body?.periodTo), 32);
    const message = asText(body?.message).slice(0, 4000);
    const bikeTitle = sanitizeLine(asText(body?.bikeTitle), 120);
    const locale = body?.locale === "en" ? "en" : "de";

    const contactIsEmail = isEmail(contact);
    const contactIsPhone = isPhoneNumber(contact);

    if (
      !contact ||
      (!contactIsEmail && !contactIsPhone) ||
      !height ||
      !/^\d{2,3}$/.test(height) ||
      !bikeSize ||
      !["S", "M", "L"].includes(bikeSize) ||
      !periodFrom ||
      !periodTo ||
      !DATE_PATTERN.test(periodFrom) ||
      !DATE_PATTERN.test(periodTo) ||
      !message
    ) {
      return jsonError(400, "validation_error", "Missing required fields");
    }

    if (new Date(periodFrom).getTime() > new Date(periodTo).getTime()) {
      return jsonError(400, "validation_error", "The end of the rental period must be after the start");
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT ?? "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpSecure = process.env.SMTP_SECURE === "true";
    const fromAddress = process.env.MAIL_FROM_ADDRESS ?? "anfrage@munich-bike-rental.de";
    const toAddress = process.env.MAIL_TO_ADDRESS ?? "hallo@munich-bike-rental.de";

    if (!smtpHost || !smtpUser || !smtpPassword) {
      return jsonError(500, "config_incomplete", "Mail configuration is incomplete");
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `Munich Rental <${fromAddress}>`,
      to: toAddress,
      replyTo: contactIsEmail ? contact : undefined,
      subject: bikeTitle ? `Bike inquiry - ${bikeTitle}` : "Bike inquiry",
      text: createMailBody({
        name,
        contact,
        height,
        bikeSize,
        periodFrom,
        periodTo,
        message,
        bikeTitle,
        locale,
      }),
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError(500, "send_failed", "Unable to send message");
  }
}
