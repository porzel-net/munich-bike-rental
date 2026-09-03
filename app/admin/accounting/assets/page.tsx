import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { FixedAssetsTable, type FixedAssetRow } from "@/components/fixed-assets-table";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { berlinDateKey } from "@/lib/datetime";
import { financialAccounts, fixedAssetDepreciationEntries, fixedAssets } from "@/lib/db/schema";
import { postDueFixedAssetDepreciation } from "@/lib/financial/fixed-assets";

export const metadata: Metadata = {
  title: "Anlageverzeichnis",
};

export default async function FixedAssetsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");

  const db = getDatabase();
  postDueFixedAssetDepreciation(db, {
    throughMonth: berlinDateKey().slice(0, 7),
    actorUserId: session.user.id,
  });
  const depreciationRows = db.select().from(fixedAssetDepreciationEntries).all();
  const financialAccountOptions = db
    .select({ id: financialAccounts.id, code: financialAccounts.code, name: financialAccounts.name })
    .from(financialAccounts)
    .where(eq(financialAccounts.status, "active"))
    .orderBy(financialAccounts.name)
    .all();
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
      serialNumber: asset.serialNumber,
      acquisitionCostCents: asset.acquisitionCostCents,
      usefulLifeMonths: asset.usefulLifeMonths,
      status: asset.status,
      postedDepreciationCents: depreciationRows
        .filter((entry) => entry.fixedAssetId === asset.id)
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      bookValueCents:
        asset.acquisitionCostCents -
        depreciationRows
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
      <SidebarInset className="min-w-0 overflow-hidden">
        <SiteHeader title="Anlageverzeichnis" />
        <div className="admin-page-surface">
          <main className="flex flex-1 flex-col p-8 lg:p-12">
            <FixedAssetsTable assets={assets} financialAccounts={financialAccountOptions} />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
