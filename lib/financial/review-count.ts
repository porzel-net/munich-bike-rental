import { and, eq, or } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/client";
import {
  financialCategories,
  financialDocumentLinks,
  financialTransactionAllocations,
  financialTransactions,
} from "@/lib/db/schema";
import { countOpenFinancialReviews, type FinancialReviewCompletenessInput } from "@/lib/financial/review-status";

type BankReviewRow = FinancialReviewCompletenessInput & {
  id: number;
};

/**
 * Keep the sidebar badge aligned with the review inbox. A transaction can
 * still need review after its raw status changes, for example when a receipt
 * or a booking assignment is missing.
 */
export function getOpenFinancialTransactionCount(db: AppDatabase) {
  const rows = db
    .select({
      id: financialTransactions.id,
      status: financialTransactions.status,
      categoryId: financialTransactionAllocations.categoryId,
      categoryCode: financialCategories.code,
      categoryType: financialCategories.categoryType,
      euerLine: financialCategories.euerLine,
      euerTreatment: financialCategories.euerTreatment,
      allocationKind: financialTransactionAllocations.allocationKind,
      bookingId: financialTransactionAllocations.bookingId,
      destinationAccountId: financialTransactionAllocations.destinationAccountId,
      fixedAssetId: financialTransactionAllocations.fixedAssetId,
    })
    .from(financialTransactions)
    .leftJoin(
      financialTransactionAllocations,
      eq(financialTransactionAllocations.transactionId, financialTransactions.id),
    )
    .leftJoin(financialCategories, eq(financialCategories.id, financialTransactionAllocations.categoryId))
    .where(
      or(
        and(eq(financialTransactions.source, "bank"), eq(financialTransactions.provider, "nevlo")),
        eq(financialTransactions.source, "cash"),
        eq(financialTransactions.source, "manual"),
      ),
    )
    .all();
  const documentTransactionIds = new Set(
    db
      .select({ transactionId: financialDocumentLinks.transactionId })
      .from(financialDocumentLinks)
      .all()
      .map((row) => row.transactionId)
      .filter((transactionId): transactionId is number => transactionId !== null),
  );
  const groupedRows = new Map<number, BankReviewRow>();

  for (const row of rows) {
    const existing = groupedRows.get(row.id);
    if (!existing) {
      groupedRows.set(row.id, { ...row, documentCount: documentTransactionIds.has(row.id) ? 1 : 0 });
      continue;
    }
    if (existing.categoryId === null && row.categoryId !== null) {
      existing.categoryId = row.categoryId;
      existing.categoryCode = row.categoryCode;
      existing.categoryType = row.categoryType;
      existing.euerLine = row.euerLine;
      existing.euerTreatment = row.euerTreatment;
      existing.allocationKind = row.allocationKind;
      existing.bookingId = row.bookingId;
      existing.destinationAccountId = row.destinationAccountId;
      existing.fixedAssetId = row.fixedAssetId;
    }
  }

  return countOpenFinancialReviews([...groupedRows.values()]);
}
