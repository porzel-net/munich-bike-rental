import Link from "next/link";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getBookingMigrationPreflight } from "@/lib/bookings/preflight";
import { getDatabase } from "@/lib/db/client";

export default async function BookingPreflightPage() {
  const session = await getServerSession();
  if (!session || !isAdmin(session.user)) redirect("/admin/bookings");
  const result = getBookingMigrationPreflight(getDatabase());
  return (
    <SidebarProvider>
      <AppSidebar user={session.user} isAdmin variant="inset" />
      <SidebarInset>
        <SiteHeader title="Mögliche Probleme" />
        <main className="flex flex-1 flex-col gap-6 p-8 lg:p-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Mögliche Probleme</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Hier siehst du, ob deine Buchungen vollständig vorbereitet sind und sich keine Fahrräder überschneiden.
              </p>
            </div>
            <Button nativeButton={false} variant="outline" render={<Link href="/admin/bookings" />}>
              Zur Übersicht
            </Button>
          </div>
          <Card className={result.ok ? "border-green-600/40" : "border-red-600/40"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Prüfstatus{" "}
                <Badge
                  className={
                    result.ok
                      ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
                      : "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400"
                  }
                >
                  {result.ok ? "Alles in Ordnung" : "Probleme gefunden"}
                </Badge>
              </CardTitle>
              <CardDescription>
                {result.ok
                  ? "Alle geprüften Buchungen können ohne weitere Korrektur verwendet werden."
                  : "Bitte prüfe die unten aufgeführten Buchungen, bevor du fortfährst."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section>
                <h2 className="font-medium">Fehlende Fahrräder bei Buchungen</h2>
                {result.unmapped.length ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    {result.unmapped.map((booking) => (
                      <li
                        className="rounded-2xl border border-red-600/30 bg-red-600/5 p-3 dark:bg-red-600/10"
                        key={booking.id}
                      >
                        <strong>{booking.orderNumber}</strong> · {booking.location} · {booking.status}
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
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
