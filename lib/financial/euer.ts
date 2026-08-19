import { and, asc, eq, gte, lt, sql } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import {
  bookings,
  financialCategories,
  financialAccounts,
  financialTransactionAllocations,
  financialTransactions,
  fixedAssetDepreciationEntries,
  fixedAssets,
  journalEntries,
  journalLines,
} from "../db/schema";

export type EuerRow = {
  id: number;
  date: string;
  category: string;
  categoryCode: string | null;
  euerTreatment: string;
  source: string;
  description: string;
  amountCents: number;
  transactionId: number | null;
  bookingId: number | null;
  invoiceNumber: string | null;
  accountName?: string | null;
  iban?: string | null;
  fixedAssetId?: number;
};

export type EuerSummary = {
  year: number;
  incomeCents: number;
  expenseCents: number;
  vatPaymentCents: number;
  inputVatCents: number;
  outputVatCents: number;
  profitCents: number;
  outstandingCents: number;
  unresolvedCents: number;
  excludedInternalCents: number;
  rows: EuerRow[];
};

export function getEuerSummary(db: AppDatabase, year: number): EuerSummary {
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const transactionRows = db
    .select({
      id: financialTransactionAllocations.id,
      date: financialTransactions.bookedAt,
      categoryCode: financialCategories.code,
      category: sql<string>`coalesce(${financialCategories.name}, 'EÜR-Zuordnung fehlt')`,
      euerTreatment: sql<string>`coalesce(${financialCategories.euerTreatment}, 'needs_review')`,
      source: financialTransactions.source,
      accountName: financialAccounts.name,
      iban: financialAccounts.iban,
      description: financialTransactions.description,
      amountCents: financialTransactionAllocations.amountCents,
      transactionId: financialTransactions.id,
      bookingId: financialTransactionAllocations.bookingId,
      fixedAssetId: financialTransactionAllocations.fixedAssetId,
      allocationKind: financialTransactionAllocations.allocationKind,
      invoiceNumber: bookings.invoiceNumber,
    })
    .from(financialTransactionAllocations)
    .innerJoin(financialTransactions, eq(financialTransactionAllocations.transactionId, financialTransactions.id))
    .innerJoin(financialAccounts, eq(financialTransactions.financialAccountId, financialAccounts.id))
    .leftJoin(financialCategories, eq(financialTransactionAllocations.categoryId, financialCategories.id))
    .leftJoin(bookings, eq(financialTransactionAllocations.bookingId, bookings.id))
    .where(
      and(
        eq(financialTransactions.status, "posted"),
        gte(financialTransactions.bookedAt, from),
        lt(financialTransactions.bookedAt, to),
      ),
    )
    .orderBy(asc(financialTransactions.bookedAt), asc(financialTransactionAllocations.id))
    .all()
    .map(({ allocationKind, ...row }) => ({
      ...row,
      invoiceNumber: allocationKind === "fee" ? null : row.invoiceNumber,
    })) as EuerRow[];
  const depreciationRows = db
    .select({
      id: sql<number>`-${fixedAssetDepreciationEntries.id}`,
      date: fixedAssetDepreciationEntries.periodStart,
      category: financialCategories.name,
      categoryCode: financialCategories.code,
      euerTreatment: financialCategories.euerTreatment,
      source: sql<string>`'depreciation'`,
      description: fixedAssets.name,
      amountCents: fixedAssetDepreciationEntries.amountCents,
      transactionId: sql<number | null>`null`,
      bookingId: sql<number | null>`null`,
      invoiceNumber: sql<string | null>`null`,
      accountName: sql<string | null>`null`,
      iban: sql<string | null>`null`,
      fixedAssetId: fixedAssets.id,
    })
    .from(fixedAssetDepreciationEntries)
    .innerJoin(fixedAssets, eq(fixedAssetDepreciationEntries.fixedAssetId, fixedAssets.id))
    .innerJoin(financialCategories, eq(financialCategories.code, "depreciation"))
    .where(and(gte(fixedAssetDepreciationEntries.periodStart, from), lt(fixedAssetDepreciationEntries.periodStart, to)))
    .all() as EuerRow[];
  const disposalRows = db
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.status, "disposed"))
    .all()
    .filter(
      (asset) =>
        asset.disposedAt &&
        asset.disposedAt >= from &&
        asset.disposedAt < to &&
        (asset.disposalProceedsCents ?? 0) >= 0,
    )
    .flatMap((asset) => {
      const date = asset.disposedAt!;
      const proceedsCents = asset.disposalProceedsCents ?? 0;
      const depreciationCents = db
        .select({ amountCents: fixedAssetDepreciationEntries.amountCents })
        .from(fixedAssetDepreciationEntries)
        .where(eq(fixedAssetDepreciationEntries.fixedAssetId, asset.id))
        .all()
        .reduce((sum, entry) => sum + entry.amountCents, 0);
      const bookValueCents = Math.max(0, asset.acquisitionCostCents - depreciationCents);
      const rows: EuerRow[] = [];
      // Older disposal rows predate the financial transaction model. Keep
      // their tax report readable, while new disposals are sourced from the
      // posted sale transaction above and must not be counted twice.
      if (!asset.disposalTransactionId && proceedsCents > 0) {
        rows.push({
          id: -1_000_000 - asset.id,
          date,
          category: "Veräußerung Anlagevermögen",
          categoryCode: null,
          euerTreatment: "income",
          source: "asset_sale",
          description: `${asset.name} · ${asset.assetNumber}`,
          amountCents: proceedsCents,
          transactionId: null,
          bookingId: null,
          invoiceNumber: null,
          accountName: null,
          iban: null,
          fixedAssetId: asset.id,
        });
      }
      if (bookValueCents > 0) {
        rows.push({
          id: -2_000_000 - asset.id,
          date,
          category: "Restbuchwert Anlagenabgang",
          categoryCode: null,
          euerTreatment: "expense",
          source: "asset_disposal",
          description: `${asset.name} · ${asset.assetNumber}`,
          amountCents: -bookValueCents,
          transactionId: null,
          bookingId: null,
          invoiceNumber: null,
          accountName: null,
          iban: null,
          fixedAssetId: asset.id,
        });
      }
      if (!asset.disposalTransactionId && asset.disposalProceedsVatCents > 0) {
        rows.push({
          id: -3_000_000 - asset.id,
          date,
          category: "Umsatzsteuer Verkauf Anlagevermögen",
          categoryCode: null,
          euerTreatment: "output_vat",
          source: "asset_sale",
          description: `${asset.name} · ${asset.assetNumber}`,
          amountCents: asset.disposalProceedsVatCents,
          transactionId: null,
          bookingId: null,
          invoiceNumber: null,
          accountName: null,
          iban: null,
          fixedAssetId: asset.id,
        });
      }
      return rows;
    });
  const rows = [...transactionRows, ...depreciationRows, ...disposalRows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  );

  let incomeCents = 0;
  let expenseCents = 0;
  let vatPaymentCents = 0;
  let inputVatCents = 0;
  let outputVatCents = 0;
  const outstandingByBooking = db
    .select({
      bookingId: journalEntries.bookingId,
      amountCents: sql<number>`coalesce(sum(${journalLines.amountCents}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(eq(journalLines.account, "accounts_receivable"), sql`${journalEntries.bookingId} is not null`))
    .groupBy(journalEntries.bookingId)
    .all();
  const outstandingCents = outstandingByBooking.reduce((sum, row) => sum + Math.max(0, row.amountCents), 0);
  let unresolvedCents = 0;
  let excludedInternalCents = 0;
  for (const row of rows) {
    const amount = Math.abs(row.amountCents);
    if (row.euerTreatment === "income") incomeCents += row.amountCents;
    else if (row.euerTreatment === "expense") expenseCents += row.source === "depreciation" ? amount : -row.amountCents;
    else if (row.euerTreatment === "tax_payment") {
      vatPaymentCents += amount;
      expenseCents += amount;
    } else if (row.euerTreatment === "input_vat") inputVatCents += amount;
    else if (row.euerTreatment === "output_vat") outputVatCents += amount;
    else if (row.euerTreatment === "needs_review") unresolvedCents += amount;
    else if (row.euerTreatment === "transfer") excludedInternalCents += amount;
  }

  return {
    year,
    incomeCents,
    expenseCents,
    vatPaymentCents,
    inputVatCents,
    outputVatCents,
    profitCents: incomeCents - expenseCents,
    outstandingCents,
    unresolvedCents,
    excludedInternalCents,
    rows,
  };
}
