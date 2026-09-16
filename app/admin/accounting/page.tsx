import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EuerSummary } from "@/components/euer-summary";
import { ManualFinancialTransactionLauncher } from "@/components/manual-financial-transaction-dialog";
import { StripeAutoSyncStatus } from "@/components/stripe-auto-sync-status";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { berlinYear } from "@/lib/datetime";
import { getEuerSummary } from "@/lib/financial/euer";
import { bookings, financialAccounts, financialCategories } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Buchhaltung",
};

export default async function AccountingPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");

  const db = getDatabase();
  const euer = getEuerSummary(db, berlinYear());
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
  const accounts = db
    .select({
      id: financialAccounts.id,
      code: financialAccounts.code,
      name: financialAccounts.name,
      currency: financialAccounts.currency,
      status: financialAccounts.status,
    })
    .from(financialAccounts)
    .orderBy(financialAccounts.name)
    .all();
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
        <SiteHeader title="Buchhaltung" />
        <div className="admin-page-surface">
          <main className="admin-main flex flex-1 flex-col gap-6 p-4 sm:p-8 lg:p-12">
            <AdminPageHeader
              title={`EÜR ${euer.year}`}
              description="Einnahmen und Ausgaben nach steuerlicher Kategorie. Interne Umbuchungen bleiben ausgeschlossen."
              actions={
                <div className="flex flex-col items-end gap-2">
                  <ManualFinancialTransactionLauncher
                    categories={categories}
                    accounts={accounts}
                    bookings={bookingReferences}
                  />
                  <StripeAutoSyncStatus />
                </div>
              }
            />
            <div className="flex flex-col gap-6">
              <EuerSummary data={euer} />
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
