import { Badge } from "@/components/ui/badge";
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

export function BookingPreflightDetails({ result }: { result: BookingMigrationPreflight }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-medium">Fehlende Fahrräder bei Buchungen</h2>
        {result.unmapped.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {result.unmapped.map((booking) => (
              <li className="rounded-2xl border border-red-600/30 bg-red-600/5 p-3 dark:bg-red-600/10" key={booking.id}>
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
    </div>
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
