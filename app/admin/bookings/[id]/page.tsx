import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { BookingAssigneeBadge } from "@/components/booking-assignee-badge";
import { BookingAssigneeCard } from "@/components/booking-assignee-card";
import { BookingCommandActions } from "@/components/booking-command-actions";
import { BookingEditDialog } from "@/components/booking-edit-dialog";
import { BookingMailThreadSync } from "@/components/booking-mail-thread-sync";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { getAssignableBookingUsers } from "@/lib/bookings/assignees";
import { getBookingPaymentStatus } from "@/lib/bookings/service";
import { formatEuro } from "@/lib/bookings/money";
import { bookingPresentation, formatAccountLabel, paymentPresentation } from "@/lib/bookings/presentation";
import { getDatabase } from "@/lib/db/client";
import { getLocationInventory } from "@/lib/inventory/repository";
import { computerMountTypeLabels, pedalTypeLabels, rentalLocationLabels, type RentalLocation } from "@/lib/inquiries/catalog";
import {
  bookingEvents,
  bookingOfferItems,
  bookingOffers,
  bookingRequestedItems,
  bookings,
  authUser,
  journalEntries,
  journalLines,
  rentalAssets,
} from "@/lib/db/schema";
import type { BookingAssigneeUser } from "@/lib/bookings/assignees";

const offerStatusLabels = {
  sent: "versendet",
  accepted: "angenommen",
  expired: "abgelaufen",
  revoked: "widerrufen",
} as const;

const journalKindLabels: Record<string, string> = {
  rental_charge: "Mietpreis",
  cancellation_fee: "Stornogebühr",
  payment_received: "Zahlungseingang",
  refund_issued: "Erstattung",
  credit_note: "Gutschrift",
  expense: "Aufwand",
  correction: "Korrektur",
  legacy_import: "Übernommene Buchung",
};

const eventLabels: Record<string, string> = {
  booking_created: "Buchung erstellt",
  booking_directly_confirmed: "Buchung direkt bestätigt",
  offer_sent: "Angebot versendet",
  offer_revised: "Angebot angepasst",
  alternative_offer_sent: "Alternativangebot versendet",
  offer_confirmed: "Angebot bestätigt",
  booking_confirmed: "Buchung bestätigt",
  booking_cancelled: "Buchung storniert",
  booking_rejected: "Buchung abgelehnt",
  booking_checked_out: "Fahrrad ausgegeben",
  booking_completed: "Buchung abgeschlossen",
  offer_expired: "Angebot abgelaufen",
  booking_assignee_changed: "Sachbearbeiter geändert",
};

