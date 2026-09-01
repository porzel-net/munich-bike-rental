import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import type { CalendarAccountState } from "@/components/admin-calendar/calendar-subscription";
import type { CalendarFilterOption } from "@/components/admin-calendar/calendar-filters";
import { AdminCalendarView } from "@/components/admin-calendar/admin-calendar-view";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import {
  addCalendarBookingBike,
  buildCalendarWeeks,
  getCalendarGridRange,
  getCalendarMonthKey,
  getCalendarMonthName,
  getCalendarYearLabel,
  parseCalendarMonthKey,
  toCalendarBookingEvent,
  type CalendarBookingBike,
} from "@/lib/calendar/admin-calendar";
import { getDatabase } from "@/lib/db/client";
import { berlinDateKey } from "@/lib/datetime";
import { calendarStatusPreferenceKey } from "@/lib/calendar/filter-preferences";
import {
  bookingAssetAllocations,
  bookingOfferItems,
  bookingOffers,
  bookingRequestedItems,
  bookings,
  bookingStatuses,
  calendarAccounts,
  calendarFilterPreferences,
  rentalAssets,
  type BookingStatus,
} from "@/lib/db/schema";
import { bookingPresentation } from "@/lib/bookings/presentation";
import {
  getComputerMountTypeLabel,
  getPedalTypeLabel,
  rentalLocationLabels,
  rentalLocations,
  type RentalLocation,
} from "@/lib/inquiries/catalog";
import { siteConfig } from "@/lib/site";

function resolveLocation(value: string | undefined, administrator: boolean, assignedLocation: RentalLocation | null) {
  if (!administrator) return assignedLocation ?? "all";
  if (!value || value === "all") return "all";
  return rentalLocations.includes(value as RentalLocation) ? (value as RentalLocation) : "all";
}

function resolveStatuses(value: string | undefined): BookingStatus[] {
  if (!value) return [];
  return value
    .split(",")
    .filter((status): status is BookingStatus => (bookingStatuses as readonly string[]).includes(status));
}

