import type { CSSProperties } from "react";
import type { Metadata } from "next";

import { AppSidebar } from "@/components/app-sidebar";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Anrufe",
};

export default async function TeamCallsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");

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
        <SiteHeader title="Anrufe" />
        <div className="admin-page-surface">
          <main className="admin-main flex flex-1 flex-col gap-6 p-4 sm:p-8 lg:p-12">
            <AdminPageHeader title="Anrufe" description="Verwalte Rückrufe und offene Telefonnotizen im Team." />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
