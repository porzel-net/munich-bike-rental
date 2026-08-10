import type { CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { redirect } from "next/navigation";

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
      <SidebarInset>
        <SiteHeader title="Anrufe" />
        <main className="flex flex-1 flex-col p-8 lg:p-12" />
      </SidebarInset>
    </SidebarProvider>
  );
}
