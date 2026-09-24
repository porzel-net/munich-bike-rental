import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { AdminPageHeader } from "@/components/admin-page-header";
import { MailOutboxTable, type MailOutboxRow, type MailOutboxStatus } from "@/components/mail-outbox-table";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { bookings, mailOutbox, outboxStatuses } from "@/lib/db/schema";

export const metadata: Metadata = { title: "E-Mail-Postausgang" };

function parseStatus(value: string | undefined): MailOutboxStatus | "all" {
  return value && outboxStatuses.includes(value as MailOutboxStatus) ? (value as MailOutboxStatus) : "all";
}

export default async function MailOutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin/settings");

  const params = await searchParams;
  const search = params.q?.trim().toLocaleLowerCase("de-DE") ?? "";
  const status = parseStatus(params.status);
  const db = getDatabase();
  const databaseRows = db
    .select({ mail: mailOutbox, booking: { orderNumber: bookings.orderNumber, customerName: bookings.customerName } })
    .from(mailOutbox)
    .innerJoin(bookings, eq(mailOutbox.bookingId, bookings.id))
    .orderBy(desc(mailOutbox.createdAt), desc(mailOutbox.id))
    .all();

  const counts = databaseRows.reduce(
    (result, row) => {
      result[row.mail.status as MailOutboxStatus] += 1;
      return result;
    },
    { queued: 0, leased: 0, sent: 0, failed: 0, cancelled: 0 } as Record<MailOutboxStatus, number>,
  );
  const rows: MailOutboxRow[] = databaseRows
    .filter(({ mail }) => status === "all" || mail.status === status)
    .filter(({ mail, booking }) => {
      if (!search) return true;
      return [mail.recipient, mail.subject, mail.kind, booking.orderNumber, booking.customerName, mail.lastError ?? ""]
        .join(" ")
        .toLocaleLowerCase("de-DE")
        .includes(search);
    })
    .map(({ mail, booking }) => ({
      id: mail.id,
      bookingId: mail.bookingId,
      orderNumber: booking.orderNumber,
      customerName: booking.customerName,
      recipient: mail.recipient,
      subject: mail.subject,
      kind: mail.kind,
      status: mail.status as MailOutboxStatus,
      attempts: mail.attempts,
      nextAttemptAt: mail.nextAttemptAt.toISOString(),
      sentAt: mail.sentAt?.toISOString() ?? null,
      createdAt: mail.createdAt.toISOString(),
      plainText: mail.plainText,
      lastError: mail.lastError,
      sentMailboxError: mail.sentMailboxError,
      acknowledgedAt: mail.acknowledgedAt?.toISOString() ?? null,
    }));
  const pendingCount = counts.queued + counts.leased;

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
        <SiteHeader title="E-Mail-Postausgang" />
        <div className="admin-page-surface">
          <main className="admin-main flex flex-1 flex-col gap-6 p-4 sm:p-8 lg:p-12">
            <AdminPageHeader
              title="E-Mail-Postausgang"
              description="Alle ausgehenden Mails werden zuerst dauerhaft eingereiht, maximal zehnmal versucht und können vor dem Versand manuell abgebrochen werden."
              actions={
                <>
                  <Badge variant={pendingCount ? "default" : "success"}>{pendingCount} offen</Badge>
                  <Badge variant={counts.failed ? "destructive" : "outline"}>{counts.failed} Fehler</Badge>
                  <Badge variant={counts.cancelled ? "destructive" : "outline"}>{counts.cancelled} abgebrochen</Badge>
                  <Badge variant="outline">{counts.sent} versendet</Badge>
                </>
              }
            />
            <MailOutboxTable rows={rows} search={params.q ?? ""} status={status} />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
