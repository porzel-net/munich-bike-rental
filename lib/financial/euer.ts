import { and, asc, eq, gte, lt } from "drizzle-orm";

import type { AppDatabase } from "../db/client";
import { financialCategories, financialTransactionAllocations, financialTransactions } from "../db/schema";

export type EuerRow = {
  id: number;
  date: string;
  category: string;
  euerTreatment: string;
  source: string;
  description: string;
  amountCents: number;
  transactionId: number;
  bookingId: number | null;
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
  const rows = db
    .select({
      id: financialTransactionAllocations.id,
      date: financialTransactions.bookedAt,
      category: financialCategories.name,
      euerTreatment: financialCategories.euerTreatment,
      source: financialTransactions.source,
      description: financialTransactions.description,
      amountCents: financialTransactionAllocations.amountCents,
      transactionId: financialTransactions.id,
      bookingId: financialTransactionAllocations.bookingId,
    })
    .from(financialTransactionAllocations)
    .innerJoin(financialTransactions, eq(financialTransactionAllocations.transactionId, financialTransactions.id))
    .innerJoin(financialCategories, eq(financialTransactionAllocations.categoryId, financialCategories.id))
    .where(
      and(
        eq(financialTransactions.status, "posted"),
        gte(financialTransactions.bookedAt, from),
        lt(financialTransactions.bookedAt, to),
      ),
    )
    .orderBy(asc(financialTransactions.bookedAt), asc(financialTransactionAllocations.id))
    .all() as EuerRow[];

  let incomeCents = 0;
  let expenseCents = 0;
  let vatPaymentCents = 0;
  let inputVatCents = 0;
  let outputVatCents = 0;
  let unresolvedCents = 0;
  let excludedInternalCents = 0;
  for (const row of rows) {
    const amount = Math.abs(row.amountCents);
    if (row.euerTreatment === "income") incomeCents += amount;
    else if (row.euerTreatment === "expense") expenseCents += amount;
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
