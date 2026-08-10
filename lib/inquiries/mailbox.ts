import { ImapFlow } from "imapflow";

import { eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { bookings, communicationMessages } from "../db/schema";

import { readSecret } from "./server";
import { parseMailMessageIds } from "./mail-thread";
import { repairMojibake } from "./text";
import { reviewBookingEmailThread } from "./email-action";

type MailboxConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  sentMailbox: string;
  rejectedMailbox: string;
  ownAddresses: string[];
};

const MAX_MAIL_SOURCE_BYTES = 1_000_000;
const MAX_MAIL_PARSE_DEPTH = 10;
const MAX_MAIL_PARTS = 100;

export type MailboxOperationResult =
  | { configured: false; moved: false; reason: "not_configured" | "not_found" }
  | { configured: true; moved: boolean; reason?: "not_found" | "move_failed" };

async function getMailboxConfig(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  const host = environment.IMAP_MAIN_HOST?.trim();
  const user = environment.IMAP_MAIN_USER?.trim();
  const password = await readSecret(environment, "IMAP_MAIN_PASSWORD");
  const port = Number(environment.IMAP_MAIN_PORT ?? "993");

  if (!host || !user || !password || !Number.isInteger(port) || port < 1 || port > 65_535) return null;

  return {
    host,
    port,
    secure: environment.IMAP_MAIN_SECURE !== "false",
    user,
    password,
    sentMailbox: environment.IMAP_MAIN_SENT_MAILBOX?.trim() || "Sent",
    rejectedMailbox: environment.IMAP_MAIN_REJECTED_MAILBOX?.trim() || "Abgelehnt",
    ownAddresses: [
      user,
      environment.SMTP_MAIN_USER,
      environment.MAIL_MAIN_FROM_ADDRESS,
      environment.SMTP_REQUEST_USER,
      environment.MAIL_REQUEST_FROM_ADDRESS,
      "anfrage@munich-bike-rental.de",
    ]
      .map((address) => address?.trim().toLocaleLowerCase())
      .filter((address): address is string => Boolean(address)),
  } satisfies MailboxConfig;
}

function unfoldHeaders(source: string) {
  const separator = source.search(/\r?\n\r?\n/);
  const headerSource = separator >= 0 ? source.slice(0, separator) : source;
  const headers = new Map<string, string>();
  for (const line of headerSource.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) headers.set(match[1].toLowerCase(), match[2]);
  }
  return { headers, body: separator >= 0 ? source.slice(separator).replace(/^\r?\n\r?\n/, "") : "" };
}

function headerParameter(value: string | undefined, name: string) {
  return (
    value?.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]+)"|([^;\\s]+))`, "i"))?.[1] ??
    value?.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]+)"|([^;\\s]+))`, "i"))?.[2]
  );
}

function decodeBytes(bytes: Buffer, charset: string | undefined) {
  const normalized = charset?.trim().toLowerCase();
  return normalized === "iso-8859-1" || normalized === "latin1" || normalized === "windows-1252"
    ? bytes.toString("latin1")
    : bytes.toString("utf8");
}

function decodeQuotedPrintable(body: string) {
  const bytes: number[] = [];
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === "=" && /^[0-9a-f]{2}$/i.test(body.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(body.slice(index + 1, index + 3), 16));
      index += 2;
    } else if (body[index] === "=" && (body[index + 1] === "\r" || body[index + 1] === "\n")) {
      if (body[index + 1] === "\r" && body[index + 2] === "\n") index += 2;
      else index += 1;
    } else {
      bytes.push(body.charCodeAt(index));
    }
  }
  return Buffer.from(bytes);
}

function decodeTransferEncoding(body: string, encoding: string | undefined, charset: string | undefined) {
  const normalized = encoding?.trim().toLowerCase();
  if (normalized === "base64") return decodeBytes(Buffer.from(body.replace(/\s+/g, ""), "base64"), charset);
  if (normalized === "quoted-printable") return decodeBytes(decodeQuotedPrintable(body), charset);
  return body;
}

function splitMultipart(body: string, boundary: string) {
  const marker = `--${boundary}`;
  return body
    .split(marker)
    .slice(1)
    .filter((part) => !part.trim().startsWith("--"))
    .map((part) => part.replace(/^\r?\n/, "").replace(/\r?\n$/, ""));
}

