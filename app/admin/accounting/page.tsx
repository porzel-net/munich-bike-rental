import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { EuerSummary } from "@/components/euer-summary";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { getEuerSummary } from "@/lib/financial/euer";
import { syncStripeCheckoutPayments, type StripeSyncResult } from "@/lib/financial/stripe-sync";

export default async function AccountingPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");

  const db = getDatabase();
  let stripeSync: StripeSyncResult | null = null;
  let stripeSyncError: string | null = null;
  try {
    stripeSync = await syncStripeCheckoutPayments(db);
  } catch (error) {
    stripeSyncError = error instanceof Error ? error.message : "Stripe konnte nicht synchronisiert werden.";
  }
  const stripeSyncFinishedAt = new Date();
  const euer = getEuerSummary(db, new Date().getFullYear());
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
      <SidebarInset>
        <SiteHeader title={`EÜR ${euer.year}`} />
        <main className="flex flex-1 flex-col p-8 lg:p-12">
          <div className="mb-2 flex justify-end">
            <span
              className={
                stripeSyncError ? "text-xs text-amber-700 dark:text-amber-400" : "text-xs text-muted-foreground"
              }
              title={stripeSyncError ?? undefined}
            >
              {stripeSyncError
                ? `Stripe-Sync fehlgeschlagen · ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(stripeSyncFinishedAt)}`
                : `Stripe · zuletzt ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(stripeSyncFinishedAt)} · ${stripeSync?.imported ?? 0} neu`}
            </span>
          </div>
          <EuerSummary data={euer} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
