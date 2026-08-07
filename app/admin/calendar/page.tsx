import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";

export default async function CalendarPage() {
  const session = await getServerSession();
  if (!session) redirect("/admin/login");

  const administrator = isAdmin(session.user);
  const assignedLocation = getAssignedLocation(session.user);
  if (session.user.mustChangePassword || !session.user.twoFactorEnabled || (!administrator && !assignedLocation)) {
    redirect("/admin");
  }
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
        <SiteHeader title="Kalender" />
        <main className="flex flex-1 flex-col" />
      </SidebarInset>
    </SidebarProvider>
  );
}
