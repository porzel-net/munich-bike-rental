import { AccountingExpensesTable } from "@/components/accounting-expenses-table";
import { AccountingRevenuesTable } from "@/components/accounting-revenues-table";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import {
  accountingExpenses,
  accountingRevenuePayments,
  accountingRevenues,
  rentalInquiries,
} from "@/lib/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function AccountingPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");

  const expenses = getDatabase()
    .select({
      id: accountingExpenses.id,
      description: accountingExpenses.description,
      payeeName: accountingExpenses.payeeName,
      paymentDate: accountingExpenses.paymentDate,
      depreciationDurationMonths: accountingExpenses.depreciationDurationMonths,
      sumCents: accountingExpenses.sumCents,
      createdBy: accountingExpenses.createdBy,
      createdAt: accountingExpenses.createdAt,
    })
    .from(accountingExpenses)
    .orderBy(desc(accountingExpenses.createdAt))
    .all();

  const revenueRows = getDatabase()
    .select({
      id: accountingRevenues.id,
      inquiryId: accountingRevenues.inquiryId,
      orderNumber: rentalInquiries.orderNumber,
      amountCents: accountingRevenues.amountCents,
      paidAmountCents: accountingRevenues.paidAmountCents,
      paymentReceivedAt: accountingRevenues.paymentReceivedAt,
      payerName: accountingRevenues.payerName,
      notes: accountingRevenues.notes,
      createdAt: accountingRevenues.createdAt,
    })
    .from(accountingRevenues)
    .innerJoin(rentalInquiries, eq(accountingRevenues.inquiryId, rentalInquiries.id))
    .orderBy(desc(accountingRevenues.createdAt))
    .all();
  const payments = revenueRows.length
    ? getDatabase()
        .select({
          id: accountingRevenuePayments.id,
          revenueId: accountingRevenuePayments.revenueId,
          amountCents: accountingRevenuePayments.amountCents,
          receivedAt: accountingRevenuePayments.receivedAt,
        })
        .from(accountingRevenuePayments)
        .where(inArray(accountingRevenuePayments.revenueId, revenueRows.map((revenue) => revenue.id)))
        .all()
    : [];
  const paymentsByRevenue = new Map<number, typeof payments>();
  for (const payment of payments) {
    const current = paymentsByRevenue.get(payment.revenueId) ?? [];
    current.push(payment);
    paymentsByRevenue.set(payment.revenueId, current);
  }
  const revenues = revenueRows.map((revenue) => ({
    ...revenue,
    payments:
      paymentsByRevenue.get(revenue.id) ??
      (revenue.paidAmountCents > 0
        ? [
            {
              id: -revenue.id,
              revenueId: revenue.id,
              amountCents: revenue.paidAmountCents,
              receivedAt: revenue.paymentReceivedAt ?? new Date(revenue.createdAt).toISOString().slice(0, 10),
            },
          ]
        : []),
  }));

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={session.user} isAdmin variant="inset" />
      <SidebarInset>
        <SiteHeader title="Buchhaltung" />
        <main className="flex flex-1 flex-col p-4 lg:p-6">
          <div className="flex flex-col gap-6">
            <AccountingExpensesTable expenses={expenses} />
            <AccountingRevenuesTable revenues={revenues} />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
