import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

import { siteConfig } from "../../../lib/site";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const PEDAL_TYPE_LABELS = {
  de: {
    platform: "Plattformpedale",
    spdSl: "SPD-SL",
    lookKeo2Max: "Look Keo2 Max",
    other: "Andere",
  },
  en: {
    platform: "Platform pedals",
    spdSl: "SPD-SL",
    lookKeo2Max: "Look Keo2 Max",
    other: "Other",
  },
} as const;

const COMPUTER_MOUNT_TYPE_LABELS = {
  de: {
    garmin: "Garmin",
    wahoo: "Wahoo",
    other: "Andere",
  },
  en: {
    garmin: "Garmin",
    wahoo: "Wahoo",
    other: "Other",
  },
} as const;

const LOCATION_LABELS = {
  de: {
    munich: "München",
    regensburg: "Regensburg",
  },
  en: {
    munich: "Munich",
    regensburg: "Regensburg",
  },
} as const;

type ContactPayload = {
  location?: string;
  name?: string;
  contact?: string;
  phone?: string;
  height?: string;
  bikeSize?: string;
  periodFrom?: string;
  periodTo?: string;
  pickupTime?: string;
  dropoffTime?: string;
  needsPedals?: boolean | string;
  pedalType?: string;
  needsComputerMount?: boolean | string;
  computerMountType?: string;
  needsHelmet?: boolean | string;
  needsClothing?: boolean | string;
  message?: string;
  bikeTitle?: string;
  locale?: "de" | "en";
  affiliateKey?: string;
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

function readBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return parseBoolean(value);
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
    Pick<
      ContactPayload,
      | "name"
      | "contact"
      | "phone"
      | "height"
      | "location"
      | "bikeSize"
      | "periodFrom"
      | "periodTo"
      | "pickupTime"
      | "dropoffTime"
      | "needsPedals"
      | "pedalType"
      | "needsComputerMount"
      | "computerMountType"
      | "needsHelmet"
      | "needsClothing"
      | "message"
      | "bikeTitle"
      | "locale"
    >
  > & {
    orderNumber: string;
    affiliateKey?: string;
  },
) {
  const periodLine =
    payload.periodFrom && payload.periodTo
      ? `${payload.periodFrom} - ${payload.periodTo}`
      : payload.periodFrom || payload.periodTo || "-";
  const affiliateLine = payload.affiliateKey ? `Affiliate-Key: ${payload.affiliateKey}` : null;
  const pedalLabel = payload.needsPedals
    ? PEDAL_TYPE_LABELS[payload.locale][payload.pedalType as keyof (typeof PEDAL_TYPE_LABELS)["de"]] ??
      payload.pedalType
    : payload.locale === "de"
      ? "Nein"
      : "No";
  const computerMountLabel = payload.needsComputerMount
    ? COMPUTER_MOUNT_TYPE_LABELS[payload.locale][
        payload.computerMountType as keyof (typeof COMPUTER_MOUNT_TYPE_LABELS)["de"]
      ] ?? payload.computerMountType
    : payload.locale === "de"
      ? "Nein"
      : "No";
  const yesNo = payload.locale === "de" ? { yes: "Ja", no: "Nein" } : { yes: "Yes", no: "No" };

  if (payload.locale === "de") {
    return [
      "Neue Bike-Anfrage",
      "",
      `Auftragsnummer: ${payload.orderNumber}`,
      `Name: ${payload.name}`,
      `Kontakt: ${payload.contact}`,
      `Telefon: ${payload.phone}`,
      `Körpergröße: ${payload.height}`,
      `Standort: ${LOCATION_LABELS.de[payload.location as keyof (typeof LOCATION_LABELS)["de"]] ?? payload.location}`,
      `Rennrad: ${payload.bikeSize}`,
      `Zeitraum: ${periodLine}`,
      `Abholuhrzeit: ${payload.pickupTime}`,
      `Abgabeuhrzeit: ${payload.dropoffTime}`,
      `Pedale: ${payload.needsPedals ? `Ja, ${pedalLabel}` : "Nein"}`,
      `Fahrradcomputerhalterung: ${payload.needsComputerMount ? `Ja, ${computerMountLabel}` : "Nein"}`,
      `Helm: ${payload.needsHelmet ? yesNo.yes : yesNo.no}`,
      `Kleidung: ${payload.needsClothing ? yesNo.yes : yesNo.no}`,
      affiliateLine,
      "",
      "Nachricht:",
      payload.message,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
  }

  return [
    "New bike inquiry",
    "",
    `Order number: ${payload.orderNumber}`,
    `Name: ${payload.name}`,
    `Contact: ${payload.contact}`,
    `Phone: ${payload.phone}`,
    `Height: ${payload.height}`,
    `Location: ${LOCATION_LABELS.en[payload.location as keyof (typeof LOCATION_LABELS)["en"]] ?? payload.location}`,
    `Road bike: ${payload.bikeSize}`,
    `Rental period: ${periodLine}`,
    `Pickup time: ${payload.pickupTime}`,
    `Drop-off time: ${payload.dropoffTime}`,
    `Pedals: ${payload.needsPedals ? `Yes, ${pedalLabel}` : "No"}`,
    `Bike computer mount: ${payload.needsComputerMount ? `Yes, ${computerMountLabel}` : "No"}`,
    `Helmet: ${payload.needsHelmet ? yesNo.yes : yesNo.no}`,
    `Clothing: ${payload.needsClothing ? yesNo.yes : yesNo.no}`,
    affiliateLine,
    "",
    "Message:",
    payload.message,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
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
    const phone = sanitizeLine(asText(body?.phone), 64);
    const height = sanitizeLine(asText(body?.height), 8);
    const location = sanitizeLine(asText(body?.location), 32);
    const bikeSize = sanitizeLine(asText(body?.bikeSize), 120);
    const periodFrom = sanitizeLine(asText(body?.periodFrom), 32);
    const periodTo = sanitizeLine(asText(body?.periodTo), 32);
    const pickupTime = sanitizeLine(asText(body?.pickupTime), 16);
    const dropoffTime = sanitizeLine(asText(body?.dropoffTime), 16);
    const needsPedals = readBoolean(body?.needsPedals) ?? false;
    const pedalType = sanitizeLine(asText(body?.pedalType), 32);
    const needsComputerMount = readBoolean(body?.needsComputerMount) ?? false;
    const computerMountType = sanitizeLine(asText(body?.computerMountType), 32);
    const needsHelmet = readBoolean(body?.needsHelmet) ?? false;
    const needsClothing = readBoolean(body?.needsClothing) ?? false;
    const message = asText(body?.message).slice(0, 4000);
    const bikeTitle = sanitizeLine(asText(body?.bikeTitle), 120);
    const locale = body?.locale === "en" ? "en" : "de";
    const affiliateKey = sanitizeLine(asText(body?.affiliateKey), 120);
    const validPedalTypes = new Set<keyof (typeof PEDAL_TYPE_LABELS)["de"]>([
      "platform",
      "spdSl",
      "lookKeo2Max",
      "other",
    ]);
    const validComputerMountTypes = new Set<keyof (typeof COMPUTER_MOUNT_TYPE_LABELS)["de"]>([
      "garmin",
      "wahoo",
      "other",
    ]);
    const validLocations = new Set<keyof (typeof LOCATION_LABELS)["de"]>(["munich", "regensburg"]);

    if (
      !contact ||
      !isEmail(contact) ||
      !phone ||
      !height ||
      !/^\d{2,3}$/.test(height) ||
      !location ||
      !validLocations.has(location as keyof (typeof LOCATION_LABELS)["de"]) ||
      !bikeSize ||
      !periodFrom ||
      !periodTo ||
      !pickupTime ||
      !dropoffTime ||
      !DATE_PATTERN.test(periodFrom) ||
      !DATE_PATTERN.test(periodTo) ||
      !TIME_PATTERN.test(pickupTime) ||
      !TIME_PATTERN.test(dropoffTime) ||
      (needsPedals && (!pedalType || !validPedalTypes.has(pedalType as keyof (typeof PEDAL_TYPE_LABELS)["de"]))) ||
      (needsComputerMount &&
        (!computerMountType ||
          !validComputerMountTypes.has(computerMountType as keyof (typeof COMPUTER_MOUNT_TYPE_LABELS)["de"]))) ||
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
    const smtpSecure =
      parseBoolean(process.env.SMTP_SECURE) ??
      parseBoolean(process.env.MAIL_USE_SSL) ??
      smtpPort === 465;
    const smtpRequireTls = parseBoolean(process.env.MAIL_USE_STARTTLS) ?? !smtpSecure;
    const smtpTimeout = parseTimeoutMs(process.env.MAIL_TIMEOUT_SECONDS);
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
      subject:
        locale === "de"
          ? bikeTitle
            ? `Neue Bike-Anfrage ${orderNumber} - ${bikeTitle}`
            : `Neue Bike-Anfrage ${orderNumber}`
          : bikeTitle
            ? `New bike inquiry ${orderNumber} - ${bikeTitle}`
            : `New bike inquiry ${orderNumber}`,
      text: createMailBody({
        name,
        contact,
        phone,
        height,
        location,
        bikeSize,
        periodFrom,
        periodTo,
        pickupTime,
        dropoffTime,
        needsPedals,
        pedalType: needsPedals ? pedalType : "",
        needsComputerMount,
        computerMountType: needsComputerMount ? computerMountType : "",
        needsHelmet,
        needsClothing,
        message,
        bikeTitle,
        locale,
        orderNumber,
        affiliateKey: affiliateKey || undefined,
      }),
    });

    return NextResponse.json({ ok: true, orderNumber }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError(500, "send_failed", "Unable to send message");
  }
}
