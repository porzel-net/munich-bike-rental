import { readFile } from "node:fs/promises";

import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import type { z } from "zod";

import { siteConfig } from "../site";
import { readBoundedText } from "../security/request-body";
import { emailCard, emailParagraph, renderEmailLayout } from "./email-template";

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_MAX_ENTRIES = 10_000;

type ApiErrorCode =
  | "bot_detected"
  | "config_incomplete"
  | "invalid_json"
  | "invalid_origin"
  | "payload_too_large"
  | "rate_limited"
  | "send_failed"
  | "unsupported_content_type"
  | "validation_error";

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitEntries = new Map<string, RateLimitEntry>();

export function jsonError(status: number, code: ApiErrorCode, error: string) {
  return NextResponse.json({ ok: false, code, error }, { status, headers: { "Cache-Control": "no-store" } });
}

function getExpectedOrigin(request: Request) {
  const configuredOrigin = process.env.APP_ORIGIN ?? new URL(siteConfig.url).origin;
  if (process.env.NODE_ENV === "production") {
    try {
      const parsedOrigin = new URL(configuredOrigin);
      return parsedOrigin.protocol === "https:" ? parsedOrigin.origin : null;
    } catch {
      return null;
    }
  }

  const localOrigins = new Set([
    "http://localhost",
    "https://localhost",
    "http://localhost:3000",
    "https://localhost:3000",
    "http://127.0.0.1",
    "https://127.0.0.1",
    "http://127.0.0.1:3000",
    "https://127.0.0.1:3000",
  ]);
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.slice(0, -1);
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
  const forwardedOrigin = `${forwardedProto}://${forwardedHost}`;

  return localOrigins.has(forwardedOrigin) ? forwardedOrigin : configuredOrigin;
}

function getClientIp(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  // X-Forwarded-For is client-spoofable unless every proxy hop is tightly
  // controlled. Nginx overwrites X-Real-IP in the documented deployment.
  return realIp || "unknown";
}

export function consumeRateLimit(key: string, now = Date.now()) {
  if (rateLimitEntries.size >= RATE_LIMIT_MAX_ENTRIES) {
    for (const [entryKey, entry] of rateLimitEntries) {
      if (entry.resetAt <= now) {
        rateLimitEntries.delete(entryKey);
      }
    }

    if (rateLimitEntries.size >= RATE_LIMIT_MAX_ENTRIES) {
      const oldestKey = rateLimitEntries.keys().next().value;
      if (oldestKey) {
        rateLimitEntries.delete(oldestKey);
      }
    }
  }

  const current = rateLimitEntries.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitEntries.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  current.count += 1;
  return true;
}

export function resetRateLimitsForTests() {
  rateLimitEntries.clear();
}

export async function parseInquiryRequest<T extends { website?: unknown }>(
  request: Request,
  endpoint: "contact",
  schema: z.ZodType<T>,
): Promise<{ data: T } | { error: NextResponse }> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== getExpectedOrigin(request)) {
    return { error: jsonError(403, "invalid_origin", "Invalid request origin") };
  }

  if (!consumeRateLimit(`${endpoint}:${getClientIp(request)}`)) {
    return { error: jsonError(429, "rate_limited", "Too many requests") };
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { error: jsonError(415, "unsupported_content_type", "Unsupported content type") };
  }

  const rawBody = await readBoundedText(request, MAX_BODY_BYTES);
  if (rawBody === null) {
    return { error: jsonError(413, "payload_too_large", "Payload too large") };
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { error: jsonError(400, "invalid_json", "Invalid JSON") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { error: jsonError(400, "validation_error", "Missing or invalid fields") };
  }

  if (typeof parsed.data.website === "string" && parsed.data.website) {
    return { error: jsonError(400, "bot_detected", "Invalid request") };
  }

  return { data: parsed.data };
}

function parseBoolean(value: string | undefined) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseTimeoutMs(value: string | undefined) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1_000) : undefined;
}

export async function readSecret(environment: Partial<NodeJS.ProcessEnv>, name: string) {
  const directValue = environment[name];
  if (directValue) {
    return directValue;
  }

  const filePath = environment[`${name}_FILE`];
  if (!filePath) {
    return undefined;
  }

  try {
    return (await readFile(filePath, "utf8")).replace(/\r?\n$/, "");
  } catch {
    return undefined;
  }
}

