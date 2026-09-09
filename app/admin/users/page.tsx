import { AdminDashboard } from "../../../components/admin-dashboard";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { isAdmin, getServerSession } from "../../../lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Benutzerverwaltung",
};

export default async function AdminUsersPage() {
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
        <SiteHeader title="Benutzerverwaltung" />
        <div className="admin-page-surface">
          <AdminDashboard userName={session.user.name} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
