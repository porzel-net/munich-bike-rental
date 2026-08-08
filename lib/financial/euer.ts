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
} from "../db/schema";

export type EuerRow = {
  id: number;
  date: string;
  category: string;
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
      category: financialCategories.name,
      euerTreatment: financialCategories.euerTreatment,
      source: financialTransactions.source,
      accountName: financialAccounts.name,
      iban: financialAccounts.iban,
      description: financialTransactions.description,
      amountCents: financialTransactionAllocations.amountCents,
      transactionId: financialTransactions.id,
      bookingId: financialTransactionAllocations.bookingId,
      allocationKind: financialTransactionAllocations.allocationKind,
      invoiceNumber: bookings.invoiceNumber,
    })
    .from(financialTransactionAllocations)
    .innerJoin(financialTransactions, eq(financialTransactionAllocations.transactionId, financialTransactions.id))
    .innerJoin(financialAccounts, eq(financialTransactions.financialAccountId, financialAccounts.id))
    .innerJoin(financialCategories, eq(financialTransactionAllocations.categoryId, financialCategories.id))
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
  const rows = [...transactionRows, ...depreciationRows].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  let incomeCents = 0;
  let expenseCents = 0;
  let vatPaymentCents = 0;
  let inputVatCents = 0;
  let outputVatCents = 0;
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
    unresolvedCents,
    excludedInternalCents,
    rows,
  };
}