function decodeCookieValue(value: string | undefined) {
  if (!value) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function calendarHref(month: Date, location: string, status: string) {
  const params = new URLSearchParams({ month: getCalendarMonthKey(month) });
  if (location !== "all") params.set("location", location);
  if (status && status !== "all") params.set("status", status);
  return `/admin/calendar?${params.toString()}`;
}

export const metadata: Metadata = {
  title: "Kalender",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; location?: string; status?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/admin/login");

  const administrator = isAdmin(session.user);
  const assignedLocation = getAssignedLocation(session.user);
  if (session.user.mustChangePassword || !session.user.twoFactorEnabled || (!administrator && !assignedLocation)) {
    redirect("/admin");
  }

  const params = await searchParams;
  const month = parseCalendarMonthKey(params.month);
  const db = getDatabase();
  const savedFilterPreference = db
    .select({ location: calendarFilterPreferences.location, status: calendarFilterPreferences.status })
    .from(calendarFilterPreferences)
    .where(eq(calendarFilterPreferences.userId, session.user.id))
    .get();
  const location = resolveLocation(params.location ?? savedFilterPreference?.location, administrator, assignedLocation);
  const statusPreference =
    params.status ??
    savedFilterPreference?.status ??
    decodeCookieValue((await cookies()).get(calendarStatusPreferenceKey)?.value);
  const statuses = resolveStatuses(statusPreference);
  const { gridStart, gridEnd } = getCalendarGridRange(month);
  const conditions = [
    location !== "all" ? inArray(bookings.location, [location]) : null,
    statuses.length ? inArray(bookings.status, statuses) : null,
    gte(bookings.periodTo, formatDateForQuery(gridStart)),
    lte(bookings.periodFrom, formatDateForQuery(gridEnd)),
  ].filter((condition): condition is NonNullable<typeof condition> => condition !== null);
  const rows = db
    .select()
    .from(bookings)
    .where(and(...conditions))
    .orderBy(bookings.periodFrom, bookings.customerName)
    .all();
  const items = rows.length
    ? db
        .select()
        .from(bookingRequestedItems)
        .where(
          inArray(
            bookingRequestedItems.bookingId,
            rows.map((row) => row.id),
          ),
        )
        .all()
    : [];
  const itemsByBooking = new Map<number, typeof items>();
  for (const item of items) itemsByBooking.set(item.bookingId, [...(itemsByBooking.get(item.bookingId) ?? []), item]);

  const bookingIds = rows.map((row) => row.id);
  const offers = bookingIds.length
    ? db
        .select()
        .from(bookingOffers)
        .where(inArray(bookingOffers.bookingId, bookingIds))
        .orderBy(desc(bookingOffers.offerNumber))
        .all()
    : [];
  const latestOfferIds = new Set<number>();
  const latestOfferByBooking = new Map<number, number>();
  for (const offer of offers) {
    if (!latestOfferByBooking.has(offer.bookingId)) {
      latestOfferByBooking.set(offer.bookingId, offer.id);
      latestOfferIds.add(offer.id);
    }
  }
  const offerIds = [...latestOfferIds];
  const offerItems = offerIds.length
    ? db.select().from(bookingOfferItems).where(inArray(bookingOfferItems.offerId, offerIds)).all()
    : [];
  const allocations = bookingIds.length
    ? db
        .select()
        .from(bookingAssetAllocations)
        .where(inArray(bookingAssetAllocations.bookingId, bookingIds))
        .orderBy(desc(bookingAssetAllocations.createdAt))
        .all()
    : [];
  const assetIds = [
    ...new Set([...offerItems.map((item) => item.assetId), ...allocations.map((allocation) => allocation.assetId)]),
  ];
  const assets = assetIds.length
    ? db
        .select({ id: rentalAssets.id, displayName: rentalAssets.displayName, nickname: rentalAssets.nickname })
        .from(rentalAssets)
        .where(inArray(rentalAssets.id, assetIds))
        .all()
    : [];
  const assetDetails = new Map<number, CalendarBookingBike>(
    assets.map((asset) => [asset.id, { displayName: asset.displayName, nickname: asset.nickname }]),
  );
  const allocatedAssetsByBooking = new Map<number, CalendarBookingBike[]>();
  const allocatedAssetIdsByBooking = new Map<number, Set<number>>();
  for (const allocation of allocations) {
    const bike = assetDetails.get(allocation.assetId);
    if (bike)
      addCalendarBookingBike(
        allocatedAssetsByBooking,
        allocatedAssetIdsByBooking,
        allocation.bookingId,
        allocation.assetId,
        bike,
      );
  }
  const offeredAssetsByBooking = new Map<number, CalendarBookingBike[]>();
  const offeredAssetIdsByBooking = new Map<number, Set<number>>();
  for (const item of offerItems) {
    const offer = offers.find((candidate) => candidate.id === item.offerId);
    const bike = assetDetails.get(item.assetId);
    if (offer && bike)
      addCalendarBookingBike(offeredAssetsByBooking, offeredAssetIdsByBooking, offer.bookingId, item.assetId, bike);
  }
  const events = rows.map((row) =>
    toCalendarBookingEvent({
      id: row.id,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      location: row.location as RentalLocation,
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      status: row.status,
      requestedItems: (itemsByBooking.get(row.id) ?? []).map((item) => item.requestedLabel),
      selectedItems: (allocatedAssetsByBooking.get(row.id) ?? offeredAssetsByBooking.get(row.id) ?? []).map(
        (bike) => bike.displayName,
      ),
      selectedBikes: allocatedAssetsByBooking.get(row.id) ?? offeredAssetsByBooking.get(row.id) ?? [],
      customerPhone: row.customerPhone,
      pickupTime: row.pickupTime,
      dropoffTime: row.dropoffTime,
      requestedEquipment: [
        ...new Set(
          (itemsByBooking.get(row.id) ?? []).flatMap((item) =>
            [
              item.needsPedals
                ? `Pedale${item.pedalType ? ` (${getPedalTypeLabel(item.pedalType, "de")})` : ""}`
                : null,
              item.needsComputerMount
                ? `Computerhalterung${item.computerMountType ? ` (${getComputerMountTypeLabel(item.computerMountType, "de")})` : ""}`
                : null,
              item.needsHelmet ? "Helm" : null,
              item.needsClothing ? "Radbekleidung" : null,
            ].filter((value): value is string => Boolean(value)),
          ),
        ),
      ],
    }),
  );
  const { weeks } = buildCalendarWeeks(events, month);
  const locationItems: CalendarFilterOption[] = [
    { value: "all", label: "Alle Standorte" },
    ...(administrator ? rentalLocations.map((value) => ({ value, label: rentalLocationLabels.de[value] })) : []),
  ];
  const statusItems: CalendarFilterOption[] = bookingStatuses.map((value) => ({
    value,
    label: bookingPresentation[value].label,
  }));
  const queryLocation = location === "all" ? "all" : location;
  const queryStatus = statuses.join(",");
  const calendarBaseUrl = process.env.NODE_ENV === "development" ? "http://localhost:3000" : siteConfig.url;
  const calendarUrl = new URL("/api/calendar/feed.ics", calendarBaseUrl).toString();
  const calendarAccountRow = db
    .select({
      username: calendarAccounts.username,
      enabled: calendarAccounts.enabled,
      createdAt: calendarAccounts.createdAt,
      updatedAt: calendarAccounts.updatedAt,
    })
    .from(calendarAccounts)
    .where(eq(calendarAccounts.userId, session.user.id))
    .get();
  const calendarAccount: CalendarAccountState = calendarAccountRow
    ? {
        ...calendarAccountRow,
        createdAt: calendarAccountRow.createdAt.toISOString(),
        updatedAt: calendarAccountRow.updatedAt.toISOString(),
      }
    : null;
  const calendarScopeLabel = administrator
    ? "alle Standorte"
    : assignedLocation
      ? rentalLocationLabels.de[assignedLocation]
      : "den zugewiesenen Standort";
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
        <SiteHeader title="Kalender" />
        <div className="relative isolate min-h-0 min-w-0 flex-1 overflow-auto bg-muted dark:bg-background">
          <main className="relative z-10 flex flex-1 flex-col gap-6 p-4 lg:p-8">
            <AdminCalendarView
              hasBookings={events.length > 0}
              locationItems={locationItems}
              locationValue={queryLocation}
              monthName={getCalendarMonthName(month)}
              nextMonthHref={calendarHref(
                new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1, 12)),
                queryLocation,
                queryStatus,
              )}
              previousMonthHref={calendarHref(
                new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1, 12)),
                queryLocation,
                queryStatus,
              )}
              statusItems={statusItems}
              statusValue={queryStatus}
              calendarFilterPreferenceSaved={Boolean(savedFilterPreference)}
              yearLabel={getCalendarYearLabel(month)}
              weeks={weeks}
              calendarAccount={calendarAccount}
              calendarAllLocations={administrator}
              calendarUrl={calendarUrl}
              calendarScopeLabel={calendarScopeLabel}
              bookingOptions={events.map((event) => ({
                id: event.id,
                label: event.orderNumber,
                detail: `${event.customerName} · ${event.periodFrom}–${event.periodTo}`,
              }))}
            />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function formatDateForQuery(date: Date) {
  return berlinDateKey(date);
}
