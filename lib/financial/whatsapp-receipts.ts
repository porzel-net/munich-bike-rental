import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  authUser,
  financialCategories,
  financialTransactionAllocations,
  financialTransactions,
  whatsappReceiptIntake,
} from "../db/schema";
import { linkFinancialDocument, storeFinancialDocument } from "./documents";
import {
  extractInvoiceNumberCandidates,
  extractReceiptAmount,
  suggestReceiptMatch,
  type ReceiptCategoryPattern,
} from "./receipt-matching";
import { recognizeFinancialDocumentText } from "./receipt-text";

function normalizedPhone(value: string) {
  return value.replace(/\D/g, "").replace(/^00/, "");
}

export function isAuthorizedWhatsAppReceiptSender(db: AppDatabase, phone: string) {
  const normalizedSender = normalizedPhone(phone);
  if (normalizedSender.length < 8) return false;
  return db
    .select({ whatsappPhone: authUser.whatsappPhone })
    .from(authUser)
    .where(and(eq(authUser.role, "admin"), eq(authUser.banned, false)))
    .all()
    .some((user) => user.whatsappPhone && normalizedPhone(user.whatsappPhone) === normalizedSender);
}

function receiptDescription(fileName: string, caption: string) {
  return ["WhatsApp-Beleg", fileName.trim(), caption.trim()].filter(Boolean).join(": ").slice(0, 1_000);
}

function transactionMerchantText(row: {
  counterpartyNameSnapshot: string | null;
  reference: string;
  description: string;
}) {
  return [row.counterpartyNameSnapshot, row.reference, row.description].filter(Boolean).join(" ");
}

function formatAmount(amountCents: number, currency = "EUR") {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amountCents / 100);
}

export type WhatsAppReceiptResult =
  | { outcome: "ignored"; message: string }
  | { outcome: "duplicate"; message: string }
  | { outcome: "stored"; message: string; documentId: number; extractedAmountCents: number | null }
  | {
      outcome: "matched";
      message: string;
      documentId: number;
      transactionId: number;
      extractedAmountCents: number;
    };

