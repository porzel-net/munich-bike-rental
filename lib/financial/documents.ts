import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { financialDocumentLinks, financialDocuments, financialTransactions } from "../db/schema";
import { BookingCommandError } from "../bookings/errors";

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function documentDirectory() {
  return resolve(
    process.env.FINANCIAL_DOCUMENTS_DIR?.trim() ||
      (process.env.NODE_ENV === "production" ? "/data/financial-documents" : "./data/financial-documents"),
  );
}

export function financialDocumentPath(storageKey: string) {
  if (!storageKey || storageKey.includes("/") || storageKey.includes("\\") || storageKey === "." || storageKey === "..")
    throw new BookingCommandError("Ungültiger Belegpfad.");
  return resolve(documentDirectory(), storageKey);
}

function safeFileName(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(-120) || "beleg";
}

export async function attachFinancialDocument(
  db: AppDatabase,
  input: { transactionId: number; file: File; userId: string; description?: string },
) {
  const transaction = db
    .select({ id: financialTransactions.id })
    .from(financialTransactions)
    .where(eq(financialTransactions.id, input.transactionId))
    .get();
  if (!transaction) throw new BookingCommandError("Banktransaktion nicht gefunden.");
  if (input.file.size <= 0 || input.file.size > MAX_DOCUMENT_BYTES)
    throw new BookingCommandError("Der Beleg muss zwischen 1 Byte und 15 MB groß sein.");
  if (!allowedMimeTypes.has(input.file.type))
    throw new BookingCommandError("Erlaubt sind PDF-, JPG-, PNG- und WebP-Belege.");

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = db.select().from(financialDocuments).where(eq(financialDocuments.sha256, sha256)).get();
  let documentId = existing?.id;
  if (!documentId) {
    const storageKey = `${randomUUID()}-${safeFileName(input.file.name)}`;
    await mkdir(documentDirectory(), { recursive: true, mode: 0o700 });
    await writeFile(financialDocumentPath(storageKey), bytes, { mode: 0o600 });
    documentId = db
      .insert(financialDocuments)
      .values({
        documentType: input.file.type === "application/pdf" ? "receipt" : "receipt",
        originalFileName: input.file.name.slice(0, 255) || "Beleg",
        storageKey,
        mimeType: input.file.type,
        sizeBytes: bytes.byteLength,
        sha256,
        description: input.description?.trim() || "",
        uploadedByUserId: input.userId,
        createdAt: new Date(),
      })
      .returning({ id: financialDocuments.id })
      .get().id;
  }

  const linked = db
    .select({ id: financialDocumentLinks.id })
    .from(financialDocumentLinks)
    .where(
      and(
        eq(financialDocumentLinks.documentId, documentId),
        eq(financialDocumentLinks.transactionId, input.transactionId),
      ),
    )
    .get();
  if (!linked) {
    db.insert(financialDocumentLinks)
      .values({
        documentId,
        transactionId: input.transactionId,
        linkType: "evidence",
        note: input.description?.trim() || "Beleg zur Banktransaktion",
        createdAt: new Date(),
      })
      .run();
  }
  return { documentId, sha256 };
}
