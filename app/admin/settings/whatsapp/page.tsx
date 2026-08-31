import { AppSidebar } from "@/components/app-sidebar";
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
          <main className="flex flex-1 items-center justify-center p-6 lg:p-12">
            <WhatsAppSettingsPanel />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
