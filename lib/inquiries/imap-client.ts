import { ImapFlow, type ImapFlowOptions } from "imapflow";

let imapQueue: Promise<void> = Promise.resolve();
const IMAP_RETRY_COOLDOWN_MS = 60_000;
let imapCooldownUntil = 0;
let imapCooldownFailure: PublicImapFailure | null = null;

/** Keeps simultaneous application requests from opening parallel sessions to the same mailbox. */
export function withExclusiveImap<T>(operation: () => Promise<T>): Promise<T> {
  const result = imapQueue.then(operation, operation);
  imapQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function createImapClient(options: ImapFlowOptions, operation: string) {
  const client = new ImapFlow({ ...options, logger: false });
  client.on("error", (error) => logImapFailure(operation, error));
  return client;
}

export async function closeImapClient(client: ImapFlow) {
  if (!client.usable) {
    client.close();
    return;
  }

  try {
    await client.logout();
  } catch {
    client.close();
  }
}

export type PublicImapFailure = "authentication_failed" | "temporarily_unavailable";

export function getPublicImapFailure(error: unknown): PublicImapFailure {
  if (error && typeof error === "object" && "authenticationFailed" in error && error.authenticationFailed === true) {
    return "authentication_failed";
  }
  return "temporarily_unavailable";
}

export function recordImapFailure(error: unknown) {
  imapCooldownFailure = getPublicImapFailure(error);
  imapCooldownUntil = Date.now() + IMAP_RETRY_COOLDOWN_MS;
  return imapCooldownFailure;
}

/** Avoids retrying a failed shared mailbox once per booking during background sync. */
export function getImapCooldownFailure() {
  if (Date.now() >= imapCooldownUntil) {
    imapCooldownFailure = null;
    return null;
  }
  return imapCooldownFailure;
}

export function logImapFailure(operation: string, error: unknown) {
  const candidate = error && typeof error === "object" ? error : {};
  const code = "code" in candidate && typeof candidate.code === "string" ? candidate.code : undefined;
  const reason =
    "reason" in candidate && typeof candidate.reason === "string" ? candidate.reason.slice(0, 160) : undefined;
  const authenticationFailed = "authenticationFailed" in candidate && candidate.authenticationFailed === true;

  console.warn("IMAP operation failed", { operation, code, reason, authenticationFailed });
}
