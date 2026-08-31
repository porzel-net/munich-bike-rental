import { AdminTeamTable } from "@/components/admin-team-table";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { rentalLocationLabels } from "@/lib/inquiries/catalog";
import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team",
};

export default async function TeamPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");

  const users = getDatabase()
    .select({
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      role: authUser.role,
      locationKey: authUser.locationKey,
    })
    .from(authUser)
    .orderBy(asc(authUser.name))
    .all()
    .map((user) => ({ ...user, role: user.role as "admin" | "standortuser" }));

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
        <SiteHeader title="Team" />
        <div className="admin-page-surface">
          <main className="flex flex-1 flex-col p-8 lg:p-12">
            <AdminTeamTable users={users} currentUserId={session.user.id} locationLabels={rentalLocationLabels.de} />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
