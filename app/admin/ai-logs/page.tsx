import { and, count, desc, eq, or } from "drizzle-orm";
import { BotIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { AiLogsFilter } from "@/components/ai-logs-filter";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getDatabase } from "@/lib/db/client";
import { communicationMessages, emailActionReviews, bookings } from "@/lib/db/schema";
import { getServerSession, isAdmin } from "@/lib/auth/session";
import { aiLogAgentLabel, aiLogSourceLabel, aiLogStatusView } from "@/lib/ai-logs/presentation";
import { reviewQuestions } from "@/lib/inquiries/email-action";

function parseFilter<T extends string>(value: string | undefined, values: readonly T[], fallback: T) {
  return values.includes(value as T) ? (value as T) : fallback;
}

export default async function AiLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source?: string }>;
}) {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin/settings");

  const params = await searchParams;
  const search = params.q?.trim().toLocaleLowerCase("de-DE") ?? "";
  const status = parseFilter(params.status, ["all", "needs_action", "no_action", "error"] as const, "all");
  const source = parseFilter(params.source, ["all", "openai", "inquiry_rule", "fallback"] as const, "all");
  const db = getDatabase();
  const logConditions = [
    status !== "all" ? eq(emailActionReviews.status, status) : null,
    source !== "all" ? eq(emailActionReviews.source, source) : null,
  ].filter((condition): condition is NonNullable<typeof condition> => condition !== null);
  const logs = db
    .select({
      review: emailActionReviews,
      booking: {
        id: bookings.id,
        orderNumber: bookings.orderNumber,
        customerName: bookings.customerName,
      },
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
    .where(logConditions.length ? and(...logConditions) : undefined)
    .orderBy(desc(emailActionReviews.createdAt), desc(emailActionReviews.id))
    .all()
    .filter(({ review, booking, message }) => {
      if (!search) return true;
      return [
        booking.orderNumber,
        booking.customerName,
        message.subject,
        message.sender,
        review.summary,
        review.errorMessage ?? "",
        ...reviewQuestions(review),
      ]
        .join(" ")
        .toLocaleLowerCase("de-DE")
        .includes(search);
    });
  const totalCount = db.select({ value: count() }).from(emailActionReviews).get()?.value ?? 0;
  const needsActionCount =
    db
      .select({ value: count() })
      .from(emailActionReviews)
      .where(or(eq(emailActionReviews.status, "needs_action"), eq(emailActionReviews.status, "error")))
      .get()?.value ?? 0;
  const errorCount =
    db.select({ value: count() }).from(emailActionReviews).where(eq(emailActionReviews.status, "error")).get()?.value ??
    0;

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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">AI-Logs</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Zentrale Übersicht über die Ausführungen der verschiedenen KI-Agenten.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{totalCount} Prüfungen</Badge>
              <Badge variant={needsActionCount || errorCount ? "destructive" : "success"}>
                {needsActionCount + errorCount} mit Handlungsbedarf
              </Badge>
            </div>
          </div>

          <AiLogsFilter search={params.q ?? ""} status={status} source={source} />

          {logs.length ? (
            <ItemGroup className="gap-2">
              {logs.map(({ review, booking }) => {
                const view = aiLogStatusView(review.status);
                return (
                  <Item
                    className="cursor-pointer hover:bg-muted/80"
                    key={review.id}
                    render={<Link href={`/admin/ai-logs/${review.id}`} />}
                    variant="muted"
                  >
                    <ItemMedia>
                      <div className="relative flex size-12 items-center justify-center rounded-lg border text-xs font-semibold">
                        <BotIcon className="size-5 text-muted-foreground" />
                        {review.status === "needs_action" || review.status === "error" ? (
                          <span
                            aria-label="Handlungsbedarf"
                            className="absolute -top-1 -left-1 size-3 rounded-full bg-red-500 ring-2 ring-background"
                          />
                        ) : null}
                      </div>
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle>
                        {aiLogAgentLabel(review.source)}
                        <span className="font-normal text-muted-foreground">Lauf #{review.id}</span>
                      </ItemTitle>
                      <ItemDescription className="text-xs tracking-wider uppercase">
                        Buchung {booking.orderNumber}
                        {review.model ? ` · ${review.model}` : ""}
                      </ItemDescription>
                    </ItemContent>
                    <div className="flex shrink-0 items-center gap-4">
                      <Badge variant={view.variant}>{view.label}</Badge>
                      <Badge variant="outline">{aiLogSourceLabel(review.source)}</Badge>
                      {review.reasoningEffort ? (
                        <Badge variant="outline">Reasoning {review.reasoningEffort}</Badge>
                      ) : null}
                      <div className="flex min-w-28 flex-col items-end gap-0.5">
                        <span className="text-xs tracking-wider text-muted-foreground uppercase">Gestartet</span>
                        <span className="font-medium tabular-nums">
                          {new Date(review.createdAt).toLocaleString("de-DE")}
                        </span>
                      </div>
                    </div>
                  </Item>
                );
              })}
            </ItemGroup>
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              Keine AI-Logs für die aktuellen Filter vorhanden.
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
