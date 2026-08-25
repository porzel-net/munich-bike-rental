import { eq } from "drizzle-orm";
import { ArrowLeftIcon, BotIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { formatDateTime } from "@/lib/datetime";
import { bookings, communicationMessages, emailActionReviews } from "@/lib/db/schema";
import { aiLogAgentLabel, aiLogSourceLabel, aiLogStatusView } from "@/lib/ai-logs/presentation";
import { reviewQuestions } from "@/lib/inquiries/email-action";

export default async function AiLogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin/settings");

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const log = getDatabase()
    .select({
      review: emailActionReviews,
      booking: { id: bookings.id, orderNumber: bookings.orderNumber },
      message: {
        direction: communicationMessages.direction,
        subject: communicationMessages.subject,
        sender: communicationMessages.sender,
        sentAt: communicationMessages.sentAt,
      },
    })
    .from(emailActionReviews)
    .innerJoin(bookings, eq(emailActionReviews.bookingId, bookings.id))
    .innerJoin(communicationMessages, eq(emailActionReviews.triggerMessageId, communicationMessages.id))
    .where(eq(emailActionReviews.id, id))
    .get();

  if (!log) notFound();
  const status = aiLogStatusView(log.review.status);
  const questions = reviewQuestions(log.review);

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
        <SiteHeader title="AI Logs" />
        <main className="flex flex-1 flex-col gap-6 p-8 lg:p-12">
          <Button nativeButton={false} variant="ghost" className="w-fit px-2" render={<Link href="/admin/ai-logs" />}>
            <ArrowLeftIcon />
            Zurück zu AI Logs
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl border bg-muted/30">
                  <BotIcon className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">{aiLogAgentLabel(log.review.source)}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">AI-Lauf #{log.review.id}</p>
                </div>
              </div>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Ergebnis</CardTitle>
                <CardDescription>Die zusammengefasste Auswertung dieses AI-Laufs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm leading-6">{log.review.summary}</p>
                {questions.length ? (
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Offene Punkte</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {questions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {log.review.errorMessage ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {log.review.errorMessage}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Laufdetails</CardTitle>
                <CardDescription>Technische Informationen zum Agentenlauf.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow label="Agent" value={aiLogAgentLabel(log.review.source)} />
                <DetailRow label="Quelle" value={aiLogSourceLabel(log.review.source)} />
                <DetailRow label="Modell" value={log.review.model ?? "—"} />
                <DetailRow label="Reasoning" value={log.review.reasoningEffort ?? "—"} />
                <DetailRow label="Prompt-Version" value={log.review.promptVersion} />
                <DetailRow label="Gestartet" value={formatDateTime(log.review.createdAt)} />
                <DetailRow label="Ausgelöste Mail" value={log.message.subject} />
                <Button
                  nativeButton={false}
                  variant="outline"
                  className="mt-3 w-full"
                  render={<Link href={`/admin/bookings/${log.booking.id}`} />}
                >
                  Zugehörige Buchung öffnen
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-medium break-words">{value}</span>
    </div>
  );
}
