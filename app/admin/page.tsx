import { and, eq, inArray } from "drizzle-orm";
import type { CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { AdminDashboardOverview } from "@/components/admin-dashboard-overview";
import { SiteHeader } from "@/components/site-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, getVisibleLocationScope, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import {
  bookingRequestedItems,
  bookings,
  financialAccounts,
  financialTransactions,
  rentalAssets,
} from "@/lib/db/schema";
import { getRentalDays } from "@/lib/inventory/pricing";
import { receivedAtFromOrderNumber } from "@/lib/bookings/order-number";

function bookingIncomingAt(booking: { source: string; orderNumber: string; createdAt: Date }) {
  return booking.source === "legacy"
    ? (receivedAtFromOrderNumber(booking.orderNumber) ?? booking.createdAt)
    : booking.createdAt;
}

export default async function AdminPage() {
  const session = await getServerSession();
  if (!session) return null;

  const administrator = isAdmin(session.user);
  const assignedLocation = getVisibleLocationScope(session.user);
  // The page layout already rejects users without a valid location. Keep the
  // scope explicit here as well: dashboard aggregates are sensitive data and
  // must never silently fall back to the all-locations query for a location
  // user.
  const visibleLocation = administrator ? null : assignedLocation;
  if (!administrator && !visibleLocation) return null;
  const db = getDatabase();
  const bankAccounts = administrator
    ? db
        .select({
          id: financialAccounts.id,
          currency: financialAccounts.currency,
          openingBalanceCents: financialAccounts.openingBalanceCents,
          providerBalanceCents: financialAccounts.providerBalanceCents,
        })
        .from(financialAccounts)
        .where(and(eq(financialAccounts.type, "bank"), eq(financialAccounts.status, "active")))
        .all()
    : [];
  const bankAccountIds = bankAccounts.map((account) => account.id);
  const bankTransactions = bankAccountIds.length
    ? db
        .select({
          financialAccountId: financialTransactions.financialAccountId,
          amountCents: financialTransactions.amountCents,
        })
        .from(financialTransactions)
        .where(inArray(financialTransactions.financialAccountId, bankAccountIds))
        .all()
    : [];
  const movementsByAccount = new Map<number, number>();
  for (const transaction of bankTransactions) {
    movementsByAccount.set(
      transaction.financialAccountId,
      (movementsByAccount.get(transaction.financialAccountId) ?? 0) + transaction.amountCents,
    );
  }
  const bankBalanceCents = bankAccounts.reduce(
    (total, account) =>
      total + (account.providerBalanceCents ?? account.openingBalanceCents + (movementsByAccount.get(account.id) ?? 0)),
    0,
  );
  const bankCurrency = bankAccounts[0]?.currency ?? "EUR";
  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric" }).format(new Date()),
  );
  const currentMonthIndex =
    Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", month: "2-digit" }).format(new Date())) - 1;
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const activityData = monthLabels.map((month) => ({ month, amount: 0 }));
  const revenueBookings = db
    .select({
      id: bookings.id,
      quotedTotalCents: bookings.quotedTotalCents,
      createdAt: bookings.createdAt,
      source: bookings.source,
      orderNumber: bookings.orderNumber,
      location: bookings.location,
      periodFrom: bookings.periodFrom,
      periodTo: bookings.periodTo,
    })
    .from(bookings)
    .where(
      visibleLocation
        ? and(
            eq(bookings.location, visibleLocation),
            inArray(bookings.status, ["confirmed", "checked_out", "completed"]),
          )
        : inArray(bookings.status, ["confirmed", "checked_out", "completed"]),
    )
    .all()
    .map((booking) => ({ ...booking, createdAt: bookingIncomingAt(booking) }));
  for (const booking of revenueBookings) {
    const bookingYear = Number(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric" }).format(booking.createdAt),
    );
    if (bookingYear !== currentYear) continue;
    const bookingMonth = Number(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", month: "2-digit" }).format(booking.createdAt),
    );
    if (bookingMonth >= 1 && bookingMonth <= 12) {
      activityData[bookingMonth - 1].amount += booking.quotedTotalCents / 100;
    }
  }

  const enduraceRevenueBySize = new Map(["XS", "S", "M", "L"].map((size) => [size, 0]));
  const monthlyEnduraceRevenueBySize = new Map(
    ["XS", "S", "M", "L"].map((size) => [size, monthLabels.map((month) => ({ month, amount: 0 }))]),
  );
  const enduraceBookings = db
    .select({
      id: bookings.id,
      quotedTotalCents: bookings.quotedTotalCents,
      createdAt: bookings.createdAt,
      source: bookings.source,
      orderNumber: bookings.orderNumber,
      periodFrom: bookings.periodFrom,
      periodTo: bookings.periodTo,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.location, visibleLocation ?? "munich"),
        inArray(bookings.status, ["confirmed", "checked_out", "completed"]),
      ),
    )
    .all()
    .map((booking) => ({ ...booking, createdAt: bookingIncomingAt(booking) }));
  const currentYearBookings = enduraceBookings.filter((booking) => {
    const bookingYear = Number(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric" }).format(booking.createdAt),
    );
    return bookingYear === currentYear;
  });
  const bookingIds = currentYearBookings.map((booking) => booking.id);
  const requestedItems = bookingIds.length
    ? db
        .select({ bookingId: bookingRequestedItems.bookingId, requestedLabel: bookingRequestedItems.requestedLabel })
        .from(bookingRequestedItems)
        .where(inArray(bookingRequestedItems.bookingId, bookingIds))
        .all()
    : [];
  const itemsByBooking = new Map<number, typeof requestedItems>();
  for (const item of requestedItems) {
    const items = itemsByBooking.get(item.bookingId) ?? [];
    items.push(item);
    itemsByBooking.set(item.bookingId, items);
  }
  for (const booking of currentYearBookings) {
    const items = itemsByBooking.get(booking.id) ?? [];
    if (items.length === 0) continue;
    const revenuePerItem = Math.round(booking.quotedTotalCents / items.length);
    for (const item of items) {
      const size = item.requestedLabel.match(/^Endurace CF SL 8\s*-\s*(XS|S|M|L)$/i)?.[1]?.toUpperCase();
      if (!size) continue;
      enduraceRevenueBySize.set(size, (enduraceRevenueBySize.get(size) ?? 0) + revenuePerItem);
      const bookingMonth = Number(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", month: "2-digit" }).format(booking.createdAt),
      );
      if (bookingMonth >= 1 && bookingMonth <= 12) {
        monthlyEnduraceRevenueBySize.get(size)![bookingMonth - 1].amount += revenuePerItem / 100;
      }
    }
  }
  const revenueBySize = ["XS", "S", "M", "L"].map((size) => ({
    size,
    amountCents: enduraceRevenueBySize.get(size) ?? 0,
    monthlyRevenue: monthlyEnduraceRevenueBySize.get(size) ?? monthLabels.map((month) => ({ month, amount: 0 })),
  }));
  const munichBikeCount = db
    .select({ id: rentalAssets.id })
    .from(rentalAssets)
    .where(and(eq(rentalAssets.location, visibleLocation ?? "munich"), eq(rentalAssets.state, "active")))
    .all().length;
  const utilizationData = monthLabels.map((month, monthIndex) => {
    const monthStart = `${currentYear}-${String(monthIndex + 1).padStart(2, "0")}-01`;
    const monthEnd = new Date(Date.UTC(currentYear, monthIndex + 1, 0)).toISOString().slice(0, 10);
    const daysInMonth = new Date(Date.UTC(currentYear, monthIndex + 1, 0)).getUTCDate();
    const bookedBikeDays = currentYearBookings.reduce((total, booking) => {
      if (booking.periodTo < monthStart || booking.periodFrom > monthEnd) return total;
      const requestedBikeCount = requestedItems.filter((item) => item.bookingId === booking.id).length;
      if (requestedBikeCount === 0) return total;
      const overlapFrom = booking.periodFrom > monthStart ? booking.periodFrom : monthStart;
      const overlapTo = booking.periodTo < monthEnd ? booking.periodTo : monthEnd;
      return total + requestedBikeCount * getRentalDays(overlapFrom, overlapTo);
    }, 0);
    const availableBikeDays = munichBikeCount * daysInMonth;
    return {
      month,
      utilization: availableBikeDays > 0 ? Math.min(100, Math.round((bookedBikeDays / availableBikeDays) * 100)) : 0,
    };
  });
  const reportMonthKeys = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(currentYear, currentMonthIndex - (5 - index), 1));
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: "Europe/Berlin" })
        .format(date)
        .replace(".", ""),
    };
  });
  const locationLabels: Record<string, string> = {
    munich: "München",
    regensburg: "Regensburg",
    lindau: "Lindau",
    friedrichshafen: "Friedrichshafen",
    konstanz: "Konstanz",
  };
  const bookingDaysByLocation: Record<string, Array<{ month: string; days: number }>> = {
    "Alle Standorte": reportMonthKeys.map(({ label }) => ({ month: label, days: 0 })),
    ...Object.values(locationLabels).reduce<Record<string, Array<{ month: string; days: number }>>>((result, label) => {
      result[label] = reportMonthKeys.map(({ label: month }) => ({ month, days: 0 }));
      return result;
    }, {}),
  };
  const demandBookings = db
    .select({
      id: bookings.id,
      location: bookings.location,
      status: bookings.status,
      createdAt: bookings.createdAt,
      source: bookings.source,
      orderNumber: bookings.orderNumber,
      periodFrom: bookings.periodFrom,
      periodTo: bookings.periodTo,
      quotedTotalCents: bookings.quotedTotalCents,
    })
    .from(bookings)
    .where(
      visibleLocation
        ? and(
            eq(bookings.location, visibleLocation),
            inArray(bookings.status, ["inquiry_received", "offer_sent", "confirmed", "checked_out", "completed"]),
          )
        : inArray(bookings.status, ["inquiry_received", "offer_sent", "confirmed", "checked_out", "completed"]),
    )
    .all()
    .map((booking) => ({ ...booking, createdAt: bookingIncomingAt(booking) }));
  const demandBookingIds = demandBookings.map((booking) => booking.id);
  const demandItems = demandBookingIds.length
    ? db
        .select({ bookingId: bookingRequestedItems.bookingId })
        .from(bookingRequestedItems)
        .where(inArray(bookingRequestedItems.bookingId, demandBookingIds))
        .all()
    : [];
  const bikesByDemandBooking = new Map<number, number>();
  for (const item of demandItems) {
    bikesByDemandBooking.set(item.bookingId, (bikesByDemandBooking.get(item.bookingId) ?? 0) + 1);
  }
  const rentalDaysByLocationMap = new Map(
    Object.entries(locationLabels).map(([key, label]) => [
      key,
      {
        key,
        label,
        data: reportMonthKeys.map(({ label: month }) => ({ month, days: 0 })),
      },
    ]),
  );
  for (const booking of demandBookings) {
    const bookingMonthKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
    })
      .format(booking.createdAt)
      .replace("/", "-");
    const monthIndex = reportMonthKeys.findIndex(({ key }) => key === bookingMonthKey);
    if (monthIndex === -1) continue;
    const days = getRentalDays(booking.periodFrom, booking.periodTo) * (bikesByDemandBooking.get(booking.id) ?? 1);
    bookingDaysByLocation["Alle Standorte"][monthIndex].days += days;
    const locationLabel = locationLabels[booking.location];
    if (locationLabel) {
      bookingDaysByLocation[locationLabel][monthIndex].days += days;
      rentalDaysByLocationMap.get(booking.location)!.data[monthIndex].days += days;
    }
  }
  const weekdayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const weekdayBookingDays = weekdayNames.map((day) => ({ day, days: 0 }));
  for (const booking of demandBookings) {
    const start = new Date(`${booking.periodFrom}T00:00:00.000Z`);
    const end = new Date(`${booking.periodTo}T00:00:00.000Z`);
    for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
      weekdayBookingDays[(date.getUTCDay() + 6) % 7].days += bikesByDemandBooking.get(booking.id) ?? 1;
    }
  }
  const acceptedMunichStatuses = new Set(["confirmed", "checked_out", "completed"]);
  const openMunichStatuses = new Set(["inquiry_received", "offer_sent"]);
  const munichRequestCapacity = demandBookings.reduce(
    (result, booking) => {
      if (booking.location !== (visibleLocation ?? "munich")) return result;
      result.total += 1;
      if (acceptedMunichStatuses.has(booking.status)) result.accepted += 1;
      if (openMunichStatuses.has(booking.status)) result.open += 1;
      return result;
    },
    { accepted: 0, total: 0, open: 0 },
  );
  const allBookingMetrics = db
    .select({
      status: bookings.status,
      createdAt: bookings.createdAt,
      periodFrom: bookings.periodFrom,
      periodTo: bookings.periodTo,
      quotedTotalCents: bookings.quotedTotalCents,
      source: bookings.source,
      orderNumber: bookings.orderNumber,
    })
    .from(bookings)
    .where(visibleLocation ? eq(bookings.location, visibleLocation) : undefined)
    .all()
    .map((booking) => ({ ...booking, createdAt: bookingIncomingAt(booking) }));
  const acceptedBookingMetrics = allBookingMetrics.filter((booking) =>
    ["confirmed", "checked_out", "completed"].includes(booking.status),
  );
  const bookingFunnelData = [
    { stage: "Anfragen", count: allBookingMetrics.length },
    {
      stage: "Angebote",
      count: allBookingMetrics.filter((booking) =>
        ["offer_sent", "confirmed", "checked_out", "completed"].includes(booking.status),
      ).length,
    },
    { stage: "Bestätigt", count: acceptedBookingMetrics.length },
    {
      stage: "Abgeschlossen",
      count: allBookingMetrics.filter((booking) => booking.status === "completed").length,
    },
  ];
  const averageRentalDays = acceptedBookingMetrics.length
    ? Math.round(
        (acceptedBookingMetrics.reduce(
          (total, booking) => total + getRentalDays(booking.periodFrom, booking.periodTo),
          0,
        ) /
          acceptedBookingMetrics.length) *
          10,
      ) / 10
    : 0;
  const averageOrderValueCents = acceptedBookingMetrics.length
    ? Math.round(
        acceptedBookingMetrics.reduce((total, booking) => total + booking.quotedTotalCents, 0) /
          acceptedBookingMetrics.length,
      )
    : 0;
  const bookingFunnelSummary = {
    averageRentalDays,
    averageOrderValueCents,
    acceptanceRate: allBookingMetrics.length
      ? Math.round((acceptedBookingMetrics.length / allBookingMetrics.length) * 100)
      : 0,
    open: allBookingMetrics.filter((booking) => ["inquiry_received", "offer_sent"].includes(booking.status)).length,
  };
  const firstRequest = allBookingMetrics
    .map((booking) => booking.createdAt)
    .sort((left, right) => left.getTime() - right.getTime())[0];
  const firstRequestMonthKey = firstRequest
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" })
        .format(firstRequest)
        .replace("/", "-")
    : null;
  const lastTwelveMonthsStart = new Date(Date.UTC(currentYear, currentMonthIndex - 11, 1));
  const firstRequestMonth = firstRequestMonthKey
    ? new Date(`${firstRequestMonthKey}-01T00:00:00.000Z`)
    : lastTwelveMonthsStart;
  const chartStart = firstRequestMonth > lastTwelveMonthsStart ? firstRequestMonth : lastTwelveMonthsStart;
  const chartMonthCount =
    currentYear * 12 + currentMonthIndex - (chartStart.getUTCFullYear() * 12 + chartStart.getUTCMonth()) + 1;
  const potentialRevenueData = Array.from({ length: Math.max(0, chartMonthCount) }, (_, index) => {
    const date = new Date(Date.UTC(chartStart.getUTCFullYear(), chartStart.getUTCMonth() + index, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      month: new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" })
        .format(date)
        .replace(".", ""),
      amount: 0,
    };
  });
  const potentialRevenueByMonth = new Map(potentialRevenueData.map((point) => [point.key, point]));
  for (const booking of allBookingMetrics) {
    const bookingMonthKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
    })
      .format(booking.createdAt)
      .replace("/", "-");
    const point = potentialRevenueByMonth.get(bookingMonthKey);
    if (point) point.amount += booking.quotedTotalCents / 100;
  }
  const rentalDaysByLocation = [...rentalDaysByLocationMap.values()];

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
        <SiteHeader title="Dashboard" />
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-muted dark:bg-background">
          <ScrollArea className="h-full min-h-0 w-full">
            <AdminDashboardOverview
              bankBalanceCents={bankBalanceCents}
              bankCurrency={bankCurrency}
              activityData={activityData}
              currentMonthIndex={currentMonthIndex}
              revenueBySize={revenueBySize}
              utilizationData={utilizationData}
              bookingDaysByLocation={bookingDaysByLocation}
              weekdayBookingDays={weekdayBookingDays}
              munichRequestCapacity={munichRequestCapacity}
              rentalDaysByLocation={rentalDaysByLocation}
              bookingFunnelData={bookingFunnelData}
              bookingFunnelSummary={bookingFunnelSummary}
              potentialRevenueData={potentialRevenueData.map(({ month, amount }) => ({ month, amount }))}
            />
          </ScrollArea>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
