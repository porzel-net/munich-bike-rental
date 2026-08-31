import type { CSSProperties } from "react";
import type { Metadata } from "next";

import { AppSidebar } from "@/components/app-sidebar";
import { AdminContactsPage, type CarddavAccountState } from "@/components/admin-contacts-page";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession } from "@/lib/auth/session";
import { getCarddavPublicUrl } from "@/lib/carddav/config";
import { getDatabase } from "@/lib/db/client";
import { carddavAccounts } from "@/lib/db/schema";
import { getVisibleContacts } from "@/lib/contacts/service";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Kontakte",
};

export default async function ContactsPage() {
  const session = await getServerSession();
  if (!session) return null;

  const db = getDatabase();
  const contacts = getVisibleContacts(db, session.user).map((contact) => ({
    ...contact,
    latestUpdatedAt: contact.latestUpdatedAt.toISOString(),
    bookings: contact.bookings.map((booking) => ({ ...booking, updatedAt: booking.updatedAt.toISOString() })),
  }));
  const account = db
    .select({
      username: carddavAccounts.username,
      enabled: carddavAccounts.enabled,
      createdAt: carddavAccounts.createdAt,
      updatedAt: carddavAccounts.updatedAt,
      lastSyncedAt: carddavAccounts.lastSyncedAt,
      lastSyncError: carddavAccounts.lastSyncError,
    })
    .from(carddavAccounts)
    .where(eq(carddavAccounts.userId, session.user.id))
    .get();
  const carddav: CarddavAccountState = {
    server: getCarddavPublicUrl(),
    account: account
      ? {
          ...account,
          createdAt: account.createdAt.toISOString(),
          updatedAt: account.updatedAt.toISOString(),
          lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
        }
      : null,
  };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar user={session.user} isAdmin={session.user.role === "admin"} variant="inset" />
      <SidebarInset className="min-w-0 overflow-hidden">
        <SiteHeader title="Kontakte" />
        <div className="admin-page-surface">
          <main className="flex flex-1 flex-col p-8 lg:p-12">
            <AdminContactsPage contacts={contacts} carddav={carddav} />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
