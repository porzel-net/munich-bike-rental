import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { BookingAssigneeBadge } from "@/components/booking-assignee-badge";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { bookingRequestedItems, bookings, journalEntries, journalLines } from "@/lib/db/schema";
import { bookingPresentation } from "@/lib/bookings/presentation";
import { formatEuro } from "@/lib/bookings/money";
import { getBookingMigrationPreflight } from "@/lib/bookings/preflight";
import { BookingStatusFilter } from "@/components/booking-status-filter";
import type { BookingStatus } from "@/lib/db/schema";
import { rentalLocationLabels, rentalLocations, type RentalLocation } from "@/lib/inquiries/catalog";
import { authUser } from "@/lib/db/schema";

type BookingPeriod = "all" | "week" | "month" | "six_months" | "year";

function resolveLocationFilter(value: string | undefined) {
  if (!value || value === "all") return "all";
  return rentalLocations.includes(value as RentalLocation) ? (value as RentalLocation) : "all";
}

function getBookingPeriod(period: string | undefined) {
  const validPeriods: BookingPeriod[] = ["all", "week", "month", "six_months", "year"];
  const selected = validPeriods.includes(period as BookingPeriod) ? (period as BookingPeriod) : "all";
  if (selected === "all") return { selected, from: "", to: "" };

  const today = new Date();
  const from = new Date(today);
  if (selected === "week") from.setDate(from.getDate() - 7);
  if (selected === "month") from.setMonth(from.getMonth() - 1);
  if (selected === "six_months") from.setMonth(from.getMonth() - 6);
  if (selected === "year") from.setFullYear(from.getFullYear() - 1);
  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { selected, from: format(from), to: format(today) };
}

function bookingShortId(orderNumber: string) {
  return `#${orderNumber.slice(-4)}`;
}

