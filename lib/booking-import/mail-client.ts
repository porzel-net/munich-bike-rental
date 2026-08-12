import { ImapFlow } from "imapflow";

import { readSecret } from "@/lib/inquiries/server";

import type { BookingImportMail } from "./types";

const MAX_SOURCE_BYTES = 1_000_000;
const MAX_PARTS = 100;
const TRASH_RE = /(?:trash|papierkorb|müll|muell|deleted(?: items| messages)?|gelöschte objekte|bin)/iu;

function headerMap(source: string) {
  const separator = source.search(/\r?\n\r?\n/u);
  const headerText = separator >= 0 ? source.slice(0, separator) : source;
  const headers = new Map<string, string>();
  for (const line of headerText.replace(/\r?\n[ \t]+/gu, " ").split(/\r?\n/u)) {
    const match = line.match(/^([^:]+):\s*(.*)$/u);
    if (match) headers.set(match[1].toLocaleLowerCase(), match[2]);
  }
  return { headers, body: separator >= 0 ? source.slice(separator).replace(/^\r?\n\r?\n/u, "") : "" };
}

function parameter(value: string | undefined, name: string) {
  const match = value?.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]+)"|([^;\\s]+))`, "iu"));
  return match?.[1] ?? match?.[2];
}

function decodeQuotedPrintable(body: string) {
  const bytes: number[] = [];
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === "=" && /^[0-9a-f]{2}$/iu.test(body.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(body.slice(index + 1, index + 3), 16));
      index += 2;
    } else if (body[index] === "=" && /\r?\n/u.test(body.slice(index + 1, index + 3))) {
      index += body[index + 1] === "\r" ? 2 : 1;
    } else bytes.push(body.charCodeAt(index));
  }
  return Buffer.from(bytes);
}

function decodeBytes(bytes: Buffer, charset?: string) {
  const normalized = charset?.trim().toLocaleLowerCase();
  return normalized === "iso-8859-1" || normalized === "latin1" || normalized === "windows-1252"
    ? bytes.toString("latin1")
    : bytes.toString("utf8");
}

function decodeTransfer(body: string, encoding: string | undefined, charset: string | undefined) {
  const normalized = encoding?.trim().toLocaleLowerCase();
  if (normalized === "base64") return decodeBytes(Buffer.from(body.replace(/\s+/gu, ""), "base64"), charset);
  if (normalized === "quoted-printable") return decodeBytes(decodeQuotedPrintable(body), charset);
  return body;
}

function multipart(body: string, boundary: string) {
  return body
    .split(`--${boundary}`)
    .slice(1)
    .filter((part) => !part.trim().startsWith("--"))
    .map((part) => part.replace(/^\r?\n/u, "").replace(/\r?\n$/u, ""));
}

function extractText(source: string, depth = 0): { plain: string; html: string } {
  if (depth > 10) return { plain: "", html: "" };
  const { headers, body } = headerMap(source);
  const contentType = headers.get("content-type") ?? "text/plain";
  const boundary = parameter(contentType, "boundary");
  if (boundary) {
    const parts = multipart(body, boundary)
      .slice(0, MAX_PARTS)
      .map((part) => extractText(part, depth + 1));
    return {
      plain: parts.map((part) => part.plain).find(Boolean) ?? "",
      html: parts.map((part) => part.html).find(Boolean) ?? "",
    };
  }
  const decoded = decodeTransfer(body, headers.get("content-transfer-encoding"), parameter(contentType, "charset"));
  return contentType.toLocaleLowerCase().startsWith("text/html")
    ? { plain: "", html: decoded }
    : { plain: decoded, html: "" };
}

function htmlToText(body: string) {
  return body
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/giu, "")
    .replace(/<br\s*\/?>(?=\s*)/giu, "\n")
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>/giu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&quot;/giu, '"');
}

