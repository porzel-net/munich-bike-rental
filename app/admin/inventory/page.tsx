import { asc, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";

import { InventoryTable } from "@/components/inventory-table";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAssignedLocation, isAdmin } from "@/lib/auth/authorization";
import { getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { rentalLocationBikes, rentalLocationBikeSizes, rentalLocationEquipment } from "@/lib/db/schema";
import { rentalLocationLabels, rentalLocations, type RentalLocation } from "@/lib/inquiries/catalog";

export type AdminInventoryBike = {
  id: number;
  location: RentalLocation;
  bikeKey: string;
  title: string;
  nickname: string | null;
  frameNumber: string | null;
  priceCents: number;
  discountTextDe: string;
  discountTextEn: string;
  size: string;
  isAvailable: boolean;
};

export type AdminInventoryEquipment = {
  id: number;
  location: RentalLocation;
  equipmentKey: string;
  category: "pedal" | "computer-mount" | "helmet" | "clothing";
  labelDe: string;
  labelEn: string;
  priceCents: number;
  isAvailable: boolean;
};

export default async function InventoryPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user) && !getAssignedLocation(session.user)) redirect("/admin");

  const locations = isAdmin(session.user)
    ? [...rentalLocations]
    : ([getAssignedLocation(session.user)].filter(Boolean) as RentalLocation[]);
  const db = getDatabase();
  const bikeRows = db
    .select()
    .from(rentalLocationBikes)
    .where(inArray(rentalLocationBikes.location, locations))
    .orderBy(asc(rentalLocationBikes.location), asc(rentalLocationBikes.displayOrder))
    .all();
  const bikeIds = bikeRows.map((bike) => bike.id);
  const sizeRows = bikeIds.length
    ? db
        .select()
        .from(rentalLocationBikeSizes)
        .where(inArray(rentalLocationBikeSizes.locationBikeId, bikeIds))
        .orderBy(asc(rentalLocationBikeSizes.id))
        .all()
    : [];
  const equipmentRows = db
    .select()
    .from(rentalLocationEquipment)
    .where(inArray(rentalLocationEquipment.location, locations))
    .orderBy(asc(rentalLocationEquipment.location), asc(rentalLocationEquipment.displayOrder))
    .all();

  const bikes: AdminInventoryBike[] = bikeRows.map((bike) => ({
    id: bike.id,
    location: bike.location as RentalLocation,
    bikeKey: bike.bikeKey,
    title: bike.title,
    nickname: bike.nickname,
    frameNumber: bike.frameNumber,
    priceCents: bike.priceCentsPerDay,
    discountTextDe: bike.discountTextDe,
    discountTextEn: bike.discountTextEn,
    size: sizeRows.find((size) => size.locationBikeId === bike.id)?.size ?? "",
    isAvailable: bike.isAvailable,
  }));
  const equipment: AdminInventoryEquipment[] = equipmentRows.map((item) => ({
    id: item.id,
    location: item.location as RentalLocation,
    equipmentKey: item.equipmentKey,
    category: item.category as AdminInventoryEquipment["category"],
    labelDe: item.labelDe,
    labelEn: item.labelEn,
    priceCents: item.priceCents,
    isAvailable: item.isAvailable,
  }));
  const locationOptions = locations.map((key) => ({ key, label: rentalLocationLabels.de[key] }));

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={session.user} isAdmin={isAdmin(session.user)} variant="inset" />
      <SidebarInset className="min-w-0 overflow-hidden">
        <SiteHeader title="Inventar" />
        <div className="admin-page-surface">
          <main className="flex flex-1 flex-col p-8 lg:p-12">
            <InventoryTable
              initialBikes={bikes}
              initialEquipment={equipment}
              locations={locationOptions}
              canManageAllLocations={isAdmin(session.user)}
            />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
