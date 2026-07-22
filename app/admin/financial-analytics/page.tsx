import { AppSidebar } from "@/components/app-sidebar";
import { FinancialAnalyticsDashboard } from "@/components/financial-analytics-dashboard";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getDatabase } from "@/lib/db/client";
import { getFinancialAnalyticsData } from "@/lib/financial-analytics";
import { getServerSession, isAdmin } from "../../../lib/auth/session";
import { redirect } from "next/navigation";

export default async function FinancialAnalyticsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");
  const analyticsData = getFinancialAnalyticsData(getDatabase());

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
        <SiteHeader title="Finanz Analysen" />
        <FinancialAnalyticsDashboard data={analyticsData} />
      </SidebarInset>
    </SidebarProvider>
  );
}
