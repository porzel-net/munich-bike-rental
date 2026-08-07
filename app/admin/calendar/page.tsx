import { and, gte, inArray, lte } from "drizzle-orm";
import type { CSSProperties } from "react";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
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
import { bookingRequestedItems, bookings, bookingStatuses, type BookingStatus } from "@/lib/db/schema";
import { bookingPresentation } from "@/lib/bookings/presentation";
import { rentalLocationLabels, rentalLocations, type RentalLocation } from "@/lib/inquiries/catalog";

function resolveLocation(value: string | undefined, administrator: boolean, assignedLocation: RentalLocation | null) {
  if (!administrator) return assignedLocation ?? "all";
  if (!value || value === "all") return "all";
  return rentalLocations.includes(value as RentalLocation) ? (value as RentalLocation) : "all";
}

function resolveStatus(value: string | undefined): BookingStatus | "all" {
  return value && (bookingStatuses as readonly string[]).includes(value) ? (value as BookingStatus) : "all";
}

function calendarHref(month: Date, location: string, status: string) {
  const params = new URLSearchParams({ month: getCalendarMonthKey(month) });
  if (location !== "all") params.set("location", location);
  if (status !== "all") params.set("status", status);
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
  const status = resolveStatus(params.status);
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const db = getDatabase();
  const conditions = [
    location !== "all" ? inArray(bookings.location, [location]) : null,
    status !== "all" ? inArray(bookings.status, [status]) : null,
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
        .select({ bookingId: bookingRequestedItems.bookingId, requestedLabel: bookingRequestedItems.requestedLabel })
        .from(bookingRequestedItems)
        .where(
          inArray(
            bookingRequestedItems.bookingId,
            rows.map((row) => row.id),
          ),
        )
        .all()
    : [];
  const itemsByBooking = new Map<number, string[]>();
  for (const item of items)
    itemsByBooking.set(item.bookingId, [...(itemsByBooking.get(item.bookingId) ?? []), item.requestedLabel]);
  const events = rows.map((row) =>
    toCalendarBookingEvent({
      id: row.id,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      location: row.location as RentalLocation,
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      status: row.status,
      requestedItems: itemsByBooking.get(row.id) ?? [],
    }),
  );
  const { weeks } = buildCalendarWeeks(events, month);
  const locationItems: CalendarFilterOption[] = [
    { value: "all", label: "Alle Standorte" },
    ...(administrator ? rentalLocations.map((value) => ({ value, label: rentalLocationLabels.de[value] })) : []),
  ];
  const statusItems: CalendarFilterOption[] = [
    { value: "all", label: "Alle Status" },
    ...bookingStatuses.map((value) => ({ value, label: bookingPresentation[value].label })),
  ];
  const queryLocation = location === "all" ? "all" : location;
  const queryStatus = status === "all" ? "all" : status;
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
        <main className="flex flex-1 flex-col gap-6 p-4 lg:p-8">
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
            todayHref={calendarHref(new Date(), queryLocation, queryStatus)}
            totalBookings={events.length}
            yearLabel={getCalendarYearLabel(month)}
            weeks={weeks}
          />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function formatDateForQuery(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
