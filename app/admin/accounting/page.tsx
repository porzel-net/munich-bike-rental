import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { EuerSummary } from "@/components/euer-summary";
import { FixedAssetsTable, type FixedAssetRow } from "@/components/fixed-assets-table";
import { ManualFinancialTransactionLauncher } from "@/components/manual-financial-transaction-dialog";
import { StripeAutoSyncStatus } from "@/components/stripe-auto-sync-status";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { getEuerSummary } from "@/lib/financial/euer";
import { financialAccounts, financialCategories, fixedAssetDepreciationEntries, fixedAssets } from "@/lib/db/schema";

export default async function AccountingPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");

  const db = getDatabase();
  const euer = getEuerSummary(db, new Date().getFullYear());
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
    .select({ id: financialAccounts.id, name: financialAccounts.name, type: financialAccounts.type })
    .from(financialAccounts)
    .where(eq(financialAccounts.status, "active"))
    .orderBy(financialAccounts.name)
    .all();
  const depreciationRows = db.select().from(fixedAssetDepreciationEntries).all();
  const assets: FixedAssetRow[] = db
    .select()
    .from(fixedAssets)
    .orderBy(desc(fixedAssets.acquisitionDate), desc(fixedAssets.id))
    .all()
    .map((asset) => ({
      id: asset.id,
      assetNumber: asset.assetNumber,
      name: asset.name,
      assetType: asset.assetType,
      acquisitionDate: asset.acquisitionDate,
      inServiceDate: asset.inServiceDate,
      acquisitionCostCents: asset.acquisitionCostCents,
      usefulLifeMonths: asset.usefulLifeMonths,
      status: asset.status,
      postedDepreciationCents: depreciationRows
        .filter((entry) => entry.fixedAssetId === asset.id)
        .reduce((sum, entry) => sum + entry.amountCents, 0),
    }));
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
      <SidebarInset>
        <SiteHeader title={`EÜR ${euer.year}`} />
        <main className="flex flex-1 flex-col p-8 lg:p-12">
          <div className="mb-2 flex flex-col items-end gap-3">
            <StripeAutoSyncStatus />
            <ManualFinancialTransactionLauncher categories={categories} accounts={accounts} />
          </div>
          <div className="flex flex-col gap-6">
            <EuerSummary data={euer} />
            <FixedAssetsTable assets={assets} />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
