import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { AppSidebar } from "@/components/app-sidebar";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SalaryTaxRatesDialog } from "@/components/salary-tax-rates-dialog";
import { SalaryWidget } from "@/components/salary-widget";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { salaryTaxRates } from "@/lib/db/schema/accounting";
import { getEuerSummary } from "@/lib/financial/euer";
import { buildSalaryBreakdowns } from "@/lib/financial/salary-allocation";

export const metadata: Metadata = {
  title: "Gehälter",
};

const salaryYears = [2026];

export default async function SalariesPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");

  const db = getDatabase();
  const admins = db
    .select({ id: authUser.id, name: authUser.name })
    .from(authUser)
    .where(eq(authUser.role, "admin"))
    .orderBy(asc(authUser.name))
    .all();
  const configuredTaxRates = db
    .select({
      year: salaryTaxRates.year,
      tradeTaxBasisPoints: salaryTaxRates.tradeTaxBasisPoints,
      vatBasisPoints: salaryTaxRates.vatBasisPoints,
      incomeTaxBasisPoints: salaryTaxRates.incomeTaxBasisPoints,
    })
    .from(salaryTaxRates)
    .all();
  const salaryBreakdownsByYear = new Map(
    salaryYears.map((year) => {
      const incomeTaxBasisPoints = configuredTaxRates.find((rate) => rate.year === year)?.incomeTaxBasisPoints ?? null;
      return [year, buildSalaryBreakdowns(getEuerSummary(db, year), admins, incomeTaxBasisPoints)] as const;
    }),
  );

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
        <SiteHeader title="Gehälter" />
        <div className="admin-page-surface" style={{ background: "transparent" }}>
          <ScrollArea className="h-full min-h-0 w-full">
            <main className="admin-main relative z-10 flex flex-1 flex-col gap-6 p-4 sm:p-8 lg:p-12">
              <AdminPageHeader
                title="Gehälter"
                description="Übersicht und Verwaltung der Gehälter."
                actions={<SalaryTaxRatesDialog initialRates={configuredTaxRates} salaryYears={salaryYears} />}
              />
              <div className="relative flex min-w-0 w-full flex-col gap-6 bg-transparent p-2">
                <div className="relative z-10 grid w-full min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
                  {salaryYears.flatMap((year) =>
                    (salaryBreakdownsByYear.get(year) ?? []).map((breakdown) => (
                      <SalaryWidget key={`${breakdown.employeeId}-${year}`} breakdown={breakdown} year={year} />
                    )),
                  )}
                </div>
              </div>
            </main>
          </ScrollArea>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
