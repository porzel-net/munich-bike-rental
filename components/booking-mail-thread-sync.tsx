"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2Icon, MailIcon, RefreshCwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { splitMailThreadBody } from "@/lib/inquiries/mail-thread";
import { repairMojibake } from "@/lib/inquiries/text";

type MailMessage = {
  id: number;
  direction: "inbound" | "outbound";
  subject: string;
  plainText: string;
  sentAt: string;
};

type MailThreadResponse = {
  sync?: {
    configured: boolean;
    synced: number;
    error?: string;
  };
  messages?: MailMessage[];
};

function formatMailSubject(subject: string) {
  const match = subject.match(/^Historische (confirmation|rejection)$/);
  if (!match) return subject;
  return match[1] === "confirmation" ? "Historische Buchungsbestätigung" : "Historische Buchungsablehnung";
}

function formatMailText(text: string) {
  return repairMojibake(
    text.replace(
      /^Historische Mailaktion: (confirmation|rejection)$/gm,
      (_, action: string) =>
        `Historische Mailaktion: ${action === "confirmation" ? "Buchungsbestätigung" : "Buchungsablehnung"}`,
    ),
  );
}

function MailThreadSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-muted/20 px-4 py-3">
        <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      {[0, 1, 2].map((index) => (
        <div className="rounded-2xl border bg-card p-4" key={index}>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BookingMailThreadSync({ bookingId }: { bookingId: number }) {
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadThread = async () => {
      setLoading(true);
      setFailed(false);
      setNotice(null);

      try {
        const response = await fetch(`/api/admin/bookings/${bookingId}/messages`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as MailThreadResponse | null;

        if (!response.ok || !result?.messages) {
          throw new Error("Mailverlauf konnte nicht geladen werden.");
        }

        setMessages(result.messages);
        setNotice("Archivierter Mailverlauf geladen.");
      } catch (error) {
        if (controller.signal.aborted) return;
        setFailed(true);
        setNotice(error instanceof Error ? error.message : "Mailverlauf konnte nicht geladen werden.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadThread();
    return () => controller.abort();
  }, [bookingId]);

  async function syncThread() {
    setSyncing(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as MailThreadResponse | null;
      if (!response.ok || !result?.messages) throw new Error("Mailverlauf konnte nicht synchronisiert werden.");
      setMessages(result.messages);
      const sync = result.sync;
      setNotice(
        sync?.error
          ? "IMAP derzeit nicht erreichbar. Archivierte Mails werden angezeigt."
          : !sync?.configured
            ? "IMAP ist nicht konfiguriert. Archivierte Mails werden angezeigt."
            : `${sync?.synced ?? 0} Nachricht(en) synchronisiert.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Mailverlauf konnte nicht synchronisiert werden.");
    } finally {
      setSyncing(false);
    }
  }

  const emptyState = useMemo(
    () => (
      <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        Für diese Buchung sind noch keine archivierten Nachrichten vorhanden.
      </div>
    ),
    [],
  );

  if (loading) {
    return <MailThreadSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-background shadow-sm">
            <MailIcon className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Archivierter Mailverlauf</p>
            <p className="text-sm text-muted-foreground">
              Synchronisation mit dem Mailserver nur bei ausdrücklicher Anforderung.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void syncThread()} disabled={syncing}>
          <RefreshCwIcon className="mr-2 size-4" />
          {syncing ? "Synchronisiere …" : "Mailserver synchronisieren"}
        </Button>
      </div>

      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

      {failed && !messages.length ? (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          Der Mailverlauf konnte nicht geladen werden. Bitte lade die Buchung erneut.
        </div>
      ) : null}

      {messages.length ? (
        <div className="space-y-4">
          {messages.map((message) => {
            const body = splitMailThreadBody(message.plainText);
            const visibleText = body.visibleText ? formatMailText(body.visibleText) : null;
            const quotedText = body.quotedText ? formatMailText(body.quotedText) : null;

            return (
              <article className="rounded-2xl border bg-card p-4 shadow-sm" key={message.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={message.direction === "inbound" ? "secondary" : "outline"}>
                      {message.direction === "inbound" ? "Eingang" : "Ausgang"}
                    </Badge>
                    <p className="font-medium">{formatMailSubject(message.subject)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.sentAt).toLocaleString("de-DE")}
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {visibleText ? (
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-muted-foreground">
                      {visibleText}
                    </pre>
                  ) : quotedText ? (
                    <p className="text-sm text-muted-foreground">Diese Nachricht enthält nur zitierten Verlauf.</p>
                  ) : null}

                  {quotedText ? (
                    <details className="rounded-xl border border-dashed bg-muted/20 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground outline-none">
                        Vorherigen E-Mail-Verlauf anzeigen
                      </summary>
                      <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-muted-foreground">
                        {quotedText}
                      </pre>
                    </details>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        emptyState
      )}
    </div>
  );
}
