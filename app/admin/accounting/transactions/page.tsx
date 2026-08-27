import { and, desc, eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import {
  FinancialReviewInbox,
  type FinancialReviewAccount,
  type FinancialReviewCategory,
  type FinancialReviewTransaction,
} from "@/components/financial-review-inbox";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import {
  financialAccounts,
  financialCategories,
  financialDocumentLinks,
  financialDocuments,
  financialTransactionAllocations,
  financialTransactions,
  bookings,
} from "@/lib/db/schema";
import { findBookingOrderNumber } from "@/lib/financial/booking-matching";

export default async function BankTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ transaction?: string }>;
}) {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");

  const params = await searchParams;
  const initialTransactionId =
    params.transaction && /^\d+$/.test(params.transaction) ? Number(params.transaction) : undefined;
  const db = getDatabase();
  const bookingReferences = db
    .select({
      id: bookings.id,
      orderNumber: bookings.orderNumber,
      customerName: bookings.customerName,
      status: bookings.status,
    })
    .from(bookings)
    .orderBy(bookings.orderNumber)
    .all();
  const availableAccounts = db
    .select({
      id: financialAccounts.id,
      code: financialAccounts.code,
      name: financialAccounts.name,
      currency: financialAccounts.currency,
    })
    .from(financialAccounts)
    .orderBy(financialAccounts.name)
    .all();
  const categories = db
    .select({
      id: financialCategories.id,
      code: financialCategories.code,
      name: financialCategories.name,
      categoryType: financialCategories.categoryType,
      euerTreatment: financialCategories.euerTreatment,
      euerLine: financialCategories.euerLine,
    })
    .from(financialCategories)
    .where(eq(financialCategories.isActive, true))
    .orderBy(financialCategories.name)
    .all()
    .filter((category) => category.code !== "unclassified");
  const reviewTransactions = db
    .select({
      id: financialTransactions.id,
      financialAccountId: financialTransactions.financialAccountId,
      accountName: financialAccounts.name,
      accountCode: financialAccounts.code,
      source: financialTransactions.source,
      provider: financialTransactions.provider,
      kind: financialTransactions.kind,
      status: financialTransactions.status,
      euerTreatment: financialCategories.euerTreatment,
      categoryId: financialTransactionAllocations.categoryId,
      categoryCode: financialCategories.code,
      categoryType: financialCategories.categoryType,
      allocationKind: financialTransactionAllocations.allocationKind,
      destinationAccountId: financialTransactionAllocations.destinationAccountId,
      bookingId: financialTransactionAllocations.bookingId,
      fixedAssetId: financialTransactionAllocations.fixedAssetId,
      allocationAmountCents: financialTransactionAllocations.amountCents,
      amountCents: financialTransactions.amountCents,
      currency: financialTransactions.currency,
      bookedAt: financialTransactions.bookedAt,
      valueDate: financialTransactions.valueDate,
      counterpartyName: financialTransactions.counterpartyNameSnapshot,
      reference: financialTransactions.reference,
      description: financialTransactions.description,
      notes: financialTransactions.notes,
    })
    .from(financialTransactions)
    .innerJoin(financialAccounts, eq(financialTransactions.financialAccountId, financialAccounts.id))
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
    .orderBy(desc(financialTransactions.bookedAt), desc(financialTransactions.id))
    .all();
  const documentCounts = db
    .select({
      transactionId: financialDocumentLinks.transactionId,
      documentId: financialDocuments.id,
      originalFileName: financialDocuments.originalFileName,
    })
    .from(financialDocumentLinks)
    .innerJoin(financialDocuments, eq(financialDocumentLinks.documentId, financialDocuments.id))
    .all()
    .reduce((documents, link) => {
      if (link.transactionId) {
        const existing = documents.get(link.transactionId) ?? [];
        existing.push({ id: link.documentId, originalFileName: link.originalFileName });
        documents.set(link.transactionId, existing);
      }
      return documents;
    }, new Map<number, Array<{ id: number; originalFileName: string }>>());
  const groupedTransactions = new Map<number, (typeof reviewTransactions)[number] & { allocatedCents: number }>();
  for (const row of reviewTransactions) {
    const existing = groupedTransactions.get(row.id);
    if (!existing) {
      groupedTransactions.set(row.id, {
        ...row,
        allocatedCents: row.allocationAmountCents ?? 0,
      });
      continue;
    }
    existing.allocatedCents += row.allocationAmountCents ?? 0;
    if (existing.categoryId === null && row.categoryId !== null) {
      existing.categoryId = row.categoryId;
      existing.categoryCode = row.categoryCode;
      existing.categoryType = row.categoryType;
      existing.euerTreatment = row.euerTreatment;
      existing.allocationKind = row.allocationKind;
      existing.destinationAccountId = row.destinationAccountId;
      existing.bookingId = row.bookingId;
      existing.fixedAssetId = row.fixedAssetId;
    }
  }
  const reviewTransactionsForClient: FinancialReviewTransaction[] = [...groupedTransactions.values()].map((row) => {
    const documents = documentCounts.get(row.id) ?? [];
    const matchedBooking = row.bookingId
      ? (bookingReferences.find((booking) => booking.id === row.bookingId) ?? null)
      : row.source === "bank" && row.provider === "nevlo"
        ? findBookingOrderNumber([row.reference, row.description], bookingReferences)
        : null;
    return {
      ...row,
      allocatedCents: row.allocatedCents,
      remainingCents: Math.max(0, row.amountCents - row.allocatedCents),
      matchedBooking:
        matchedBooking && matchedBooking.status !== "rejected" && matchedBooking.status !== "cancelled"
          ? { id: matchedBooking.id, orderNumber: matchedBooking.orderNumber }
          : null,
      documentCount: documents.length,
      documents,
    };
  });

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar user={session.user} isAdmin variant="inset" />
      <SidebarInset className="min-w-0 overflow-hidden">
        <SiteHeader title="Finanztransaktionen" />
        <div className="admin-page-surface">
          <main className="flex flex-1 flex-col p-8 lg:p-12">
            <FinancialReviewInbox
              title="Finanztransaktionen"
              transactions={reviewTransactionsForClient}
              categories={categories as FinancialReviewCategory[]}
              accounts={availableAccounts as FinancialReviewAccount[]}
              bookings={bookingReferences}
              initialTransactionId={initialTransactionId}
            />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
