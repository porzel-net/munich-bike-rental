import { repairMojibake } from "./text";

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
