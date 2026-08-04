import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { addMonths, endOfMonth, format, subMonths } from "date-fns";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { AdminCalendarView } from "@/components/admin-calendar/admin-calendar-view";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { bookingPresentation } from "@/lib/bookings/presentation";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { bookingRequestedItems, bookings } from "@/lib/db/schema";
import { buildCalendarWeeks, getCalendarMonthKey, getCalendarMonthLabel, parseCalendarMonthKey, toCalendarBookingEvent } from "@/lib/calendar/admin-calendar";
import { rentalLocationLabels, rentalLocations, type RentalLocation } from "@/lib/inquiries/catalog";
import type { BookingStatus } from "@/lib/db/schema";
import type { CalendarFilterOption } from "@/components/admin-calendar/calendar-filters";

function resolveLocationFilter(value: string | undefined) {
  if (!value || value === "all") return "all";
  return rentalLocations.includes(value as RentalLocation) ? (value as RentalLocation) : "all";
}

function resolveStatusFilter(value: string | undefined) {
  if (!value || value === "all") return "all";
  return value in bookingPresentation ? (value as BookingStatus) : "all";
}

function buildCalendarHref({
  monthDate,
  location,
  status,
}: {
  monthDate: Date;
  location: string;
  status: string;
}) {
  const params = new URLSearchParams();
  params.set("month", getCalendarMonthKey(monthDate));
  if (location !== "all") params.set("location", location);
  if (status !== "all") params.set("status", status);
  const query = params.toString();
  return query ? `/admin/calendar?${query}` : "/admin/calendar";
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; location?: string; status?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/admin/login");

  const administrator = isAdmin(session.user);
  const db = getDatabase();
  const params = await searchParams;

  const monthDate = parseCalendarMonthKey(params.month);
  const monthStartKey = format(monthDate, "yyyy-MM-dd");
  const monthEndKey = format(endOfMonth(monthDate), "yyyy-MM-dd");
  const selectedLocation = resolveLocationFilter(params.location);
  const selectedStatus = resolveStatusFilter(params.status);

  const bookingConditions = [lte(bookings.periodFrom, monthEndKey), gte(bookings.periodTo, monthStartKey)];
  if (selectedLocation !== "all") bookingConditions.push(eq(bookings.location, selectedLocation));
  if (selectedStatus !== "all") bookingConditions.push(eq(bookings.status, selectedStatus));

  const bookingRows = db
    .select()
    .from(bookings)
    .where(and(...bookingConditions))
    .orderBy(asc(bookings.periodFrom), asc(bookings.periodTo), asc(bookings.id))
    .all();

  const requestedItemsRows = bookingRows.length
    ? db
        .select({
          bookingId: bookingRequestedItems.bookingId,
          requestedLabel: bookingRequestedItems.requestedLabel,
        })
        .from(bookingRequestedItems)
        .where(inArray(bookingRequestedItems.bookingId, bookingRows.map((row) => row.id)))
        .orderBy(asc(bookingRequestedItems.bookingId), asc(bookingRequestedItems.position))
        .all()
    : [];

  const requestedItemsByBooking = new Map<number, string[]>();
  for (const item of requestedItemsRows) {
    requestedItemsByBooking.set(item.bookingId, [...(requestedItemsByBooking.get(item.bookingId) ?? []), item.requestedLabel]);
  }

  const calendarBookings = bookingRows.map((row) =>
    toCalendarBookingEvent({
      id: row.id,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      location: row.location as RentalLocation,
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      status: row.status as BookingStatus,
      requestedItems: requestedItemsByBooking.get(row.id) ?? [],
    }),
  );

  const { weeks } = buildCalendarWeeks(calendarBookings, monthDate);
  const monthLabel = getCalendarMonthLabel(monthDate);

  const locationItems: CalendarFilterOption[] = [
    { value: "all", label: "Alle Standorte" },
    ...rentalLocations.map((location) => ({
      value: location,
      label: rentalLocationLabels.de[location],
    })),
  ];

  const statusItems: CalendarFilterOption[] = [
    { value: "all", label: "Alle Status" },
    ...Object.keys(bookingPresentation).map((status) => ({
      value: status,
      label: bookingPresentation[status as BookingStatus].label,
    })),
  ];

  const locationValue = selectedLocation === "all" ? "all" : selectedLocation;
  const statusValue = selectedStatus === "all" ? "all" : selectedStatus;

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
      <SidebarInset>
        <SiteHeader title="Kalender" />
        <main className="flex flex-1 flex-col p-8 lg:p-12">
          <AdminCalendarView
            hasBookings={calendarBookings.length > 0}
            locationItems={locationItems}
            locationValue={locationValue}
            monthLabel={monthLabel}
            nextMonthHref={buildCalendarHref({
              monthDate: addMonths(monthDate, 1),
              location: locationValue,
              status: statusValue,
            })}
            previousMonthHref={buildCalendarHref({
              monthDate: subMonths(monthDate, 1),
              location: locationValue,
              status: statusValue,
            })}
            statusItems={statusItems}
            statusValue={statusValue}
            weeks={weeks}
          />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
