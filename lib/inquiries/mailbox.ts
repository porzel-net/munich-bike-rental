import { ImapFlow } from "imapflow";

import { readSecret } from "./server";

type MailboxConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  sentMailbox: string;
  rejectedMailbox: string;
};

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
  } satisfies MailboxConfig;
}

function uniqueMailboxes(mailboxes: string[]) {
  return [...new Set(mailboxes.filter(Boolean))];
}

async function getSearchMailboxes(client: ImapFlow, config: MailboxConfig) {
  const listed = await client.list();
  const paths = listed.map((mailbox) => mailbox.path);
  return uniqueMailboxes([
    "INBOX",
    config.sentMailbox,
    ...paths.filter((path) => /inbox|posteingang|sent|gesendet/i.test(path)),
  ]);
}

export async function findBookingThreadMessageId(orderNumber: string): Promise<string | null> {
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

  try {
    await client.connect();
    for (const mailbox of await getSearchMailboxes(client, config)) {
      let lock;
      try {
        lock = await client.getMailboxLock(mailbox, { readOnly: true });
        const matches = await client.search({ text: orderNumber }, { uid: true });
        if (matches && matches.length) {
          let messageId: string | null = null;
          for await (const message of client.fetch(matches.slice(-5), { envelope: true }, { uid: true })) {
            messageId = message.envelope?.messageId ?? messageId;
          }
          if (messageId) return messageId;
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

  return null;
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
