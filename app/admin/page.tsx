import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import type { CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { BookingAssigneeBadge } from "@/components/booking-assignee-badge";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { bookingPresentation } from "@/lib/bookings/presentation";
import { formatEuro } from "@/lib/bookings/money";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { authUser, bookings } from "@/lib/db/schema";
import { rentalLocationLabels } from "@/lib/inquiries/catalog";

export default async function AdminPage() {
  const session = await getServerSession();
  if (!session) return null;

  const administrator = isAdmin(session.user);
  const assignedLocation = getAssignedLocation(session.user);
  const db = getDatabase();
  const rows = administrator
    ? db.select().from(bookings).orderBy(desc(bookings.createdAt)).all()
    : db
        .select()
        .from(bookings)
        .where(eq(bookings.location, assignedLocation ?? ""))
        .orderBy(desc(bookings.createdAt))
        .all();
  const assigneeIds = rows.flatMap((row) => (row.assignedUserId ? [row.assignedUserId] : []));
  const assignees = assigneeIds.length
    ? db
        .select({ id: authUser.id, name: authUser.name })
        .from(authUser)
        .where(inArray(authUser.id, assigneeIds))
        .all()
    : [];
  const assigneeNames = new Map(assignees.map((assignee) => [assignee.id, assignee.name]));
  const activeRows = rows.filter((row) => !["completed", "rejected", "cancelled", "expired"].includes(row.status));
  const openRows = rows.filter((row) => ["inquiry_received", "offer_sent"].includes(row.status));
  const confirmedRows = rows.filter((row) => ["confirmed", "checked_out"].includes(row.status));
  const revenueCents = rows
    .filter((row) => !["rejected", "cancelled", "expired"].includes(row.status))
    .reduce((sum, row) => sum + row.quotedTotalCents, 0);
  const calls = openRows.filter((row) => row.customerPhone.trim()).slice(0, 6);
  const locationName = (location: string) =>
    rentalLocationLabels.de[location as keyof typeof rentalLocationLabels.de] ?? location;
  const formatDate = (value: number | Date) =>
    new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);

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
        <SiteHeader title="Dashboard" />
        <main className="flex flex-1 flex-col gap-6 p-8 lg:p-12">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {administrator
                ? "Der aktuelle Überblick über alle Standorte."
                : `Überblick für ${locationName(assignedLocation ?? "")}.`}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Aktive Buchungen</CardDescription>
                <CardTitle className="text-3xl">{activeRows.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Noch nicht abgeschlossen</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Offene Anfragen</CardDescription>
                <CardTitle className="text-3xl">{openRows.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Für Rückmeldung oder Angebot</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Bestätigt / unterwegs</CardDescription>
                <CardTitle className="text-3xl">{confirmedRows.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Bestätigte und ausgegebene Räder</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Buchungswert</CardDescription>
                <CardTitle className="text-3xl">{formatEuro(revenueCents)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Ohne stornierte Vorgänge</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Letzte Buchungen</CardTitle>
                  <CardDescription>Die zuletzt eingegangenen Vorgänge.</CardDescription>
                </div>
                <Button nativeButton={false} variant="outline" render={<Link href="/admin/bookings" />}>
                  Alle Buchungen
                </Button>
              </CardHeader>
              <CardContent className="grid gap-2">
                {rows.slice(0, 6).map((row) => (
                  <Link
                    key={row.id}
                    href={`/admin/bookings/${row.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.orderNumber} · {locationName(row.location)} · {row.periodFrom} – {row.periodTo}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge variant={bookingPresentation[row.status].badge}>
                        {bookingPresentation[row.status].label}
                      </Badge>
                      <BookingAssigneeBadge assigneeName={row.assignedUserId ? assigneeNames.get(row.assignedUserId) ?? null : null} />
                      <span className="hidden text-sm tabular-nums text-muted-foreground sm:inline">
                        {formatEuro(row.quotedTotalCents)}
                      </span>
                    </div>
                  </Link>
                ))}
                {!rows.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Noch keine Buchungen vorhanden.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Anrufe</CardTitle>
                  <CardDescription>Offene Buchungen mit Rückrufnummer.</CardDescription>
                </div>
                {administrator && (
                  <Button nativeButton={false} variant="outline" render={<Link href="/admin/team/calls" />}>
                    Alle Anrufe
                  </Button>
                )}
              </CardHeader>
              <CardContent className="grid gap-2">
                {calls.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.customerPhone} · {formatDate(row.createdAt)}
                      </p>
                    </div>
                    <Button nativeButton={false} size="sm" render={<a href={`tel:${row.customerPhone}`} />}>
                      Anrufen
                    </Button>
                  </div>
                ))}
                {!calls.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Keine offenen Rückrufe.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