function htmlToText(body: string) {
  return body
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>(?=\s*)/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function extractMimeText(source: string, depth = 0): { plain: string; html: string } {
  if (depth > MAX_MAIL_PARSE_DEPTH) return { plain: "", html: "" };
  const { headers, body } = unfoldHeaders(source);
  const contentType = headers.get("content-type") ?? "text/plain";
  const boundary = headerParameter(contentType, "boundary");
  if (boundary) {
    const parts = splitMultipart(body, boundary)
      .slice(0, MAX_MAIL_PARTS)
      .map((part) => extractMimeText(part, depth + 1));
    return {
      plain: parts.map((part) => part.plain).find(Boolean) ?? "",
      html: parts.map((part) => part.html).find(Boolean) ?? "",
    };
  }
  const decoded = decodeTransferEncoding(
    body,
    headers.get("content-transfer-encoding"),
    headerParameter(contentType, "charset"),
  );
  return contentType.toLowerCase().startsWith("text/html")
    ? { plain: "", html: decoded }
    : { plain: decoded, html: "" };
}

function plainTextFromSource(source: Buffer | string | undefined) {
  const boundedSource = Buffer.isBuffer(source)
    ? source.subarray(0, MAX_MAIL_SOURCE_BYTES).toString()
    : (source ?? "").slice(0, MAX_MAIL_SOURCE_BYTES);
  const { plain, html } = extractMimeText(boundedSource);
  return repairMojibake(plain || htmlToText(html))
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 100_000);
}

/** Archive matching IMAP messages as plain text; the DB remains the fallback. */
export async function syncBookingMailThread(
  db: AppDatabase,
  bookingId: number,
  orderNumber: string,
  options: { reviewNewMessages?: boolean } = {},
) {
  const config = await getMailboxConfig();
  if (!config) return { configured: false, synced: 0 };
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    disableAutoIdle: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  let synced = 0;
  let inferredLocale: "de" | "en" | null = null;
  const newMessageIds: number[] = [];
  try {
    await client.connect();
    for (const mailbox of await getSearchMailboxes(client, config)) {
      let lock;
      try {
        lock = await client.getMailboxLock(mailbox, { readOnly: true });
        const matches = await client.search({ text: orderNumber }, { uid: true });
        if (!matches || !matches.length) continue;
        for await (const message of client.fetch(
          matches.slice(-50),
          { envelope: true, source: { start: 0, maxLength: MAX_MAIL_SOURCE_BYTES }, internalDate: true },
          { uid: true },
        )) {
          const messageId = message.envelope?.messageId;
          if (!messageId) continue;
          const sender = message.envelope?.from?.[0]?.address ?? "unknown";
          const recipients = (message.envelope?.to ?? [])
            .map((address) => address.address ?? "")
            .filter(Boolean)
            .join(", ");
          const subject = message.envelope?.subject ?? "";
          const headers = unfoldHeaders(message.source?.toString() ?? "").headers;
          const inReplyTo = message.envelope?.inReplyTo ?? headers.get("in-reply-to") ?? null;
          const referencesHeader = headers.get("references")?.trim() || null;
          const references = parseMailMessageIds(referencesHeader);
          if (/^New bike inquiry\b/i.test(subject)) inferredLocale = "en";
          if (/^Neue Bike-Anfrage\b/i.test(subject)) inferredLocale = "de";
          const sentAt =
            message.internalDate instanceof Date
              ? message.internalDate
              : message.internalDate
                ? new Date(message.internalDate)
                : new Date();
          const existing = db
            .select({ id: communicationMessages.id })
            .from(communicationMessages)
            .where(eq(communicationMessages.rfcMessageId, messageId))
            .get();
          const values = {
            bookingId,
            direction: config.ownAddresses.includes(sender.toLocaleLowerCase()) ? "outbound" : "inbound",
            rfcMessageId: messageId,
            threadMessageId: references[0] ?? inReplyTo ?? messageId,
            inReplyTo,
            referencesHeader,
            sender,
            recipients,
            subject,
            plainText: plainTextFromSource(message.source),
            sentAt,
            archivedAt: new Date(),
          } as const;
          if (existing) {
            db.update(communicationMessages).set(values).where(eq(communicationMessages.id, existing.id)).run();
          } else {
            db.insert(communicationMessages).values(values).run();
            const inserted = db
              .select({ id: communicationMessages.id })
              .from(communicationMessages)
              .where(eq(communicationMessages.rfcMessageId, messageId))
              .get();
            if (inserted) newMessageIds.push(inserted.id);
          }
          synced += 1;
        }
      } catch {
        // A localized or unavailable mailbox should not prevent checking the next one.
      } finally {
        lock?.release();
      }
    }
    if (inferredLocale)
      db.update(bookings)
        .set({ communicationLocale: inferredLocale, updatedAt: new Date() })
        .where(eq(bookings.id, bookingId))
        .run();
    if (options.reviewNewMessages !== false) {
      for (const newMessageId of newMessageIds) await reviewBookingEmailThread(db, bookingId, newMessageId);
    }
    return { configured: true, synced };
  } catch {
    return { configured: true, synced, error: "imap_unavailable" as const };
  } finally {
    await client.logout().catch(() => client.close());
  }
}

