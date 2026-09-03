import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import {
  financialAccounts,
  financialDocumentLinks,
  financialDocuments,
  financialTransactions,
} from "../../lib/db/schema";
import {
  detectFinancialDocumentMime,
  detachFinancialDocument,
  hasFinancialDocumentForTransaction,
  safeFinancialDocumentFileName,
} from "../../lib/financial/documents";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

describe("financial document upload validation", () => {
  it("detects supported formats from magic bytes", () => {
    expect(detectFinancialDocumentMime(Buffer.from("%PDF-1.7"))).toBe("application/pdf");
    expect(detectFinancialDocumentMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectFinancialDocumentMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png",
    );
    expect(detectFinancialDocumentMime(Buffer.from("RIFFxxxxWEBP"))).toBe("image/webp");
    expect(detectFinancialDocumentMime(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });

  it("removes path and control characters from download names", () => {
    expect(safeFinancialDocumentFileName('../../evil"\r\n.html')).toBe("evil-.html");
  });

  it("reports whether a transaction has a linked document", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const account = connection.db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.code, "cash_main"))
      .get()!;
    const transaction = connection.db
      .insert(financialTransactions)
      .values({
        financialAccountId: account.id,
        source: "cash",
        provider: "test",
        kind: "expense",
        status: "posted",
        amountCents: -1_000,
        currency: "EUR",
        bookedAt: "2026-08-31",
        description: "Belegtest",
        importedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: financialTransactions.id })
      .get();
    const document = connection.db
      .insert(financialDocuments)
      .values({
        documentType: "receipt",
        originalFileName: "beleg.pdf",
        storageKey: "beleg.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        sha256: "hash",
        uploadedByUserId: null,
        createdAt: new Date(),
      })
      .returning({ id: financialDocuments.id })
      .get();
    connection.db
      .insert(financialDocumentLinks)
      .values({
        documentId: document.id,
        transactionId: transaction.id,
        linkType: "evidence",
        createdAt: new Date(),
      })
      .run();

    expect(hasFinancialDocumentForTransaction(connection.db, transaction.id)).toBe(true);
  });

  it("detaches and removes an orphaned document", async () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const account = connection.db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.code, "cash_main"))
      .get()!;
    const transaction = connection.db
      .insert(financialTransactions)
      .values({
        financialAccountId: account.id,
        source: "cash",
        provider: "test",
        kind: "expense",
        status: "posted",
        amountCents: -1_000,
        currency: "EUR",
        bookedAt: "2026-08-31",
        description: "Löschtest",
        importedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: financialTransactions.id })
      .get();
    const document = connection.db
      .insert(financialDocuments)
      .values({
        documentType: "receipt",
        originalFileName: "loeschtest.pdf",
        storageKey: "loeschtest.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        sha256: "loeschtest-hash",
        uploadedByUserId: null,
        createdAt: new Date(),
      })
      .returning({ id: financialDocuments.id })
      .get();
    connection.db
      .insert(financialDocumentLinks)
      .values({ documentId: document.id, transactionId: transaction.id, linkType: "evidence", createdAt: new Date() })
      .run();

    await detachFinancialDocument(connection.db, { transactionId: transaction.id, documentId: document.id });

    expect(hasFinancialDocumentForTransaction(connection.db, transaction.id)).toBe(false);
    expect(connection.db.select().from(financialDocuments).where(eq(financialDocuments.id, document.id)).get()).toBe(
      undefined,
    );
  });
});
