import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { ManualBookingForm } from "@/components/manual-booking-form";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { rentalAssets } from "@/lib/db/schema";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function NewBookingPage() {
  const session = await getServerSession();
  if (!session) return null;
  const administrator = isAdmin(session.user);
  const assigned = getAssignedLocation(session.user);
  if (!administrator && !assigned) redirect("/admin");
  const assets = getDatabase()
    .select({
      id: rentalAssets.id,
      location: rentalAssets.location,
      label: rentalAssets.displayName,
      priceCents: rentalAssets.dailyPriceCents,
    })
    .from(rentalAssets)
    .where(eq(rentalAssets.state, "active"))
    .all()
    .filter((asset) => administrator || asset.location === assigned);
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
          <ManualBookingForm assets={assets} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
