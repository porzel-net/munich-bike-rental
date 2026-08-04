import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";

import { AccountingJournalTable, type JournalEntry } from "@/components/accounting-journal-table";
import { AppSidebar } from "@/components/app-sidebar";
import { NevloSyncButton } from "@/components/nevlo-sync-button";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { bookings, journalEntries, journalLines } from "@/lib/db/schema";

function displayAmount(kind: string, lines: Array<{ account: string; amountCents: number }>) {
  const line = (account: string) => lines.find((item) => item.account === account)?.amountCents;
  const bank = line("bank_or_cash");
  const receivable = line("accounts_receivable");
  const expense = line("expense");
  const rentalRevenue = line("rental_revenue");

  if (kind === "expense") return -Math.abs(expense ?? bank ?? 0);
  if (kind === "payment_received") return bank ?? -(receivable ?? 0);
  if (kind === "refund_issued") return -Math.abs(bank ?? receivable ?? 0);
  if (kind === "rental_charge" || kind === "cancellation_fee") return Math.abs(rentalRevenue ?? receivable ?? 0);
  if (kind === "credit_note") return -Math.abs(rentalRevenue ?? receivable ?? 0);
  if (kind === "legacy_import") {
    if (expense !== undefined) return -Math.abs(expense);
    if (rentalRevenue !== undefined) return Math.abs(rentalRevenue);
    return bank ?? 0;
  }
  if (kind === "correction") return bank ?? 0;
  return bank ?? rentalRevenue ?? 0;
}

function displayType(
  kind: string,
  lines: Array<{ account: string; amountCents: number }>,
): JournalEntry["displayType"] {
  const amountCents = displayAmount(kind, lines);
  if (amountCents > 0) return "revenue";
  if (amountCents < 0) return "expense";
  return "other";
}

export default async function AccountingPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");

  const db = getDatabase();
  const rows = db
    .select({
      id: journalEntries.id,
      bookingId: journalEntries.bookingId,
      orderNumber: bookings.orderNumber,
      customerName: bookings.customerName,
      kind: journalEntries.kind,
      reason: journalEntries.reason,
      reversesEntryId: journalEntries.reversesEntryId,
      dueAt: journalEntries.dueAt,
      occurredAt: journalEntries.occurredAt,
      createdAt: journalEntries.createdAt,
    })
    .from(journalEntries)
    .leftJoin(bookings, eq(journalEntries.bookingId, bookings.id))
    .orderBy(desc(journalEntries.occurredAt))
    .all();
  const lines = rows.length
    ? db
        .select()
        .from(journalLines)
        .where(
          inArray(
            journalLines.entryId,
            rows.map((row) => row.id),
          ),
        )
        .all()
    : [];
  const linesByEntry = new Map<number, typeof lines>();
  for (const line of lines) linesByEntry.set(line.entryId, [...(linesByEntry.get(line.entryId) ?? []), line]);

  const entries: JournalEntry[] = rows.map((row) => {
    const entryLines = linesByEntry.get(row.id) ?? [];
    const amount = displayAmount(row.kind, entryLines);
    return {
      ...row,
      lines: entryLines,
      displayAmountCents: amount,
      displayType: displayType(row.kind, entryLines),
    };
  });

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
      <SidebarInset>
        <SiteHeader title="Buchhaltung" />
        <main className="flex flex-1 flex-col p-8 lg:p-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Banktransaktionen</h2>
              <p className="text-sm text-muted-foreground">Nevlo-Importe werden zunächst zur Prüfung vorgemerkt.</p>
            </div>
            <NevloSyncButton />
          </div>
          <AccountingJournalTable entries={entries} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
