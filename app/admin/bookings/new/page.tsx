import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { ManualBookingForm } from "@/components/manual-booking-form";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { bikeModels, bikeVariants, rentalAssets } from "@/lib/db/schema";
import { getLocationInventory } from "@/lib/inventory/repository";
import { rentalLocations } from "@/lib/inquiries/catalog";
import { AppSidebar } from "@/components/app-sidebar";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const metadata: Metadata = {
  title: "Manuelle Buchung",
};

export default async function NewBookingPage() {
  const session = await getServerSession();
  if (!session) return null;
  const administrator = isAdmin(session.user);
  const assigned = getAssignedLocation(session.user);
  if (!administrator && !assigned) redirect("/admin");
  const db = getDatabase();
  const assets = db
    .select({
      id: rentalAssets.id,
      location: rentalAssets.location,
      label: rentalAssets.displayName,
      nickname: rentalAssets.nickname,
      modelTitle: bikeModels.title,
      size: bikeVariants.size,
      priceCents: rentalAssets.weekdayPriceCents,
      isBookable: rentalAssets.isBookable,
      state: rentalAssets.state,
    })
    .from(rentalAssets)
    .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
    .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
    .all()
    .filter((asset) => administrator || asset.location === assigned)
    .map((asset) => ({ ...asset, modelLabel: `${asset.modelTitle} - ${asset.size}` }));
  const pricingByLocation = Object.fromEntries(
    (administrator ? rentalLocations : [assigned as (typeof rentalLocations)[number]]).map((location) => [
      location,
      getLocationInventory(db, location),
    ]),
  );
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar user={session.user} isAdmin={administrator} variant="inset" />
      <SidebarInset className="min-w-0 overflow-hidden">
        <SiteHeader title="Manuelle Buchung" />
        <div className="admin-page-surface">
          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-8 lg:p-12">
            <AdminPageHeader
              title="Manuelle Buchung"
              description="Die Sprache ist Pflicht. Eine Direktbuchung reserviert jedes ausgewählte konkrete Fahrrad atomar."
            />
            <ManualBookingForm assets={assets} pricingByLocation={pricingByLocation} />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
