import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { AdminPageHeader } from "@/components/admin-page-header";
import { BookingPreflightDetails, BookingPreflightStatusBadge } from "@/components/booking-preflight-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getBookingMigrationPreflight } from "@/lib/bookings/preflight";
import { getDatabase } from "@/lib/db/client";

export const metadata: Metadata = {
  title: "Buchungen prüfen",
};

export default async function BookingPreflightPage() {
  const session = await getServerSession();
  if (!session || !isAdmin(session.user)) redirect("/admin/bookings");
  const result = getBookingMigrationPreflight(getDatabase());
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar user={session.user} isAdmin variant="inset" />
      <SidebarInset className="min-w-0 overflow-hidden">
        <SiteHeader title="Mögliche Probleme" />
        <div className="admin-page-surface">
          <main className="flex flex-1 flex-col gap-6 p-8 lg:p-12">
            <AdminPageHeader
              title="Mögliche Probleme"
              description="Hier siehst du, ob deine Buchungen vollständig vorbereitet sind und sich keine Fahrräder überschneiden."
              actions={
                <Button nativeButton={false} variant="outline" render={<Link href="/admin/bookings" />}>
                  Zur Übersicht
                </Button>
              }
            />
            <Card className={result.ok ? "border-green-600/40" : "border-red-600/40"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Prüfstatus <BookingPreflightStatusBadge result={result} />
                </CardTitle>
                <CardDescription>
                  {result.ok
                    ? "Alle geprüften Buchungen können ohne weitere Korrektur verwendet werden."
                    : "Bitte prüfe die unten aufgeführten Buchungen, bevor du fortfährst."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BookingPreflightDetails result={result} />
              </CardContent>
            </Card>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
