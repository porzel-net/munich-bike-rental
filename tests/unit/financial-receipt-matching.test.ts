import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { rm } from "node:fs/promises";

import { createDatabaseConnection } from "@/lib/db/client";
import {
  authUser,
  financialAccounts,
  financialCategories,
  financialDocumentLinks,
  financialTransactionAllocations,
  financialTransactions,
  whatsappReceiptIntake,
} from "@/lib/db/schema";
import {
  extractInvoiceNumberCandidates,
  extractReceiptAmount,
  merchantTokens,
  suggestReceiptMatch,
} from "@/lib/financial/receipt-matching";
import { postFinancialTransaction } from "@/lib/financial/reconciliation";
import { processWhatsAppFinancialReceipt } from "@/lib/financial/whatsapp-receipts";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];
const documentDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  while (connections.length) connections.pop()?.close();
  await Promise.all(documentDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("deterministic receipt matching", () => {
  it("prefers a labelled invoice total and matches the uniquely matching debit", () => {
    expect([...merchantTokens("Google Ads invoice\nGesamtbetrag 107,91 EUR")]).toEqual(["google", "ads"]);
    expect(extractReceiptAmount("Zwischensumme 89,00 EUR\nGesamtbetrag: 107,91 EUR")).toEqual({
      amountCents: 10_791,
      label: "Gesamtbetrag:",
    });

    expect(
      suggestReceiptMatch({
        receiptText: "Google Ads invoice\nGesamtbetrag 107,91 EUR",
        candidates: [
          {
            transactionId: 11,
            amountCents: -10_791,
            bookedAt: "2026-09-01",
            merchantText: "GOOGLE ADS IRELAND googleads",
          },
        ],
        categoryPatterns: [
          { merchantText: "google ads", categoryId: 9, categoryCode: "advertising" },
          { merchantText: "google ads ireland", categoryId: 9, categoryCode: "advertising" },
        ],
      }),
    ).toEqual({
      transactionId: 11,
      score: 100,
      amountCents: 10_791,
      categoryId: 9,
      categoryCode: "advertising",
      categorySource: "recurring_pattern",
      matchReason: "amount_and_merchant",
    });
  });

  it("recognizes a Rinkel invoice table total and links it by its invoice number", () => {
    const rinkelInvoice = `
      Betrag Beschreibung Pro Monat Rabatt Gesamt
      1 Essential Benutzer
      9,99 € 50% 4,99 €
      Gesamtbetrag
      Betrag (ohne MwSt.) 7,06 €
      MwSt. 19% 1,34 €
      Gesamt 8,40 €
      Rechnungsnummer : 26DE000747
      Rinkel BV
    `;
    expect(extractReceiptAmount(rinkelInvoice)).toEqual({ amountCents: 840, label: "Gesamt" });
    expect(
      suggestReceiptMatch({
        receiptText: rinkelInvoice,
        candidates: [
          {
            transactionId: 64,
            amountCents: -840,
            bookedAt: "2026-09-01",
            merchantText: "RINKEL BV 129668DE07202208000043448672 26DE000747",
          },
        ],
        categoryPatterns: [],
      }),
    ).toMatchObject({
      transactionId: 64,
      amountCents: 840,
      matchReason: "invoice_reference",
    });
  });

  it("uses an explicitly labelled invoice number even when no amount is readable", () => {
    expect(extractInvoiceNumberCandidates("Rechnungsnummer: RE-2026-0042")).toEqual(["RE20260042"]);
    expect(
      suggestReceiptMatch({
        receiptText: "Google Ads\nRechnungsnummer: RE-2026-0042",
        candidates: [
          {
            transactionId: 23,
            amountCents: -12_345,
            bookedAt: "2026-09-03",
            merchantText: "Google Ads invoice RE 2026 0042",
          },
        ],
        categoryPatterns: [],
      }),
    ).toMatchObject({ transactionId: 23, amountCents: 12_345, matchReason: "invoice_reference" });
  });

  it("refuses an amount-only match when two transactions are equally plausible", () => {
    expect(
      suggestReceiptMatch({
        receiptText: "Rechnung\nGesamtbetrag 20,00 EUR",
        candidates: [
          { transactionId: 1, amountCents: -2_000, bookedAt: "2026-09-01", merchantText: "Google Ads" },
          { transactionId: 2, amountCents: -2_000, bookedAt: "2026-09-02", merchantText: "Google Ads" },
        ],
        categoryPatterns: [],
      }),
    ).toBeNull();
  });

  it("reuses a category only after the same merchant was posted consistently twice", () => {
    expect(
      suggestReceiptMatch({
        receiptText: "Meta Platforms Rechnung\nGesamtbetrag: 50,00 EUR",
        candidates: [
          { transactionId: 3, amountCents: -5_000, bookedAt: "2026-09-03", merchantText: "Meta Platforms Ireland" },
        ],
        categoryPatterns: [
          { merchantText: "Meta Platforms Ireland", categoryId: 4, categoryCode: "advertising" },
          { merchantText: "Meta Platforms Ireland", categoryId: 4, categoryCode: "advertising" },
        ],
      }),
    ).toMatchObject({ transactionId: 3, categoryId: 4, categorySource: "recurring_pattern" });
  });

  it("requires a human approval after matching an authorized receipt and category suggestion", async () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const documentDirectory = `/tmp/mbr-receipt-test-${crypto.randomUUID()}`;
    documentDirectories.push(documentDirectory);
    vi.stubEnv("FINANCIAL_DOCUMENTS_DIR", documentDirectory);
    const db = connection.db;
    const now = new Date();
    db.insert(authUser)
      .values({
        id: "admin",
        name: "Admin",
        email: "admin@example.com",
        role: "admin",
        whatsappPhone: "+49 170 1234567",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const bank = db
      .insert(financialAccounts)
      .values({
        code: "test_bank",
        name: "Testbank",
        type: "bank",
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: financialAccounts.id })
      .get();
    const transaction = db
      .insert(financialTransactions)
      .values({
        financialAccountId: bank.id,
        source: "bank",
        provider: "nevlo",
        kind: "expense",
        status: "imported",
        amountCents: -10_791,
        currency: "EUR",
        bookedAt: "2026-09-01",
        counterpartyNameSnapshot: "Google Ads Ireland",
        description: "GOOGLE ADS",
        importedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: financialTransactions.id })
      .get();
    const advertising = db.select().from(financialCategories).where(eq(financialCategories.code, "advertising")).get()!;
    for (const index of [1, 2]) {
      const historical = db
        .insert(financialTransactions)
        .values({
          financialAccountId: bank.id,
          source: "bank",
          provider: "nevlo",
          kind: "expense",
          status: "posted",
          amountCents: -5_000,
          currency: "EUR",
          bookedAt: `2026-0${index + 6}-01`,
          counterpartyNameSnapshot: "Google Ads Ireland",
          description: "GOOGLE ADS",
          importedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: financialTransactions.id })
        .get();
      db.insert(financialTransactionAllocations)
        .values({
          transactionId: historical.id,
          categoryId: advertising.id,
          allocationKind: "expense",
          matchMethod: "manual",
          amountCents: -5_000,
          note: "Bestätigte frühere Google-Ads-Buchung",
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    const result = await processWhatsAppFinancialReceipt(db, {
      messageId: "whatsapp-message-1",
      senderPhone: "491701234567",
      fileName: "google-ads.jpg",
      mimeType: "image/jpeg",
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      caption: "Google Ads Rechnung – Gesamtbetrag: 107,91 EUR",
    });

    expect(result).toMatchObject({ outcome: "matched", transactionId: transaction.id, extractedAmountCents: 10_791 });
    expect(result.message).toContain("Banktransaktion #");
    expect(result.message).toContain("Werbung und Marketing");
    expect(db.select().from(financialDocumentLinks).all()).toHaveLength(1);
    expect(db.select().from(whatsappReceiptIntake).all()).toMatchObject([
      { status: "matched", transactionId: transaction.id },
    ]);
    expect(
      db
        .select()
        .from(financialTransactionAllocations)
        .all()
        .filter((row) => row.transactionId === transaction.id),
    ).toEqual([]);
    expect(
      db.select().from(financialTransactions).where(eq(financialTransactions.id, transaction.id)).get(),
    ).toMatchObject({
      status: "pending_approval",
      suggestedCategoryId: advertising.id,
    });

    postFinancialTransaction(db, {
      transactionId: transaction.id,
      categoryId: advertising.id,
      note: "Kategorie und WhatsApp-Beleg durch Admin geprüft.",
      actorUserId: "admin",
    });
    expect(
      db.select().from(financialTransactions).where(eq(financialTransactions.id, transaction.id)).get(),
    ).toMatchObject({
      status: "posted",
      suggestedCategoryId: null,
      suggestedAt: null,
    });
    expect(
      db
        .select()
        .from(financialTransactionAllocations)
        .all()
        .find((allocation) => allocation.transactionId === transaction.id),
    ).toMatchObject({ categoryId: advertising.id, matchMethod: "manual", amountCents: -10_791 });

    const duplicate = await processWhatsAppFinancialReceipt(db, {
      messageId: "whatsapp-message-replayed-after-reconnect",
      senderPhone: "491701234567",
      fileName: "google-ads.jpg",
      mimeType: "image/jpeg",
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      caption: "Google Ads Rechnung – Gesamtbetrag: 107,91 EUR",
    });
    expect(duplicate).toEqual({ outcome: "duplicate", message: "Dieser Beleg wurde bereits verarbeitet." });
    expect(db.select().from(whatsappReceiptIntake).all()).toHaveLength(1);
  });
});