function uniqueMailboxes(mailboxes: string[]) {
  return [...new Set(mailboxes.filter(Boolean))];
}

async function getSearchMailboxes(client: ImapFlow, config: MailboxConfig) {
  const listed = await client.list();
  return uniqueMailboxes(["INBOX", config.sentMailbox, ...listed.map((mailbox) => mailbox.path)]);
}

export type LatestBookingThreadMessage = {
  messageId: string;
  inReplyTo: string | null;
  referencesHeader: string | null;
  timestamp: number;
};

export async function findLatestBookingThreadMessage(orderNumber: string): Promise<LatestBookingThreadMessage | null> {
  const config = await getMailboxConfig();
  if (!config) return null;

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    disableAutoIdle: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  let latest: LatestBookingThreadMessage | null = null;

  try {
    await client.connect();
    for (const mailbox of await getSearchMailboxes(client, config)) {
      let lock;
      try {
        lock = await client.getMailboxLock(mailbox, { readOnly: true });
        const matches = await client.search({ text: orderNumber }, { uid: true });
        if (matches && matches.length) {
          for await (const message of client.fetch(
            matches.slice(-50),
            { envelope: true, internalDate: true, source: { start: 0, maxLength: MAX_MAIL_SOURCE_BYTES } },
            { uid: true },
          )) {
            const messageId = message.envelope?.messageId;
            if (!messageId) continue;
            const headers = unfoldHeaders(message.source?.toString() ?? "").headers;
            const inReplyTo = message.envelope?.inReplyTo ?? headers.get("in-reply-to") ?? null;
            const referencesHeader = headers.get("references")?.trim() || null;
            const internalDate =
              message.internalDate instanceof Date
                ? message.internalDate
                : message.internalDate
                  ? new Date(message.internalDate)
                  : message.envelope?.date;
            const timestamp = internalDate?.getTime() ?? 0;
            if (!latest || timestamp >= latest.timestamp)
              latest = { messageId, inReplyTo, referencesHeader, timestamp };
          }
        }
      } catch {
        // A localized or unavailable mailbox should not prevent checking the next one.
      } finally {
        lock?.release();
      }
    }
  } catch {
    return null;
  } finally {
    await client.logout().catch(() => client.close());
  }

  return latest;
}

export async function findBookingThreadMessageId(orderNumber: string): Promise<string | null> {
  return (await findLatestBookingThreadMessage(orderNumber))?.messageId ?? null;
}

export async function moveMailToMailbox(
  messageId: string | null,
  targetMailbox: string,
): Promise<MailboxOperationResult> {
  const config = await getMailboxConfig();
  if (!config) return { configured: false, moved: false, reason: "not_configured" };
  if (!messageId) return { configured: true, moved: false, reason: "not_found" };

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    disableAutoIdle: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await client.connect();
    const mailboxes = await client.list();
    if (!mailboxes.some((mailbox) => mailbox.path === targetMailbox)) {
      await client.mailboxCreate(targetMailbox).catch(() => undefined);
    }

    let moveFailed = false;
    for (const mailbox of uniqueMailboxes([config.sentMailbox, "INBOX"])) {
      let lock;
      try {
        lock = await client.getMailboxLock(mailbox);
        const matches = await client.search({ text: messageId }, { uid: true });
        if (matches && matches.length) {
          const moved = await client.messageMove(matches.slice(-1), targetMailbox, { uid: true });
          if (moved) return { configured: true, moved: true };
        }
      } catch {
        moveFailed = true;
      } finally {
        lock?.release();
      }
    }
    return { configured: true, moved: false, reason: moveFailed ? "move_failed" : "not_found" };
  } catch {
    return { configured: true, moved: false, reason: "move_failed" };
  } finally {
    await client.logout().catch(() => client.close());
  }
}

export async function moveMailToRejectedMailbox(messageId: string | null): Promise<MailboxOperationResult> {
  const rejectedMailbox = process.env.IMAP_MAIN_REJECTED_MAILBOX?.trim() || "Abgelehnt";
  return moveMailToMailbox(messageId, rejectedMailbox);
}
