import { asc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InventoryTable } from "@/components/inventory-table";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAssignedLocation, isAdmin } from "@/lib/auth/authorization";
import { getServerSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { accessoryInventory, bikeModels, bikeVariants, rentalAssets } from "@/lib/db/schema";
import { rentalLocationLabels, rentalLocations, type RentalLocation } from "@/lib/inquiries/catalog";
import type { EquipmentCategory } from "@/lib/inventory/equipment-categories";
import { createBikeKey } from "@/lib/inventory/bike-key";

export type AdminInventoryBike = {
  id: number;
  location: RentalLocation;
  bikeKey: string;
  title: string;
  nickname: string | null;
  frameNumber: string | null;
  weekdayPriceCents: number;
  weekendPriceCents: number;
  size: string;
  isAvailable: boolean;
};

export type AdminInventoryEquipment = {
  id: number;
  location: RentalLocation;
  equipmentKey: string;
  category: EquipmentCategory;
  labelDe: string;
  labelEn: string;
  priceCents: number;
  availableQuantity: number;
  quantityRelevant: boolean;
  isAvailable: boolean;
};

export const metadata: Metadata = {
  title: "Inventar",
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
    .select({ asset: rentalAssets, model: bikeModels, variant: bikeVariants })
    .from(rentalAssets)
    .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
    .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
    .where(inArray(rentalAssets.location, locations))
    .orderBy(asc(rentalAssets.location), asc(rentalAssets.displayName))
    .all();
  const equipmentRows = db
    .select()
    .from(accessoryInventory)
    .where(inArray(accessoryInventory.location, locations))
    .orderBy(asc(accessoryInventory.location), asc(accessoryInventory.category), asc(accessoryInventory.accessoryKey))
    .all();

  const bikes: AdminInventoryBike[] = bikeRows.map(({ asset, model, variant }) => ({
    id: asset.id,
    location: asset.location as RentalLocation,
    bikeKey: createBikeKey(model.title, variant.size),
    title: model.title,
    nickname: asset.nickname,
    frameNumber: asset.frameNumber,
    weekdayPriceCents: asset.weekdayPriceCents,
    weekendPriceCents: asset.weekendPriceCents,
    size: variant.size,
    isAvailable: asset.state === "active",
  }));
  const equipment: AdminInventoryEquipment[] = equipmentRows.map((item) => ({
    id: item.id,
    location: item.location as RentalLocation,
    equipmentKey: item.accessoryKey,
    category: item.category as AdminInventoryEquipment["category"],
    labelDe: item.labelDe,
    labelEn: item.labelEn,
    priceCents: item.priceCents,
    availableQuantity: item.availableQuantity,
    quantityRelevant: item.quantityRelevant,
    isAvailable: item.state === "active",
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