/** Processes one already-downloaded WhatsApp PDF/image in an idempotent way. */
export async function processWhatsAppFinancialReceipt(
  db: AppDatabase,
  input: {
    messageId: string;
    senderPhone: string;
    fileName: string;
    mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
    bytes: Uint8Array;
    caption?: string;
  },
): Promise<WhatsAppReceiptResult> {
  const existing = db
    .select({ id: whatsappReceiptIntake.id })
    .from(whatsappReceiptIntake)
    .where(eq(whatsappReceiptIntake.whatsappMessageId, input.messageId))
    .get();
  if (existing) return { outcome: "duplicate", message: "Dieser Beleg wurde bereits verarbeitet." };

  const sender = db
    .select({ id: authUser.id, whatsappPhone: authUser.whatsappPhone })
    .from(authUser)
    .where(and(eq(authUser.role, "admin"), eq(authUser.banned, false)))
    .all()
    .find((user) => user.whatsappPhone && normalizedPhone(user.whatsappPhone) === normalizedPhone(input.senderPhone));
  if (!sender) {
    console.warn("Incoming WhatsApp receipt ignored because its sender is not an active admin");
    return {
      outcome: "ignored",
      message: "Belege werden nur von einer im Admin-Konto hinterlegten WhatsApp-Nummer angenommen.",
    };
  }

  // Copy into an ordinary ArrayBuffer-backed view; Baileys may provide a
  // Buffer backed by SharedArrayBuffer, which the web File constructor rejects.
  const fileBytes = new Uint8Array(input.bytes.byteLength);
  fileBytes.set(input.bytes);
  const document = await storeFinancialDocument(db, {
    file: new File([fileBytes], input.fileName || "WhatsApp-Beleg", { type: input.mimeType }),
    userId: sender.id,
    description: receiptDescription(input.fileName, input.caption ?? ""),
  });
  // WhatsApp can replay media history with a new message ID after a reconnect.
  // The document hash is the durable idempotency key in that case.
  const existingDocumentIntake = db
    .select({ id: whatsappReceiptIntake.id })
    .from(whatsappReceiptIntake)
    .where(eq(whatsappReceiptIntake.documentId, document.documentId))
    .get();
  if (existingDocumentIntake) {
    console.info("Incoming WhatsApp receipt ignored because the same document was already processed", {
      documentId: document.documentId,
    });
    return { outcome: "duplicate", message: "Dieser Beleg wurde bereits verarbeitet." };
  }
  const ocrText = await recognizeFinancialDocumentText(input.bytes, input.mimeType);
  const receiptText = [input.fileName, input.caption, ocrText].filter(Boolean).join("\n");
  const extracted = extractReceiptAmount(receiptText);
  const invoiceReferenceCount = extractInvoiceNumberCandidates(receiptText).length;

  const transactionRows = db.select().from(financialTransactions).all();
  const allocationRows = db.select().from(financialTransactionAllocations).all();
  const allocatedTransactionIds = new Set(allocationRows.map((row) => row.transactionId));
  const candidates = transactionRows
    .filter(
      (row) =>
        row.source === "bank" &&
        row.amountCents < 0 &&
        ["imported", "needs_review"].includes(row.status) &&
        !allocatedTransactionIds.has(row.id),
    )
    .map((row) => ({
      transactionId: row.id,
      amountCents: row.amountCents,
      bookedAt: row.bookedAt,
      merchantText: transactionMerchantText(row),
    }));
  const categories = db.select().from(financialCategories).where(eq(financialCategories.isActive, true)).all();
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const patterns: ReceiptCategoryPattern[] = allocationRows
    .filter((allocation) => allocation.categoryId !== null)
    .flatMap((allocation) => {
      const transaction = transactionRows.find((row) => row.id === allocation.transactionId);
      const category = allocation.categoryId ? categoryById.get(allocation.categoryId) : undefined;
      if (!transaction || transaction.status !== "posted" || !category) return [];
      return [
        { merchantText: transactionMerchantText(transaction), categoryId: category.id, categoryCode: category.code },
      ];
    });
  const suggestion = suggestReceiptMatch({ receiptText, candidates, categoryPatterns: patterns });
  const now = new Date();

  console.info("WhatsApp receipt extracted and evaluated", {
    mimeType: input.mimeType,
    ocrTextDetected: ocrText.length > 0,
    amountDetected: extracted !== null,
    invoiceReferenceCount,
    openCandidateCount: candidates.length,
    historicalCategoryPatternCount: patterns.length,
    matched: suggestion !== null,
  });

  if (!suggestion) {
    db.insert(whatsappReceiptIntake)
      .values({
        whatsappMessageId: input.messageId,
        senderUserId: sender.id,
        documentId: document.documentId,
        status: "received",
        extractedAmountCents: extracted?.amountCents ?? null,
        details: extracted
          ? "Betrag erkannt, aber keine eindeutige Banktransaktion."
          : "Kein belastbarer Rechnungsbetrag erkannt.",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    console.info("WhatsApp receipt reconciliation completed", {
      outcome: "stored",
      documentId: document.documentId,
      amountDetected: extracted !== null,
    });
    return {
      outcome: "stored",
      documentId: document.documentId,
      extractedAmountCents: extracted?.amountCents ?? null,
      message: extracted
        ? "Beleg gespeichert. Für den Betrag wurde keine eindeutige offene Banktransaktion gefunden."
        : "Beleg gespeichert. Der Betrag konnte nicht sicher gelesen werden.",
    };
  }

  linkFinancialDocument(db, {
    transactionId: suggestion.transactionId,
    documentId: document.documentId,
    description: "Automatisch aus WhatsApp zugeordneter Beleg",
  });
  const categoryId = suggestion.categoryId;
  const matchedTransaction = transactionRows.find((transaction) => transaction.id === suggestion.transactionId);
  const categoryName = categoryId ? categoryById.get(categoryId)?.name : null;
  const transactionDescription = matchedTransaction
    ? [matchedTransaction.counterpartyNameSnapshot, matchedTransaction.description || matchedTransaction.reference]
        .filter(Boolean)
        .join(" – ")
    : "unbekannte Gegenpartei";
  const matchExplanation =
    suggestion.matchReason === "invoice_reference"
      ? "Eindeutig über die Rechnungsnummer abgeglichen."
      : "Über Betrag und Gegenpartei abgeglichen.";
  const classification = `Betrag ${formatAmount(suggestion.amountCents)} → Banktransaktion #${suggestion.transactionId} (${transactionDescription}). ${matchExplanation}`;
  // A WhatsApp match may be strong enough to propose a category, but never
  // commits a journal entry. A human must explicitly approve it in the review
  // inbox before the transaction becomes posted.
  db.update(financialTransactions)
    .set({
      status: "pending_approval",
      suggestedCategoryId: categoryId,
      suggestedAt: now,
      updatedAt: now,
    })
    .where(eq(financialTransactions.id, suggestion.transactionId))
    .run();
  db.insert(whatsappReceiptIntake)
    .values({
      whatsappMessageId: input.messageId,
      senderUserId: sender.id,
      documentId: document.documentId,
      transactionId: suggestion.transactionId,
      status: "matched",
      extractedAmountCents: suggestion.amountCents,
      matchScore: suggestion.score,
      details: categoryId
        ? `${classification} Kategorie „${categoryName ?? suggestion.categoryCode}“ vorgeschlagen; menschliche Freigabe erforderlich.`
        : `${classification} Beleg zugeordnet; menschliche sachliche Zuordnung und Freigabe erforderlich.`,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  console.info("WhatsApp receipt reconciliation completed", {
    outcome: "matched",
    transactionId: suggestion.transactionId,
    documentId: document.documentId,
    matchReason: suggestion.matchReason,
    categorySuggestedFromHistory: suggestion.categorySource === "recurring_pattern",
  });
  return {
    outcome: "matched",
    documentId: document.documentId,
    transactionId: suggestion.transactionId,
    extractedAmountCents: suggestion.amountCents,
    message: categoryId
      ? `${classification} Kategorie „${categoryName ?? suggestion.categoryCode}“ wurde vorgeschlagen. Bitte in der Finanzprüfung freigeben.`
      : `${classification} Der Beleg ist zugeordnet. Bitte die sachliche Kategorie ergänzen und anschließend freigeben.`,
  };
}
