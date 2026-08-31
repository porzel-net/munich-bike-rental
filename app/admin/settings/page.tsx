import { AdminSettingsForm } from "@/components/admin-settings-form";
import type { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSettingsPanel } from "@/components/global-settings-panel";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { financialAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Globe2, UserRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Einstellungen",
};

export default async function SettingsPage() {
  const session = await getServerSession();
  if (!session) return null;
  const user = getDatabase()
    .select({ whatsappPhone: authUser.whatsappPhone, privateAddress: authUser.privateAddress })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .get();
  const admin = isAdmin(session.user);
  const accounts = admin
    ? getDatabase()
        .select({
          id: financialAccounts.id,
          code: financialAccounts.code,
          name: financialAccounts.name,
          type: financialAccounts.type,
          status: financialAccounts.status,
          iban: financialAccounts.iban,
          currency: financialAccounts.currency,
          provider: financialAccounts.provider,
          notes: financialAccounts.notes,
        })
        .from(financialAccounts)
        .orderBy(financialAccounts.name)
        .all()
    : [];

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
            <Tabs defaultValue="personal" className="w-full gap-8">
              <TabsList variant="line" className="w-full justify-start gap-6 border-b px-0">
                <TabsTrigger value="personal" className="flex-none px-0 pb-3">
                  <UserRound /> Persönlich
                </TabsTrigger>
                {admin ? (
                  <TabsTrigger value="global" className="flex-none px-0 pb-3">
                    <Globe2 /> Global
                  </TabsTrigger>
                ) : null}
              </TabsList>
              <TabsContent value="personal" className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-semibold">Persönliche Einstellungen</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Hinterlege deine Kontaktdaten für die Kommunikation im Team.
                  </p>
                </div>
                <AdminSettingsForm
                  initialWhatsappPhone={user?.whatsappPhone ?? ""}
                  initialPrivateAddress={user?.privateAddress ?? ""}
                />
              </TabsContent>
              {admin ? (
                <TabsContent value="global" className="flex flex-col gap-6">
                  <div>
                    <h1 className="text-2xl font-semibold">Globale Einstellungen</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Diese Einstellungen gelten für die gesamte Buchhaltung und sind nur für Admins sichtbar.
                    </p>
                  </div>
                  <GlobalSettingsPanel initialAccounts={accounts} />
                </TabsContent>
              ) : null}
            </Tabs>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
