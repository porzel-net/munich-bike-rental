import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { redirect } from "next/navigation";

type AdminPlaceholderPageProps = {
  title: string;
  description?: string;
  adminOnly?: boolean;
};

export async function AdminPlaceholderPage({ title, description, adminOnly = false }: AdminPlaceholderPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (adminOnly && !isAdmin(session.user)) redirect("/admin");

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
      <SidebarInset>
        <SiteHeader title={title} />
        <main className="flex flex-1 flex-col p-8 lg:p-12">
          <Card className="min-h-64 flex-1">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description ?? "Diese Seite wird vorbereitet."}</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