function PaymentBadge({ openCents }: { openCents: number | undefined }) {
  if (openCents === undefined || openCents === 0) return null;
  const isOpen = openCents > 0;
  return (
    <Badge
      variant="outline"
      className={
        isOpen
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
      }
    >
      {isOpen ? "Offen" : "Guthaben"} {formatEuro(Math.abs(openCents))}
    </Badge>
  );
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; period?: string; location?: string }>;
}) {
  const session = await getServerSession();
  if (!session) return null;
  const administrator = isAdmin(session.user);
  const assignedLocation = getAssignedLocation(session.user);
  if (!administrator && !assignedLocation) redirect("/admin");
  const db = getDatabase();
  const params = await searchParams;
  const requestedStatus = params.status;
  const status = requestedStatus && requestedStatus in bookingPresentation ? (requestedStatus as BookingStatus) : null;
  const location = administrator ? resolveLocationFilter(params.location) : assignedLocation!;
  const search = params.q?.trim().toLocaleLowerCase("de-DE") ?? "";
  const datePeriod = getBookingPeriod(params.period);
  const preflight = administrator ? getBookingMigrationPreflight(db) : null;
  const bookingConditions = [administrator || location === "all" ? null : eq(bookings.location, location), status ? eq(bookings.status, status) : null].filter(
    (condition): condition is NonNullable<typeof condition> => condition !== null,
  );
  const queriedRows = bookingConditions.length
    ? db.select().from(bookings).where(and(...bookingConditions)).orderBy(desc(bookings.createdAt)).all()
    : db.select().from(bookings).orderBy(desc(bookings.createdAt)).all();
  const items = queriedRows.length
    ? db
        .select()
        .from(bookingRequestedItems)
        .where(
          inArray(
            bookingRequestedItems.bookingId,
            queriedRows.map((row) => row.id),
          ),
        )
        .all()
    : [];
  const itemsByBooking = new Map<number, string[]>();
  for (const item of items)
    itemsByBooking.set(item.bookingId, [...(itemsByBooking.get(item.bookingId) ?? []), item.requestedLabel]);
  const assigneeIds = queriedRows.flatMap((row) => (row.assignedUserId ? [row.assignedUserId] : []));
  const assignees = assigneeIds.length
    ? db
        .select({ id: authUser.id, name: authUser.name })
        .from(authUser)
        .where(inArray(authUser.id, assigneeIds))
        .all()
    : [];
  const assigneeNames = new Map(assignees.map((assignee) => [assignee.id, assignee.name]));
  const receivableLines = queriedRows.length
    ? db
        .select({ bookingId: journalEntries.bookingId, amountCents: journalLines.amountCents })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(
          and(
            inArray(
              journalEntries.bookingId,
              queriedRows.map((row) => row.id),
            ),
            eq(journalLines.account, "accounts_receivable"),
          ),
        )
        .all()
    : [];
  const openByBooking = new Map<number, number>();
  for (const line of receivableLines) {
    if (line.bookingId === null) continue;
    openByBooking.set(line.bookingId, (openByBooking.get(line.bookingId) ?? 0) + line.amountCents);
  }
  const rows = queriedRows.filter((row) => {
    const openCents = openByBooking.get(row.id) ?? 0;
    const searchableText = [
      row.customerName,
      row.orderNumber,
      row.customerEmail,
      row.customerPhone,
      rentalLocationLabels.de[row.location as keyof typeof rentalLocationLabels.de] ?? row.location,
      row.assignedUserId ? assigneeNames.get(row.assignedUserId) ?? "" : "",
      bookingPresentation[row.status].label,
      ...(openCents > 0 ? ["offen", "unbezahlt"] : []),
      ...(itemsByBooking.get(row.id) ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase("de-DE");
    const matchesSearch = !search || searchableText.includes(search);
    const matchesFrom = !datePeriod.from || row.periodTo >= datePeriod.from;
    const matchesTo = !datePeriod.to || row.periodFrom <= datePeriod.to;
    return matchesSearch && matchesFrom && matchesTo;
  });
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={session.user} isAdmin={administrator} variant="inset" />
      <SidebarInset>
        <SiteHeader title="Buchungen" />
        <main className="flex flex-1 flex-col gap-6 p-8 lg:p-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Buchungsübersicht</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Bearbeite Status, Fahrräder, Preise und Nachrichten direkt in der jeweiligen Buchung.
              </p>
            </div>
            <div className="flex gap-2">
              {administrator && (
                <Button nativeButton={false} variant="outline" render={<Link href="/admin/bookings/preflight" />}>
                  Mögliche Probleme
                  {preflight && !preflight.ok && (
                    <Badge className="ml-1" variant="destructive">
                      {preflight.unmapped.length + preflight.allocationConflicts.length}
                    </Badge>
                  )}
                </Button>
              )}
              <Button nativeButton={false} variant="outline" render={<Link href="/admin/bookings/new" />}>
                Manuelle Buchung
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <BookingStatusFilter
              canFilterLocations={administrator}
              location={location}
              value={status}
              search={params.q ?? ""}
              period={datePeriod.selected}
            />
            {rows.length ? (
              <ItemGroup className="gap-2">
                {rows.map((row) => {
                  const view = bookingPresentation[row.status];
                  const location =
                    rentalLocationLabels.de[row.location as keyof typeof rentalLocationLabels.de] ?? row.location;
                  const requestedBikes = itemsByBooking.get(row.id) ?? [];
                  return (
                    <Item
                      className="cursor-pointer hover:bg-muted/80"
                      key={row.id}
                      render={<Link href={`/admin/bookings/${row.id}`} />}
                      variant="muted"
                    >
                      <ItemMedia>
                        <div className="flex size-12 items-center justify-center rounded-lg border text-xs font-semibold">
                          {bookingShortId(row.orderNumber)}
                        </div>
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>
                          {row.customerName}
                          <span className="font-normal text-muted-foreground">{row.orderNumber}</span>
                        </ItemTitle>
                        <ItemDescription className="text-xs tracking-wider uppercase">
                          {location} · {requestedBikes.join(", ") || "Keine Fahrräder"} · {row.periodFrom} –{" "}
                          {row.periodTo}
                        </ItemDescription>
                      </ItemContent>
                      <div className="flex shrink-0 items-center gap-4">
                        <Badge variant={view.badge}>{view.label}</Badge>
                        <PaymentBadge openCents={openByBooking.get(row.id)} />
                        <BookingAssigneeBadge
                          assigneeName={row.assignedUserId ? assigneeNames.get(row.assignedUserId) ?? null : null}
                        />
                        <div className="flex min-w-20 flex-col items-end gap-0.5">
                          <span className="text-xs tracking-wider text-muted-foreground uppercase">Wert</span>
                          <span className="font-medium tabular-nums">{formatEuro(row.quotedTotalCents)}</span>
                        </div>
                      </div>
                    </Item>
                  );
                })}
              </ItemGroup>
            ) : (
              <p className="py-10 text-sm text-muted-foreground">Keine Buchungen vorhanden.</p>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
