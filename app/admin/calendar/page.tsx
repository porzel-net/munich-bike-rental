import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import type { CSSProperties } from "react";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import type { CalendarAccountState } from "@/components/admin-calendar/calendar-subscription";
import type { CalendarFilterOption } from "@/components/admin-calendar/calendar-filters";
import { AdminCalendarView } from "@/components/admin-calendar/admin-calendar-view";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import {
  buildCalendarWeeks,
  getCalendarMonthKey,
  getCalendarMonthName,
  getCalendarYearLabel,
  parseCalendarMonthKey,
  toCalendarBookingEvent,
} from "@/lib/calendar/admin-calendar";
import { getDatabase } from "@/lib/db/client";
import {
  bookingAssetAllocations,
  bookingOfferItems,
  bookingOffers,
  bookingRequestedItems,
  bookings,
  bookingStatuses,
  calendarAccounts,
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

function calendarHref(month: Date, location: string, status: string) {
  const params = new URLSearchParams({ month: getCalendarMonthKey(month) });
  if (location !== "all") params.set("location", location);
  if (status && status !== "all") params.set("status", status);
  return `/admin/calendar?${params.toString()}`;
}

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
  const location = resolveLocation(params.location, administrator, assignedLocation);
  const statuses = resolveStatuses(params.status);
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const db = getDatabase();
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
        .select({ id: rentalAssets.id, displayName: rentalAssets.displayName })
        .from(rentalAssets)
        .where(inArray(rentalAssets.id, assetIds))
        .all()
    : [];
  const assetNames = new Map(assets.map((asset) => [asset.id, asset.displayName]));
  const allocatedAssetsByBooking = new Map<number, string[]>();
  for (const allocation of allocations) {
    const name = assetNames.get(allocation.assetId);
    if (name && !allocatedAssetsByBooking.get(allocation.bookingId)?.includes(name)) {
      allocatedAssetsByBooking.set(allocation.bookingId, [
        ...(allocatedAssetsByBooking.get(allocation.bookingId) ?? []),
        name,
      ]);
    }
  }
  const offeredAssetsByBooking = new Map<number, string[]>();
  for (const item of offerItems) {
    const offer = offers.find((candidate) => candidate.id === item.offerId);
    const name = assetNames.get(item.assetId);
    if (offer && name)
      offeredAssetsByBooking.set(offer.bookingId, [...(offeredAssetsByBooking.get(offer.bookingId) ?? []), name]);
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
      selectedItems: allocatedAssetsByBooking.get(row.id) ?? offeredAssetsByBooking.get(row.id) ?? [],
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
                new Date(month.getFullYear(), month.getMonth() + 1, 1),
                queryLocation,
                queryStatus,
              )}
              previousMonthHref={calendarHref(
                new Date(month.getFullYear(), month.getMonth() - 1, 1),
                queryLocation,
                queryStatus,
              )}
              statusItems={statusItems}
              statusValue={queryStatus}
              yearLabel={getCalendarYearLabel(month)}
              weeks={weeks}
              calendarAccount={calendarAccount}
              calendarAllLocations={administrator}
              calendarUrl={calendarUrl}
              calendarScopeLabel={calendarScopeLabel}
            />
          </main>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-1 h-48 bg-linear-to-b from-background via-muted to-transparent dark:hidden" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-48 bg-linear-to-t from-background via-muted/80 to-transparent dark:via-background/80" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function formatDateForQuery(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
