import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

import { siteConfig } from "../../../lib/site";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;

type MaintenancePayload = {
  name?: string;
  contact?: string;
  bikeModel?: string;
  serviceType?: string;
  pickup?: boolean;
  message?: string;
  locale?: "de" | "en";
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeLine(value: string, maxLength = 200) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}

function createOrderNumber(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }

    return acc;
  }, {});

  return `#${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseBoolean(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function parseTimeoutMs(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const timeoutSeconds = Number(value);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    return undefined;
  }

  return Math.round(timeoutSeconds * 1000);
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
    Pick<MaintenancePayload, "name" | "contact" | "bikeModel" | "serviceType" | "message" | "locale">
  > & {
    pickup: boolean;
    orderNumber: string;
  },
) {
  const pickupLine = payload.pickup
    ? payload.locale === "de"
      ? "Ja, bitte abholen und zurückbringen"
      : "Yes, please pick up and return"
    : payload.locale === "de"
      ? "Nein"
      : "No";

  const serviceLabels =
    payload.locale === "de"
      ? {
          wax: "Öl auf Wachs mit Beratung",
          cleaning: "Kettenpflege und Antriebsreinigung",
          parts: "Teile tauschen",
          repair: "Reparatur",
          advice: "Beratung",
        }
      : {
          wax: "Oil-to-wax with advice",
          cleaning: "Chain care and drivetrain cleaning",
          parts: "Part replacement",
          repair: "Repair",
          advice: "Advice",
        };

  const serviceLabel =
    serviceLabels[payload.serviceType as keyof typeof serviceLabels] ?? payload.serviceType;

  if (payload.locale === "de") {
    return [
      "Neue Wartungsanfrage",
      "",
      `Auftragsnummer: ${payload.orderNumber}`,
      `Name: ${payload.name}`,
      `Kontakt: ${payload.contact}`,
      `Radmodell / Teile: ${payload.bikeModel}`,
      `Wunsch: ${serviceLabel}`,
      `Abholung: ${pickupLine}`,
      "",
      "Nachricht:",
      payload.message,
    ].join("\n");
  }

  return [
    "New maintenance inquiry",
    "",
    `Order number: ${payload.orderNumber}`,
    `Name: ${payload.name}`,
    `Contact: ${payload.contact}`,
    `Bike model / parts: ${payload.bikeModel}`,
    `Need: ${serviceLabel}`,
    `Pickup: ${pickupLine}`,
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

    let body: MaintenancePayload;
    try {
      body = JSON.parse(rawBody) as MaintenancePayload;
    } catch {
      return jsonError(400, "invalid_json", "Invalid JSON");
    }

    const name = sanitizeLine(asText(body?.name), 120);
    const contact = sanitizeLine(asText(body?.contact), 254);
    const bikeModel = sanitizeLine(asText(body?.bikeModel), 160);
    const serviceType = sanitizeLine(asText(body?.serviceType), 80);
    const pickup = Boolean(body?.pickup);
    const message = asText(body?.message).slice(0, 4000);
    const locale = body?.locale === "en" ? "en" : "de";

    if (!name || !contact || !isEmail(contact) || !bikeModel || !serviceType || !message) {
      return jsonError(400, "validation_error", "Missing required fields");
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT ?? "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpSecure =
      parseBoolean(process.env.SMTP_SECURE) ??
      parseBoolean(process.env.MAIL_USE_SSL) ??
      smtpPort === 465;
    const smtpRequireTls = parseBoolean(process.env.MAIL_USE_STARTTLS) ?? !smtpSecure;
    const smtpTimeout = parseTimeoutMs(process.env.SMTP_TIMEOUT_SECONDS);
    const fromAddress = process.env.MAIL_FROM_ADDRESS ?? "anfrage@munich-bike-rental.de";
    const toAddress = process.env.MAIL_TO_ADDRESS ?? "hallo@munich-bike-rental.de";
    const orderNumber = createOrderNumber();

    if (!smtpHost || !smtpUser || !smtpPassword) {
      return jsonError(500, "config_incomplete", "Mail configuration is incomplete");
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      requireTLS: smtpRequireTls,
      connectionTimeout: smtpTimeout,
      greetingTimeout: smtpTimeout,
      socketTimeout: smtpTimeout,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `Munich Rental <${fromAddress}>`,
      to: toAddress,
      replyTo: contact,
      subject: locale === "de" ? `Neue Wartungsanfrage ${orderNumber}` : `New maintenance inquiry ${orderNumber}`,
      text: createMailBody({
        name,
        contact,
        bikeModel,
        serviceType,
        pickup,
        message,
        locale,
        orderNumber,
      }),
    });

    return NextResponse.json({ ok: true, orderNumber }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError(500, "send_failed", "Unable to send message");
  }
}
