/**
 * Deterministic receipt matching.  This module deliberately contains no model
 * calls: every recommendation can be reconstructed from the extracted text,
 * bank transaction and already confirmed allocations.
 */

const ignoredMerchantWords = new Set([
  "ab",
  "and",
  "amount",
  "betrag",
  "der",
  "die",
  "ein",
  "eine",
  "eur",
  "for",
  "gmbh",
  "inc",
  "invoice",
  "jpeg",
  "jpg",
  "ltd",
  "rechnung",
  "pdf",
  "png",
  "gesamtbetrag",
  "summe",
  "the",
  "total",
  "und",
  "von",
  "webp",
]);

export type ReceiptAmount = { amountCents: number; label: string | null };

export type ReceiptMatchCandidate = {
  transactionId: number;
  amountCents: number;
  bookedAt: string;
  merchantText: string;
};

export type ReceiptCategoryPattern = {
  merchantText: string;
  categoryId: number;
  categoryCode: string;
};

export type ReceiptMatchSuggestion = {
  transactionId: number;
  score: number;
  amountCents: number;
  categoryId: number | null;
  categoryCode: string | null;
  categorySource: "recurring_pattern" | null;
  matchReason: "invoice_reference" | "amount_and_merchant";
};

function normalizedReference(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

/** Finds explicitly labelled invoice identifiers, never arbitrary number sequences. */
export function extractInvoiceNumberCandidates(text: string) {
  const expression =
    /(?:rechnungs(?:nummer|nr\.?)|invoice(?:\s*(?:number|no\.?|#))?)\s*[:#-]?\s*([a-z0-9][a-z0-9./_-]{2,60})/giu;
  return [
    ...new Set(
      [...text.matchAll(expression)].map((match) => normalizedReference(match[1])).filter((value) => value.length >= 4),
    ),
  ];
}

function toCents(raw: string) {
  const cleaned = raw.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalAt = Math.max(lastComma, lastDot);
  if (decimalAt < 0) return null;
  const integer = cleaned.slice(0, decimalAt).replace(/[.,-]/g, "");
  const decimals = cleaned.slice(decimalAt + 1).replace(/\D/g, "");
  if (!/^\d+$/.test(integer) || !/^\d{2}$/.test(decimals)) return null;
  const cents = Number(`${integer}${decimals}`);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** Extracts labelled totals first, then a currency amount as a safe fallback. */
export function extractReceiptAmount(text: string): ReceiptAmount | null {
  const normalized = text.replace(/\u00a0/g, " ");
  const amount = "(?:€\\s*)?(\\d{1,3}(?:[.\\s]\\d{3})*[,.]\\d{2}|\\d+[,.]\\d{2})(?:\\s*(?:€|EUR))?";
  const labelled = new RegExp(
    `(?:gesamtbetrag|gesamt|rechnungsbetrag|zahlbetrag|betrag\\s+fällig|amount\\s+due|grand\\s+total|total|summe)\\s*[:=]?\\s*${amount}`,
    "giu",
  );
  const labelledMatches = [...normalized.matchAll(labelled)]
    .map((match) => ({
      amountCents: toCents(match[1]),
      label: match[0]
        .replace(match[1], "")
        .replace(/\bEUR\b|€/giu, "")
        .trim(),
    }))
    .filter((match): match is { amountCents: number; label: string } => match.amountCents !== null);
  if (labelledMatches.length) return labelledMatches[labelledMatches.length - 1];

  const currency = /(?:€\s*)?(\d{1,3}(?:[.\s]\d{3})*[,.]\d{2}|\d+[,.]\d{2})(?:\s*(?:€|EUR))/giu;
  const currencyMatches = [...normalized.matchAll(currency)]
    .map((match) => toCents(match[1]))
    .filter((value): value is number => value !== null);
  return currencyMatches.length ? { amountCents: currencyMatches[currencyMatches.length - 1], label: null } : null;
}

export function merchantTokens(value: string) {
  return new Set(
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("de-DE")
      .split(/[^a-z0-9]+/u)
      .filter((word) => word.length >= 3 && !/^\d+$/u.test(word) && !ignoredMerchantWords.has(word)),
  );
}

function overlap(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

function recurringCategory(tokens: Set<string>, categories: ReceiptCategoryPattern[]) {
  const counts = new Map<number, { category: ReceiptCategoryPattern; count: number }>();
  for (const category of categories) {
    if (overlap(tokens, merchantTokens(category.merchantText)) < 0.75) continue;
    const existing = counts.get(category.categoryId);
    counts.set(category.categoryId, { category, count: (existing?.count ?? 0) + 1 });
  }
  const sorted = [...counts.values()].sort((left, right) => right.count - left.count);
  if (!sorted[0] || sorted[0].count < 2 || sorted[0].count === sorted[1]?.count) return null;
  return sorted[0].category;
}

/**
 * Returns an automatic suggestion only when the amount has exactly one strong
 * transaction match. A category is suggested only from a unanimous repeated
 * allocation. A single historic assignment is never enough to teach a new
 * category rule.
 */
export function suggestReceiptMatch(input: {
  receiptText: string;
  candidates: ReceiptMatchCandidate[];
  categoryPatterns: ReceiptCategoryPattern[];
}): ReceiptMatchSuggestion | null {
  const amount = extractReceiptAmount(input.receiptText);
  const receiptTokens = merchantTokens(input.receiptText);
  const invoiceNumbers = extractInvoiceNumberCandidates(input.receiptText);
  const scored = input.candidates
    .filter((candidate) => candidate.amountCents < 0)
    .map((candidate) => {
      const hasInvoiceReference = invoiceNumbers.some((invoiceNumber) =>
        normalizedReference(candidate.merchantText).includes(invoiceNumber),
      );
      const amountMatches = amount !== null && Math.abs(candidate.amountCents) === amount.amountCents;
      const merchantOverlap = overlap(receiptTokens, merchantTokens(candidate.merchantText));
      return {
        candidate,
        amountMatches,
        hasInvoiceReference,
        score: hasInvoiceReference
          ? 100 + (amountMatches ? 10 : 0)
          : amountMatches
            ? 55 + Math.round(merchantOverlap * 45)
            : 0,
      };
    })
    .filter((candidate) => candidate.score >= 80)
    .sort((left, right) => right.score - left.score || right.candidate.bookedAt.localeCompare(left.candidate.bookedAt));
  const best = scored[0];
  if (!best || best.score < 80 || (scored[1] && best.score - scored[1].score < 10)) return null;

  const recurring = recurringCategory(receiptTokens, input.categoryPatterns);
  return {
    transactionId: best.candidate.transactionId,
    score: best.score,
    amountCents: amount?.amountCents ?? Math.abs(best.candidate.amountCents),
    categoryId: recurring?.categoryId ?? null,
    categoryCode: recurring?.categoryCode ?? null,
    categorySource: recurring ? "recurring_pattern" : null,
    matchReason: best.hasInvoiceReference ? "invoice_reference" : "amount_and_merchant",
  };
}
