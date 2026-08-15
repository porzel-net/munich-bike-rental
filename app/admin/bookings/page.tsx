import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { BookingAssigneeBadge } from "@/components/booking-assignee-badge";
import { BookingAiBatchAnalysisButton } from "@/components/booking-ai-batch-analysis-button";
import { LegacyBookingImportButton } from "@/components/legacy-booking-import-button";
import { BookingPreflightDialog } from "@/components/booking-preflight-dialog";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { hasAssetConflict } from "@/lib/bookings/availability";
import { bikeMatchesRequestedLabel } from "@/lib/inventory/display-name";
import { getDatabase } from "@/lib/db/client";
import {
  bikeModels,
  bikeVariants,
  bookingRequestedItems,
  bookings,
  emailActionReviews,
  journalEntries,
  journalLines,
  rentalAssets,
} from "@/lib/db/schema";
import { bookingPresentation } from "@/lib/bookings/presentation";
import { formatEuro } from "@/lib/bookings/money";
import { getBookingMigrationPreflight } from "@/lib/bookings/preflight";
import { BookingStatusFilter } from "@/components/booking-status-filter";
import type { BookingStatus } from "@/lib/db/schema";
import { rentalLocationLabels, rentalLocations, type RentalLocation } from "@/lib/inquiries/catalog";
import { EMAIL_ACTION_START_AT } from "@/lib/inquiries/email-action";
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
  if (openCents === undefined) return null;
  if (openCents === 0) {
    return <Badge variant="success">Ausgeglichen</Badge>;
  }
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
  searchParams: Promise<{ status?: string; q?: string; period?: string; location?: string; assignee?: string }>;
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
  const availableAssignees = db
    .select({ id: authUser.id, name: authUser.name })
    .from(authUser)
    .where(
      administrator
        ? undefined
        : or(
            eq(authUser.role, "admin"),
            and(eq(authUser.role, "standortuser"), eq(authUser.locationKey, assignedLocation as RentalLocation)),
          ),
    )
    .orderBy(asc(authUser.name))
    .all();
  const requestedAssignee = params.assignee;
  const assignee =
    requestedAssignee === "unassigned"
      ? "unassigned"
      : requestedAssignee && availableAssignees.some((user) => user.id === requestedAssignee)
        ? requestedAssignee
        : "all";
  const search = params.q?.trim().toLocaleLowerCase("de-DE") ?? "";
  const datePeriod = getBookingPeriod(params.period);
  const preflight = administrator ? getBookingMigrationPreflight(db) : null;
  const bookingConditions = [
    location === "all" ? null : eq(bookings.location, location),
    status ? eq(bookings.status, status) : null,
    datePeriod.from ? gte(bookings.periodTo, datePeriod.from) : null,
    datePeriod.to ? lte(bookings.periodFrom, datePeriod.to) : null,
    assignee === "unassigned"
      ? isNull(bookings.assignedUserId)
      : assignee !== "all"
        ? eq(bookings.assignedUserId, assignee)
        : null,
  ].filter((condition): condition is NonNullable<typeof condition> => condition !== null);
  const queriedRows = bookingConditions.length
    ? db
        .select()
        .from(bookings)
        .where(and(...bookingConditions))
        .orderBy(desc(bookings.orderNumber))
        .all()
    : db.select().from(bookings).orderBy(desc(bookings.orderNumber)).all();
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
  const activeAssets = db
    .select({
      id: rentalAssets.id,
      location: rentalAssets.location,
      displayName: rentalAssets.displayName,
      modelTitle: bikeModels.title,
      size: bikeVariants.size,
    })
    .from(rentalAssets)
    .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
    .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
    .where(eq(rentalAssets.state, "active"))
    .all();
  const activeAssetsByLocation = new Map<string, typeof activeAssets>();
  for (const asset of activeAssets)
    activeAssetsByLocation.set(asset.location, [...(activeAssetsByLocation.get(asset.location) ?? []), asset]);
  const itemsByBooking = new Map<number, string[]>();
  const requestedItemsByBooking = new Map<number, typeof items>();
  for (const item of items)
    itemsByBooking.set(item.bookingId, [...(itemsByBooking.get(item.bookingId) ?? []), item.requestedLabel]);
  for (const item of items)
    requestedItemsByBooking.set(item.bookingId, [...(requestedItemsByBooking.get(item.bookingId) ?? []), item]);
  const assigneeIds = queriedRows.flatMap((row) => (row.assignedUserId ? [row.assignedUserId] : []));
  const assignees = assigneeIds.length
    ? db.select({ id: authUser.id, name: authUser.name }).from(authUser).where(inArray(authUser.id, assigneeIds)).all()
    : [];
  const assigneeNames = new Map(assignees.map((assignee) => [assignee.id, assignee.name]));
  const actionReviews = queriedRows.length
    ? db
        .select()
        .from(emailActionReviews)
        .where(
          inArray(
            emailActionReviews.bookingId,
            queriedRows.map((row) => row.id),
          ),
        )
        .orderBy(desc(emailActionReviews.createdAt), desc(emailActionReviews.id))
        .all()
    : [];
  const latestActionReviewByBooking = new Map<number, (typeof actionReviews)[number]>();
  for (const review of actionReviews) {
    if (!latestActionReviewByBooking.has(review.bookingId)) latestActionReviewByBooking.set(review.bookingId, review);
  }
  const hasPendingEmailAction = (row: (typeof queriedRows)[number]) => {
    const latestActionReview = latestActionReviewByBooking.get(row.id);
    return (
      latestActionReview?.status === "needs_action" ||
      latestActionReview?.status === "error" ||
      (!latestActionReview &&
        row.status === "inquiry_received" &&
        row.createdAt.getTime() >= EMAIL_ACTION_START_AT.getTime())
    );
  };
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
  const rows = queriedRows
    .filter((row) => {
      const openCents = openByBooking.get(row.id) ?? 0;
      const searchableText = [
        row.customerName,
        row.orderNumber,
        row.customerEmail,
        row.customerPhone,
        rentalLocationLabels.de[row.location as keyof typeof rentalLocationLabels.de] ?? row.location,
        row.assignedUserId ? (assigneeNames.get(row.assignedUserId) ?? "") : "",
        bookingPresentation[row.status].label,
        ...(openCents > 0 ? ["offen", "unbezahlt"] : []),
        ...(itemsByBooking.get(row.id) ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase("de-DE");
      const matchesSearch = !search || searchableText.includes(search);
      return matchesSearch;
    })
    .sort(
      (left, right) =>
        Number(hasPendingEmailAction(right)) - Number(hasPendingEmailAction(left)) ||
        right.createdAt.getTime() - left.createdAt.getTime() ||
        right.id - left.id,
    );
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
      <SidebarInset className="min-w-0 overflow-hidden">
        <SiteHeader title="Buchungen" />
        <div className="relative isolate min-h-0 min-w-0 flex-1 overflow-hidden bg-muted dark:bg-background">
          <ScrollArea className="h-full min-h-0 w-full">
            <main className="relative z-10 flex flex-1 flex-col gap-6 p-8 lg:p-12">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold">Buchungsübersicht</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Bearbeite Status, Fahrräder, Preise und Nachrichten direkt in der jeweiligen Buchung.
                  </p>
                </div>
                <div className="flex gap-2">
                  {administrator && <BookingAiBatchAnalysisButton />}
                  {administrator && <LegacyBookingImportButton />}
                  {administrator && preflight && <BookingPreflightDialog result={preflight} />}
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
                  assignee={assignee}
                  assignees={availableAssignees}
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
                      const requestedItems = requestedItemsByBooking.get(row.id) ?? [];
                      const requestedQuantities = new Map<string, number>();
                      for (const item of requestedItems)
                        requestedQuantities.set(
                          item.requestedLabel,
                          (requestedQuantities.get(item.requestedLabel) ?? 0) + 1,
                        );
                      const likelyUnavailable =
                        row.status === "inquiry_received" &&
                        [...requestedQuantities].some(([requestedLabel, quantity]) => {
                          const assets = (activeAssetsByLocation.get(row.location) ?? []).filter((asset) =>
                            bikeMatchesRequestedLabel(asset, requestedLabel),
                          );
                          const availableQuantity = assets.filter(
                            (asset) => !hasAssetConflict(db, row, asset.id),
                          ).length;
                          return availableQuantity < quantity;
                        });
                      const rowHasPendingEmailAction = hasPendingEmailAction(row);
                      return (
                        <Item
                          className="transform-gpu bg-card cursor-pointer transition-[transform,background-color,box-shadow] duration-500 ease-out hover:-translate-y-0.5 hover:scale-[1.002] hover:!bg-card hover:shadow-md"
                          key={row.id}
                          render={<Link href={`/admin/bookings/${row.id}`} />}
                          variant="default"
                        >
                          <ItemMedia>
                            <div className="relative flex size-12 items-center justify-center rounded-lg border text-xs font-semibold">
                              {rowHasPendingEmailAction ? (
                                <span
                                  aria-label="Offene Kundenfrage"
                                  className="absolute -top-1 -left-1 size-3 rounded-full bg-red-500 ring-2 ring-background"
                                />
                              ) : null}
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
                            {likelyUnavailable && (
                              <Badge
                                variant="outline"
                                className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                              >
                                Wahrscheinlich nicht annehmbar
                              </Badge>
                            )}
                            <PaymentBadge openCents={openByBooking.get(row.id)} />
                            <BookingAssigneeBadge
                              assigneeName={row.assignedUserId ? (assigneeNames.get(row.assignedUserId) ?? null) : null}
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
          </ScrollArea>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-1 h-48 bg-linear-to-b from-background via-muted to-transparent dark:hidden" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-48 bg-linear-to-t from-background via-muted/80 to-transparent dark:via-background/80" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
