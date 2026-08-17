import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { ManualBookingForm } from "@/components/manual-booking-form";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { bikeModels, bikeVariants, rentalAssets } from "@/lib/db/schema";
import { getLocationInventory } from "@/lib/inventory/repository";
import { rentalLocations } from "@/lib/inquiries/catalog";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

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
      priceCents: rentalAssets.dailyPriceCents,
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
    <SidebarProvider>
      <AppSidebar user={session.user} isAdmin={administrator} variant="inset" />
      <SidebarInset>
        <SiteHeader title="Manuelle Buchung" />
        <main className="mx-auto w-full max-w-5xl p-8 lg:p-12">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">Manuelle Buchung</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Die Sprache ist Pflicht. Eine Direktbuchung reserviert jedes ausgewählte konkrete Fahrrad atomar.
            </p>
          </div>
          <ManualBookingForm assets={assets} pricingByLocation={pricingByLocation} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
