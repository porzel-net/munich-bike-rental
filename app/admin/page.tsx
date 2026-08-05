import { and, desc, eq, inArray } from "drizzle-orm";
import type { CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  AdminDashboardOverview,
  type AdminActivityPoint,
  type AdminBankAccount,
} from "@/components/admin-dashboard-overview";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { financialAccounts, financialTransactions } from "@/lib/db/schema";
import { rentalLocationLabels } from "@/lib/inquiries/catalog";

export default async function AdminPage() {
  const session = await getServerSession();
  if (!session) return null;

  const administrator = isAdmin(session.user);
  const assignedLocation = getAssignedLocation(session.user);
  const db = getDatabase();
  const bankAccounts = administrator
    ? db
        .select({
          id: financialAccounts.id,
          name: financialAccounts.name,
          currency: financialAccounts.currency,
          openingBalanceCents: financialAccounts.openingBalanceCents,
          providerBalanceCents: financialAccounts.providerBalanceCents,
          providerBalanceAt: financialAccounts.providerBalanceAt,
        })
        .from(financialAccounts)
        .where(and(eq(financialAccounts.type, "bank"), eq(financialAccounts.status, "active")))
        .orderBy(financialAccounts.name)
        .all()
    : [];
  const bankAccountIds = bankAccounts.map((account) => account.id);
  const bankTransactions = bankAccountIds.length
    ? db
        .select({
          financialAccountId: financialTransactions.financialAccountId,
          amountCents: financialTransactions.amountCents,
          bookedAt: financialTransactions.bookedAt,
        })
        .from(financialTransactions)
        .where(inArray(financialTransactions.financialAccountId, bankAccountIds))
        .orderBy(desc(financialTransactions.bookedAt))
        .all()
    : [];
  const movementsByAccount = new Map<number, number>();
  for (const transaction of bankTransactions) {
    movementsByAccount.set(
      transaction.financialAccountId,
      (movementsByAccount.get(transaction.financialAccountId) ?? 0) + transaction.amountCents,
    );
  }
  const accountCards: AdminBankAccount[] = bankAccounts.map((account) => ({
    id: account.id,
    name: account.name,
    currency: account.currency,
    balanceCents:
      account.providerBalanceCents ?? account.openingBalanceCents + (movementsByAccount.get(account.id) ?? 0),
    providerBalanceAt: account.providerBalanceAt,
    balanceSource: account.providerBalanceCents === null ? "calculated" : "provider",
  }));

  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric" }).format(new Date()),
  );
  const monthLabels = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const monthlyActivity = Array.from({ length: 12 }, (_, monthIndex) => ({
    month: monthLabels[monthIndex],
    amount: 0,
  }));
  for (const transaction of bankTransactions) {
    if (transaction.amountCents <= 0 || transaction.bookedAt.slice(0, 4) !== String(currentYear)) continue;
    const monthIndex = Number(transaction.bookedAt.slice(5, 7)) - 1;
    if (monthIndex >= 0 && monthIndex < monthlyActivity.length) {
      monthlyActivity[monthIndex].amount += transaction.amountCents / 100;
    }
  }
  const activityData: AdminActivityPoint[] = monthlyActivity;
  const providerBalanceDates = bankAccounts
    .map((account) => account.providerBalanceAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));
  const latestBankSync = providerBalanceDates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const latestBankSyncLabel = latestBankSync
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(
        latestBankSync,
      )
    : null;
  const currentMonthDate = new Date();
  const monthParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(currentMonthDate)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const currentMonthKey = `${monthParts.year}-${monthParts.month}`;
  const currentMonthLabel = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    month: "long",
    year: "numeric",
  }).format(currentMonthDate);
  const locationName = (location: string) =>
    rentalLocationLabels.de[location as keyof typeof rentalLocationLabels.de] ?? location;

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
        <SiteHeader title="Dashboard" />
        <main className="flex flex-1 flex-col gap-6 p-8 lg:p-12">
          <div>
            <h1 className="text-2xl font-semibold">Finanz-Dashboard</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {administrator
                ? "Bankkonten und Einnahmenziele im Überblick."
                : `Finanzübersicht für ${locationName(assignedLocation ?? "diesen Standort")}.`}
            </p>
          </div>
          <div className="w-full max-w-xl">
            <AdminDashboardOverview
              bankAccounts={accountCards}
              activityData={activityData}
              currentMonthKey={currentMonthKey}
              currentMonthLabel={currentMonthLabel}
              latestBankSyncLabel={latestBankSyncLabel}
            />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