function eventLabel(eventType: string) {
  return eventLabels[eventType] ?? eventType.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const id = Number((await params).id);
  const db = getDatabase();
  const booking = Number.isInteger(id) ? db.select().from(bookings).where(eq(bookings.id, id)).get() : undefined;
  if (!session || !booking || (!isAdmin(session.user) && getAssignedLocation(session.user) !== booking.location))
    notFound();
  const assignee = booking.assignedUserId
    ? ((db
        .select({
          id: authUser.id,
          name: authUser.name,
          email: authUser.email,
          role: authUser.role,
          locationKey: authUser.locationKey,
        })
        .from(authUser)
        .where(eq(authUser.id, booking.assignedUserId))
        .get() as BookingAssigneeUser | undefined) ?? null)
    : null;
  const eligibleAssignees = isAdmin(session.user) ? getAssignableBookingUsers(db, booking.location as RentalLocation) : [];
  const canSelfAssign = !isAdmin(session.user) && assignee === null;

  const items = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, id)).all();
  const offers = db
    .select()
    .from(bookingOffers)
    .where(eq(bookingOffers.bookingId, id))
    .orderBy(desc(bookingOffers.offerNumber))
    .all();
  const events = db
    .select()
    .from(bookingEvents)
    .where(eq(bookingEvents.bookingId, id))
    .orderBy(desc(bookingEvents.occurredAt))
    .all();
  const actorIds = events.flatMap((event) => (event.actorUserId ? [event.actorUserId] : []));
  const actors = actorIds.length
    ? db
        .select({ id: authUser.id, name: authUser.name, email: authUser.email })
        .from(authUser)
        .where(inArray(authUser.id, actorIds))
        .all()
    : [];
  const actorNames = new Map(actors.map((actor) => [actor.id, actor.name || actor.email]));
  const entries = db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.bookingId, id))
    .orderBy(desc(journalEntries.occurredAt))
    .all();
  const lines = entries.length
    ? db
        .select()
        .from(journalLines)
        .where(
          inArray(
            journalLines.entryId,
            entries.map((entry) => entry.id),
          ),
        )
        .all()
    : [];
  const linesByEntry = new Map<number, typeof lines>();
  for (const line of lines) linesByEntry.set(line.entryId, [...(linesByEntry.get(line.entryId) ?? []), line]);
  const payment = getBookingPaymentStatus(db, booking.id);
  const paymentView = paymentPresentation(payment.status, payment.openCents);
  const statusView = bookingPresentation[booking.status];
  const commercialEditingAllowed = booking.status === "inquiry_received" || booking.status === "offer_sent";
  const locationLabel =
    rentalLocationLabels.de[booking.location as keyof typeof rentalLocationLabels.de] ?? booking.location;
  const availableAssets = db
    .select({ id: rentalAssets.id, label: rentalAssets.displayName, priceCents: rentalAssets.dailyPriceCents })
    .from(rentalAssets)
    .where(and(eq(rentalAssets.location, booking.location), eq(rentalAssets.state, "active")))
    .all();
  const requestedDailyPrices = new Map(
    getLocationInventory(db, booking.location).bikePrices.map((bike) => [bike.option, bike.dailyPriceCents]),
  );
  const latestOffer = offers[0];
  const offered = latestOffer
    ? db
        .select({ item: bookingOfferItems, asset: rentalAssets })
        .from(bookingOfferItems)
        .innerJoin(rentalAssets, eq(bookingOfferItems.assetId, rentalAssets.id))
        .where(eq(bookingOfferItems.offerId, latestOffer.id))
        .all()
    : [];

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} isAdmin={isAdmin(session.user)} variant="inset" />
      <SidebarInset>
        <SiteHeader title="Buchung bearbeiten" />
        <main className="flex flex-1 flex-col gap-6 p-8 lg:p-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/admin/bookings" />}>
                ← Buchungsübersicht
              </Button>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{booking.orderNumber}</h1>
                <Badge variant={statusView.badge}>{statusView.label}</Badge>
                <Badge variant={paymentView.badge}>{paymentView.label}</Badge>
                <BookingAssigneeBadge assigneeName={assignee?.name ?? null} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {locationLabel} · Kommunikation {booking.communicationLocale.toUpperCase()} · {booking.periodFrom}{" "}
                {booking.pickupTime} – {booking.periodTo} {booking.dropoffTime}
              </p>
            </div>
            {!["completed", "rejected", "cancelled", "expired"].includes(booking.status) ? (
              <BookingEditDialog
                bookingId={booking.id}
                expectedVersion={booking.version}
                customerName={booking.customerName}
                customerEmail={booking.customerEmail}
                customerPhone={booking.customerPhone}
                periodFrom={booking.periodFrom}
                periodTo={booking.periodTo}
                pickupTime={booking.pickupTime}
                dropoffTime={booking.dropoffTime}
                customerMessage={booking.customerMessage}
                communicationLocale={booking.communicationLocale}
                requestedItems={items}
                commercialEditingAllowed={commercialEditingAllowed}
              />
            ) : null}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Nächste Aktion</CardTitle>
              <CardDescription>
                Statuswechsel, Angebote und Finanzaktionen sind nachvollziehbar protokolliert.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <BookingAssigneeCard
                  bookingId={booking.id}
                  bookingLocationLabel={locationLabel}
                  assignee={assignee}
                  eligibleUsers={eligibleAssignees}
                  currentUserId={session.user.id}
                  isAdmin={isAdmin(session.user)}
                  canSelfAssign={canSelfAssign}
                />
                <BookingCommandActions
                  bookingId={booking.id}
                  status={booking.status}
                  customerName={booking.customerName}
                  senderName={session.user.name}
                  canExecuteActions={Boolean(assignee)}
                  requestedItems={items.map((item) => ({
                    id: item.id,
                    label: `${item.position}. ${item.requestedLabel} (${item.heightCm} cm)`,
                    requestedLabel: item.requestedLabel,
                    accessories: {
                      needsPedals: item.needsPedals,
                      pedalType: item.pedalType,
                      needsComputerMount: item.needsComputerMount,
                      computerMountType: item.computerMountType,
                      needsHelmet: item.needsHelmet,
                      needsClothing: item.needsClothing,
                    },
                  }))}
                  availableAssets={availableAssets}
                  journalEntries={entries.map((entry) => ({ id: entry.id, label: `${entry.kind}: ${entry.reason}` }))}
                />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="booking" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="booking" className="flex-1">
                Buchung & Angebot
              </TabsTrigger>
              <TabsTrigger value="finance" className="flex-1">
                Finanzen
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1">
                Ereignisse
              </TabsTrigger>
            </TabsList>
            <TabsContent value="booking" className="mt-4">
              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Kunde und Zeitraum</CardTitle>
                    <CardDescription>
                      {booking.customerName} · {booking.customerEmail} · {booking.customerPhone}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Abholung</p>
                        <p>
                          {booking.periodFrom} · {booking.pickupTime}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Rückgabe</p>
                        <p>
                          {booking.periodTo} · {booking.dropoffTime}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Nachricht</p>
                      <p className="mt-2 whitespace-pre-wrap leading-6">
                        {booking.customerMessage || "Keine Nachricht hinterlegt."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Anfrage und Angebot</CardTitle>
                    <CardDescription>
                      {latestOffer
                        ? `Angebotsversion ${latestOffer.offerNumber} · ${offerStatusLabels[latestOffer.status]}`
                        : "Noch kein konkretes Angebot versendet. Angefragte Katalogpreise werden angezeigt."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {items.map((item) => {
                      const match = offered.find(({ item: offeredItem }) => offeredItem.requestedItemId === item.id);
                      const requestedDailyPriceCents = requestedDailyPrices.get(item.requestedLabel);
                      const accessories = [
                        item.needsPedals
                          ? item.pedalType
                            ? (pedalTypeLabels.de[item.pedalType as keyof typeof pedalTypeLabels.de] ?? item.pedalType)
                            : "Pedale"
                          : null,
                        item.needsComputerMount
                          ? item.computerMountType
                            ? (computerMountTypeLabels.de[
                                item.computerMountType as keyof typeof computerMountTypeLabels.de
                              ] ?? item.computerMountType)
                            : "Computerhalterung"
                          : null,
                        item.needsHelmet ? "Helm" : null,
                        item.needsClothing ? "Kleidung" : null,
                      ].filter((value): value is string => Boolean(value));
                      const priceCents = match?.item.itemPriceCents ?? requestedDailyPriceCents;
                      const concreteBikeDiffers = match && match.asset.displayName !== item.requestedLabel;

                      return (
                        <div className="rounded-xl border p-4" key={item.id}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                Fahrrad {item.position}
                              </p>
                              <p className="mt-1 font-medium">{item.requestedLabel}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.heightCm} cm
                                {accessories.length ? ` · ${accessories.join(" · ")}` : " · Kein Zubehör"}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs text-muted-foreground">Preis/Tag</p>
                              <p className="mt-1 font-medium">
                                {priceCents !== undefined ? formatEuro(priceCents) : "—"}
                              </p>
                            </div>
                          </div>
                          {concreteBikeDiffers ? (
                            <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                              <span className="text-muted-foreground">Konkretes Fahrrad:</span>{" "}
                              {match.asset.displayName}
                            </p>
                          ) : null}
                          {!match && latestOffer ? (
                            <p className="mt-3 text-sm text-muted-foreground">Noch nicht zugeordnet.</p>
                          ) : null}
                        </div>
                      );
                    })}
                    {!latestOffer ? (
                      <p className="pt-2 text-sm text-muted-foreground">
                        Die Preise sind unverbindliche Katalogpreise. Zubehör, Rabatte und die konkrete Zuordnung werden
                        im Angebot festgelegt.
                      </p>
                    ) : null}
                    {latestOffer ? (
                      <div className="flex items-center justify-between border-t pt-4">
                        <span className="text-sm text-muted-foreground">Verbindlicher Angebotswert</span>
                        <span className="text-lg font-semibold">{formatEuro(latestOffer.totalCents)}</span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="finance" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Finanzjournal</CardTitle>
                  <CardDescription>Zahlungsstatus: {paymentView.label}</CardDescription>
                </CardHeader>
                <CardContent>
                  {entries.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Buchungsvorgang</TableHead>
                          <TableHead>Beschreibung</TableHead>
                          <TableHead>Buchungszeilen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.occurredAt.toLocaleString("de-DE")}</TableCell>
                            <TableCell>{journalKindLabels[entry.kind] ?? entry.kind}</TableCell>
                            <TableCell>
                              {entry.reason}
                              {entry.dueAt ? ` · fällig ${entry.dueAt.toLocaleDateString("de-DE")}` : ""}
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              {(linesByEntry.get(entry.id) ?? []).map((line) => (
                                <p key={line.id}>
                                  {formatAccountLabel(line.account)}: {formatEuro(line.amountCents)}
                                </p>
                              ))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Für diese Buchung wurden noch keine Finanzvorgänge erfasst.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Buchungsverlauf</CardTitle>
                  <CardDescription>Alle Änderungen werden mit Datum und Begründung dokumentiert.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {events.map((event) => (
                    <div className="grid gap-1 border-l-2 border-muted pl-4" key={event.id}>
                      <p className="font-medium">{eventLabel(event.eventType)}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.occurredAt.toLocaleString("de-DE")}
                        {` · Bearbeiter: ${event.actorUserId ? (actorNames.get(event.actorUserId) ?? "Unbekannt") : "System"}`}
                        {event.reason ? ` · ${event.reason}` : ""}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Mailverlauf</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingMailThreadSync bookingId={booking.id} />
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
