import { repairMojibake } from "./text";

export type MailThreadMessage = {
  rfcMessageId: string | null;
  threadMessageId: string | null;
  inReplyTo: string | null;
  referencesHeader: string | null;
};

/** Extracts RFC 5322 message IDs while keeping their original angle brackets. */
export function parseMailMessageIds(value: string | null | undefined) {
  if (!value) return [];
  return [...value.matchAll(/<[^<>\s]+>/g)].map(([messageId]) => messageId);
}

function uniqueMessageIds(messageIds: string[]) {
  return [...new Set(messageIds.filter(Boolean))];
}

/**
 * Builds the References header for a reply. Existing References headers are
 * preferred; older archived messages without them are reconstructed through
 * the stored In-Reply-To chain.
 */
export function buildMailThreadReferences(
  parentMessageId: string,
  parent: MailThreadMessage | null,
  messages: readonly MailThreadMessage[] = [],
) {
  if (!parent) return [parentMessageId];

  const byMessageId = new Map(
    messages
      .filter((message): message is MailThreadMessage & { rfcMessageId: string } => Boolean(message.rfcMessageId))
      .map((message) => [message.rfcMessageId, message]),
  );
  const references = parseMailMessageIds(parent.referencesHeader);
  if (references.length) return uniqueMessageIds([...references, parentMessageId]);

  const reconstructed: string[] = [];
  const visited = new Set<string>();
  let current: MailThreadMessage | undefined = parent;
  while (current) {
    const currentMessageId = current.rfcMessageId;
    if (!currentMessageId || visited.has(currentMessageId)) break;
    visited.add(currentMessageId);

    const replyTo = current.inReplyTo;
    if (!replyTo) break;
    reconstructed.unshift(replyTo);
    current = byMessageId.get(replyTo);
  }

  if (parent.threadMessageId) reconstructed.unshift(parent.threadMessageId);
  return uniqueMessageIds([...reconstructed, parentMessageId]);
}

function isQuotedHistoryLine(line: string) {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith(">") ||
    /^-+\s*Original Message\s*-+$/i.test(trimmed) ||
    /^-+\s*Forwarded message\s*-+$/i.test(trimmed) ||
    /^On .+ wrote:$/i.test(trimmed) ||
    /^Am .+ schrieb .*:$/i.test(trimmed)
  );
}

export type SplitMailThreadBody = {
  visibleText: string | null;
  quotedText: string | null;
};

/**
 * Splits a plain-text mail body into the visible reply and the quoted history below it.
 */
export function splitMailThreadBody(value: string): SplitMailThreadBody {
  const normalized = repairMojibake(value).replace(/\r\n/g, "\n").trimEnd();
  if (!normalized) return { visibleText: null, quotedText: null };

  // Do not render already-persisted binary attachment data as thousands of
  // replacement/control characters while the message is being re-synced.
  const controlCharacters = (normalized.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g) ?? []).length;
  if (normalized.includes("\u0000") || controlCharacters > Math.max(3, normalized.length / 100)) {
    return { visibleText: "Der Inhalt dieser E-Mail konnte nicht gelesen werden.", quotedText: null };
  }

  const lines = normalized.split("\n");
  const quoteStartIndex = lines.findIndex(isQuotedHistoryLine);
  if (quoteStartIndex === -1) return { visibleText: normalized, quotedText: null };

  const visibleText = lines.slice(0, quoteStartIndex).join("\n").trimEnd();
  const quotedText = lines.slice(quoteStartIndex).join("\n").trimEnd();
  return {
    visibleText: visibleText || null,
    quotedText: quotedText || null,
  };
}