export type MailAccount = "request" | "main";

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  timeout?: number;
  user: string;
  password: string;
  fromAddress: string;
  toAddress: string;
};

const accountEnv = {
  request: {
    host: "SMTP_REQUEST_HOST",
    port: "SMTP_REQUEST_PORT",
    secure: "SMTP_REQUEST_SECURE",
    user: "SMTP_REQUEST_USER",
    password: "SMTP_REQUEST_PASSWORD",
    from: "MAIL_REQUEST_FROM_ADDRESS",
    to: "MAIL_REQUEST_TO_ADDRESS",
  },
  main: {
    host: "SMTP_MAIN_HOST",
    port: "SMTP_MAIN_PORT",
    secure: "SMTP_MAIN_SECURE",
    user: "SMTP_MAIN_USER",
    password: "SMTP_MAIN_PASSWORD",
    from: "MAIL_MAIN_FROM_ADDRESS",
    to: "MAIL_MAIN_TO_ADDRESS",
  },
} as const;

export async function getMailConfig(
  environment: Partial<NodeJS.ProcessEnv> = process.env,
  account: MailAccount = "request",
): Promise<MailConfig | null> {
  const names = accountEnv[account];
  const host = (environment[names.host] ?? environment.SMTP_HOST)?.trim();
  const user = environment[names.user]?.trim();
  const password = await readSecret(environment, names.password);
  const port = Number(environment[names.port] ?? environment.SMTP_PORT ?? "587");

  if (!host || !user || !password || !Number.isInteger(port) || port < 1 || port > 65_535) {
    return null;
  }

  const secure =
    parseBoolean(environment[names.secure]) ??
    parseBoolean(environment.SMTP_SECURE) ??
    parseBoolean(environment.MAIL_USE_SSL) ??
    port === 465;
  return {
    host,
    port,
    secure,
    requireTLS: parseBoolean(environment.MAIL_USE_STARTTLS) ?? !secure,
    timeout: parseTimeoutMs(environment.MAIL_TIMEOUT_SECONDS),
    user,
    password,
    fromAddress: environment[names.from]?.trim() ?? (account === "main" ? user : "anfrage@munich-bike-rental.de"),
    toAddress: environment[names.to]?.trim() ?? (account === "main" ? "" : "hallo@munich-bike-rental.de"),
  };
}

export function createOrderNumber(date = new Date()) {
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
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `#${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

export type SentMail = { messageId: string | null };

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

function fallbackMailHtml(subject: string, text: string) {
  return renderEmailLayout({
    locale: "de",
    preheader: subject,
    eyebrow: "Your Bike Rental",
    title: subject,
    content: emailCard(emailParagraph(text)),
  });
}

export async function sendConfiguredMail({
  account,
  subject,
  text,
  html,
  attachments,
  to,
  replyTo,
  inReplyTo,
  references,
}: {
  account: MailAccount;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
  to: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string | string[];
}): Promise<SentMail | null> {
  const config = await getMailConfig(process.env, account);
  if (!config) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    connectionTimeout: config.timeout,
    greetingTimeout: config.timeout,
    socketTimeout: config.timeout,
    disableFileAccess: true,
    disableUrlAccess: true,
    auth: { user: config.user, pass: config.password },
  });

  const result = await transporter.sendMail({
    from: `Munich Rental <${config.fromAddress}>`,
    to,
    replyTo,
    inReplyTo,
    references,
    subject,
    text,
    // Keep the HTML part present even for older/admin-created outbox rows that
    // predate the shared templates. The plain-text part is always sent too.
    html: html?.trim() || fallbackMailHtml(subject, text),
    attachments,
  });

  return { messageId: typeof result.messageId === "string" ? result.messageId : null };
}

export async function sendInquiryMail({ subject, text, replyTo }: { subject: string; text: string; replyTo: string }) {
  const config = await getMailConfig(process.env, "request");
  if (!config || !config.toAddress) return null;

  return sendConfiguredMail({ account: "request", subject, text, to: config.toAddress, replyTo });
}
