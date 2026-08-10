import { AdminSettingsForm } from "@/components/admin-settings-form";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";

export default async function SettingsPage() {
  const session = await getServerSession();
  if (!session) return null;
  const user = getDatabase()
    .select({ whatsappPhone: authUser.whatsappPhone })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .get();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={session.user} isAdmin={isAdmin(session.user)} variant="inset" />
      <SidebarInset className="min-w-0 overflow-hidden">
        <SiteHeader title="Einstellungen" />
        <div className="admin-page-surface">
          <main className="flex flex-1 flex-col gap-6 p-8 lg:p-12">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">Persönliche Einstellungen</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Hinterlege deine Kontaktdaten für die Kommunikation im Team.
                </p>
              </div>
            </div>
            <AdminSettingsForm initialWhatsappPhone={user?.whatsappPhone ?? ""} />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
