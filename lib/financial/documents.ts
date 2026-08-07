import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { financialDocumentLinks, financialDocuments, financialTransactions } from "../db/schema";
import { BookingCommandError } from "../bookings/errors";

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const MAX_FINANCIAL_DOCUMENT_BYTES = MAX_DOCUMENT_BYTES;
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
  const base = documentDirectory();
  const path = resolve(base, storageKey);
  if (path !== base && !path.startsWith(`${base}/`)) throw new BookingCommandError("Ungültiger Belegpfad.");
  return path;
}

export function detectFinancialDocumentMime(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes);
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  return null;
}

export function safeFinancialDocumentFileName(value: string) {
  const normalized = value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/^-+|-+$/g, "");
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
  if (input.description && input.description.length > 1_000)
    throw new BookingCommandError("Die Belegbeschreibung darf höchstens 1.000 Zeichen enthalten.");
  if (!allowedMimeTypes.has(input.file.type))
    throw new BookingCommandError("Erlaubt sind PDF-, JPG-, PNG- und WebP-Belege.");

  const bytes = Buffer.from(await input.file.arrayBuffer());
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_DOCUMENT_BYTES)
    throw new BookingCommandError("Der Beleg muss zwischen 1 Byte und 15 MB groß sein.");
  if (detectFinancialDocumentMime(bytes) !== input.file.type)
    throw new BookingCommandError("Der Dateityp stimmt nicht mit dem Inhalt des Belegs überein.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = db.select().from(financialDocuments).where(eq(financialDocuments.sha256, sha256)).get();
  let documentId = existing?.id;
  if (!documentId) {
    const storageKey = `${randomUUID()}-${safeFinancialDocumentFileName(input.file.name)}`;
    const filePath = financialDocumentPath(storageKey);
    await mkdir(documentDirectory(), { recursive: true, mode: 0o700 });
    await writeFile(filePath, bytes, { mode: 0o600 });
    try {
      documentId = db
        .insert(financialDocuments)
        .values({
          documentType: "receipt",
          originalFileName: input.file.name.slice(0, 255) || "Beleg",
          storageKey,
          mimeType: input.file.type,
          sizeBytes: bytes.byteLength,
          sha256,
          description: input.description?.trim().slice(0, 1_000) || "",
          uploadedByUserId: input.userId,
          createdAt: new Date(),
        })
        .returning({ id: financialDocuments.id })
        .get().id;
    } catch (error) {
      await rm(filePath, { force: true });
      throw error;
    }
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
        note: input.description?.trim().slice(0, 1_000) || "Beleg zur Banktransaktion",
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .run();
  }
  return { documentId, sha256 };
}
