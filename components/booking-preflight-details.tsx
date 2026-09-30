import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bookingPresentation } from "@/lib/bookings/presentation";
import type { BookingMigrationPreflight } from "@/lib/bookings/preflight";
import type { BookingStatus } from "@/lib/db/schema";
import { rentalLocationLabels, type RentalLocation } from "@/lib/inquiries/catalog";

function locationLabel(location: string) {
  return rentalLocationLabels.de[location as RentalLocation] ?? location;
}

function statusLabel(status: string) {
  return bookingPresentation[status as BookingStatus]?.label ?? status;
}

function formatAmount(amountCents: number | null, currency: string) {
  if (amountCents === null) return "Betrag unbekannt";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amountCents / 100);
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}

export function BookingPreflightDetails({ result }: { result: BookingMigrationPreflight }) {
  return (
    <Tabs defaultValue="missing-assets" className="w-full gap-4">
      <TabsList variant="line" className="h-auto w-full justify-start gap-4 overflow-x-auto border-b px-0">
        <TabsTrigger value="missing-assets" className="flex-none px-0 pb-3">
          Fehlende Fahrräder
          {result.unmapped.length ? <Badge variant="destructive">{result.unmapped.length}</Badge> : null}
        </TabsTrigger>
        <TabsTrigger value="allocation-conflicts" className="flex-none px-0 pb-3">
          Doppelte Fahrradbelegung
          {result.allocationConflicts.length ? (
            <Badge variant="destructive">{result.allocationConflicts.length}</Badge>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="unassigned-stripe-payments" className="flex-none px-0 pb-3">
          Nicht zugeordnete Stripe-Zahlungen
          {result.unassignedStripePayments.length ? (
            <Badge variant="destructive">{result.unassignedStripePayments.length}</Badge>
          ) : null}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="missing-assets">
        <section>
          <h2 className="font-medium">Fehlende Fahrräder bei Buchungen</h2>
          {result.unmapped.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {result.unmapped.map((booking) => (
                <li
                  className="rounded-2xl border border-red-600/30 bg-red-600/5 p-3 dark:bg-red-600/10"
                  key={booking.id}
                >
                  <strong>{booking.orderNumber}</strong> · {locationLabel(booking.location)} ·{" "}
                  {statusLabel(booking.status)}
                  <br />
                  <span className="text-muted-foreground">
                    {booking.allocatedAssets} von {booking.requestedItems} Fahrrädern zugeordnet
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-xl bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Jede Buchung hat alle benötigten Fahrräder zugeordnet.
            </p>
          )}
        </section>
      </TabsContent>
      <TabsContent value="allocation-conflicts">
        <section>
          <h2 className="font-medium">Doppelte Fahrradbelegung</h2>
          {result.allocationConflicts.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {result.allocationConflicts.map((conflict) => (
                <li
                  className="rounded-2xl border border-red-600/30 bg-red-600/5 p-3 dark:bg-red-600/10"
                  key={`${conflict.assetId}-${conflict.firstBookingId}-${conflict.secondBookingId}`}
                >
                  Fahrrad {conflict.assetId}: Buchung {conflict.firstBookingId} überschneidet sich mit Buchung{" "}
                  {conflict.secondBookingId}.
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-xl bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Keine Fahrräder sind gleichzeitig doppelt eingeplant.
            </p>
          )}
        </section>
      </TabsContent>
      <TabsContent value="unassigned-stripe-payments">
        <section>
          <h2 className="font-medium">Nicht zugeordnete Stripe-Zahlungen</h2>
          {result.unassignedStripePayments.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {result.unassignedStripePayments.map((payment) => (
                <li
                  className="rounded-2xl border border-red-600/30 bg-red-600/5 p-3 dark:bg-red-600/10"
                  key={payment.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <strong>{formatAmount(payment.amountCents, payment.currency)}</strong>
                    <span className="text-muted-foreground">Bezahlt am {formatDate(payment.occurredAt)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">Kunde: {payment.customerEmail?.trim() || "Unbekannt"}</p>
                  <p className="mt-1 break-all text-muted-foreground">Stripe-Session: {payment.stripeSessionId}</p>
                  {payment.stripePaymentIntentId ? (
                    <p className="mt-1 break-all text-muted-foreground">
                      Payment Intent: {payment.stripePaymentIntentId}
                    </p>
                  ) : null}
                  <p className="mt-2">Hinweis: {payment.reason}</p>
                  <Link
                    className="mt-2 inline-block text-primary underline underline-offset-4"
                    href="/admin/accounting"
                  >
                    In der Buchhaltung prüfen
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-xl bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Alle erkannten Stripe-Zahlungen sind einer bestätigten Buchung zugeordnet.
            </p>
          )}
        </section>
      </TabsContent>
    </Tabs>
  );
}

export function BookingPreflightStatusBadge({ result }: { result: BookingMigrationPreflight }) {
  return (
    <Badge
      className={
        result.ok
          ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
          : "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400"
      }
    >
      {result.ok ? "Alles in Ordnung" : "Probleme gefunden"}
    </Badge>
  );
}
