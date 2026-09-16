import { AppSidebar } from "@/components/app-sidebar";
import { AdminPageHeader } from "@/components/admin-page-header";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppSettingsPanel } from "@/components/whatsapp-settings-panel";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "WhatsApp-Einstellungen",
};

export default async function WhatsAppSettingsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin/settings");

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={session.user} isAdmin variant="inset" />
      <SidebarInset className="min-w-0 overflow-hidden">
        <SiteHeader title="WhatsApp" />
        <div className="admin-page-surface">
          <main className="admin-main flex flex-1 flex-col gap-6 p-4 sm:p-8 lg:p-12">
            <AdminPageHeader
              title="WhatsApp"
              description="Verbinde das gemeinsame WhatsApp-Konto für die Kommunikation im Team."
            />
            <WhatsAppSettingsPanel />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