function plainText(source: Buffer | string | undefined) {
  const bounded = Buffer.isBuffer(source)
    ? source.subarray(0, MAX_SOURCE_BYTES).toString()
    : (source ?? "").slice(0, MAX_SOURCE_BYTES);
  const { plain, html } = extractText(bounded);
  return (plain || htmlToText(html))
    .replace(/\r\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
    .slice(0, 100_000);
}

function firstEmail(value: string | undefined) {
  return value?.match(/\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/iu)?.[0] ?? null;
}

function isTrash(mailbox: { path: string; name: string; specialUse?: string }) {
  return mailbox.specialUse?.toLocaleLowerCase() === "\\trash" || TRASH_RE.test(`${mailbox.path} ${mailbox.name}`);
}

async function getConfig() {
  const host = process.env.IMAP_MAIN_HOST?.trim();
  const user = process.env.IMAP_MAIN_USER?.trim();
  const password = await readSecret(process.env, "IMAP_MAIN_PASSWORD");
  const port = Number(process.env.IMAP_MAIN_PORT ?? "993");
  if (!host || !user || !password || !Number.isInteger(port) || port < 1 || port > 65_535) return null;
  const configuredSender =
    process.env.MAIL_REQUEST_FROM_ADDRESS?.trim().toLocaleLowerCase() || "anfrage@munich-bike-rental.de";
  const inquirySender = configuredSender.startsWith("hallo@")
    ? `anfrage@${configuredSender.split("@")[1]}`
    : configuredSender;
  return { host, user, password, port, secure: process.env.IMAP_MAIN_SECURE !== "false", inquirySender };
}

export async function loadBookingCandidateMails(): Promise<BookingImportMail[]> {
  const config = await getConfig();
  if (!config) return [];
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    disableAutoIdle: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  const result: BookingImportMail[] = [];
  try {
    await client.connect();
    const mailboxes = (await client.list()).filter((mailbox) => !isTrash(mailbox));
    for (const mailbox of mailboxes) {
      let lock: { release(): void } | undefined;
      try {
        lock = await client.getMailboxLock(mailbox.path, { readOnly: true });
        const matches = await client.search({ from: config.inquirySender }, { uid: true });
        if (matches === false || matches.length === 0) continue;
        for await (const message of client.fetch(
          matches,
          { envelope: true, source: { start: 0, maxLength: MAX_SOURCE_BYTES }, internalDate: true },
          { uid: true },
        )) {
          const source = message.source?.toString() ?? "";
          const parsedHeaders = headerMap(source).headers;
          const subject = message.envelope?.subject ?? parsedHeaders.get("subject") ?? null;
          if (/\[test\]/iu.test(subject ?? "")) continue;
          const from = message.envelope?.from?.[0];
          const sender = from?.address?.toLocaleLowerCase() ?? firstEmail(parsedHeaders.get("from"));
          if (sender !== config.inquirySender) continue;
          const recipients = (message.envelope?.to ?? [])
            .map((address) => address.address ?? "")
            .filter(Boolean)
            .join(", ");
          const inReplyTo = message.envelope?.inReplyTo ?? parsedHeaders.get("in-reply-to") ?? null;
          const referencesHeader = parsedHeaders.get("references")?.trim() || null;
          const messageId =
            message.envelope?.messageId ?? parsedHeaders.get("message-id") ?? `${mailbox.path}:${message.uid}`;
          const threadMessageId = referencesHeader?.match(/<[^<>\s]+>/u)?.[0] ?? inReplyTo ?? messageId;
          const internalDate =
            message.internalDate instanceof Date
              ? message.internalDate
              : message.internalDate
                ? new Date(message.internalDate)
                : null;
          result.push({
            id: messageId,
            subject,
            fromEmail: sender,
            fromName: from?.name ?? null,
            replyToEmail: firstEmail(parsedHeaders.get("reply-to")),
            sentAt: internalDate,
            bodyText: plainText(source),
            bodyHtml: null,
            folderName: mailbox.path,
            recipients,
            inReplyTo,
            referencesHeader,
            threadMessageId,
          });
        }
      } catch {
        // A single unavailable/localized mailbox must not abort the full import.
      } finally {
        lock?.release();
      }
    }
    return result;
  } finally {
    await client.logout().catch(() => client.close());
  }
}
