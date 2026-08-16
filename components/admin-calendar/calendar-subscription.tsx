"use client";

import { CalendarPlus, Check, Copy, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CalendarAccountState = {
  username: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
} | null;

type Credentials = {
  username: string;
  password: string;
};

export function CalendarSubscription({
  account: initialAccount,
  allLocations,
  calendarUrl,
  scopeLabel,
}: {
  account: CalendarAccountState;
  allLocations: boolean;
  calendarUrl: string;
  scopeLabel: string;
}) {
  const [account, setAccount] = useState(initialAccount);
  const [copied, setCopied] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [busy, setBusy] = useState<"credentials" | "revoke" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(calendarUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Die Kalender-URL konnte nicht kopiert werden.");
    }
  }

  async function rotateCredentials() {
    setBusy("credentials");
    setMessage(null);
    const response = await fetch("/api/admin/calendar-account", { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as {
      credentials?: Credentials;
      message?: string;
    };
    setBusy(null);
    if (!response.ok || !body.credentials) {
      setMessage(body.message ?? "Der Kalenderzugang konnte nicht eingerichtet werden.");
      return;
    }
    const now = new Date().toISOString();
    setAccount((current) => ({
      username: body.credentials!.username,
      enabled: true,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    }));
    setCredentials(body.credentials);
  }

  async function revokeCredentials() {
    if (!window.confirm("Kalenderzugang wirklich widerrufen? Bestehende Kalenderabos funktionieren danach nicht mehr."))
      return;
    setBusy("revoke");
    setMessage(null);
    const response = await fetch("/api/admin/calendar-account", { method: "DELETE" });
    setBusy(null);
    if (!response.ok) {
      setMessage("Der Kalenderzugang konnte nicht widerrufen werden.");
      return;
    }
    setAccount((current) => (current ? { ...current, enabled: false, updatedAt: new Date().toISOString() } : current));
    setMessage("Der Kalenderzugang wurde widerrufen.");
  }

  return (
    <>
      <div className="calendar-subscription">
        <div className="calendar-subscription-copy">
          <CalendarPlus className="size-4" aria-hidden="true" />
          <div>
            <strong>Apple Kalender abonnieren</strong>
            <span>Ein read-only Kalender für {scopeLabel}. Zugangsdaten werden nur einmal angezeigt.</span>
          </div>
        </div>
        <div className="calendar-subscription-actions">
          {account?.enabled ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => void copyUrl()}>
              {copied ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {copied ? "Kopiert" : allLocations ? "Gesamtlink kopieren" : "Kalenderlink kopieren"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void rotateCredentials()}
            disabled={busy !== null}
          >
            {busy === "credentials" ? (
              <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="size-3.5" aria-hidden="true" />
            )}
            {account?.enabled ? "Passwort neu erzeugen" : "Zugang einrichten"}
          </Button>
          {account?.enabled ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void revokeCredentials()}
              disabled={busy !== null}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Widerrufen
            </Button>
          ) : null}
        </div>
        {message ? <span className="calendar-subscription-message">{message}</span> : null}
      </div>

      <Dialog open={credentials !== null} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kalenderzugang speichern</DialogTitle>
            <DialogDescription>
              Das Passwort wird nicht gespeichert und kann später nicht erneut angezeigt werden. Bei einer neuen
              Rotation wird dieses Passwort sofort ungültig.
            </DialogDescription>
          </DialogHeader>
          {credentials ? (
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/40 p-4 text-sm">
              <div>
                <div className="font-medium">Kalender-URL</div>
                <code className="mt-1 block break-all text-xs">{calendarUrl}</code>
              </div>
              <div>
                <div className="font-medium">Benutzername</div>
                <code className="mt-1 block break-all text-xs">{credentials.username}</code>
              </div>
              <div>
                <div className="font-medium">Passwort</div>
                <code className="mt-1 block break-all text-xs">{credentials.password}</code>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" onClick={() => setCredentials(null)}>
              Gespeichert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
