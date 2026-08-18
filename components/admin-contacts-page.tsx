"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  ClipboardIcon,
  ContactRoundIcon,
  KeyRoundIcon,
  RefreshCwIcon,
  SmartphoneIcon,
  XCircleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ContactBooking = {
  id: number;
  orderNumber: string;
  location: string;
  status: string;
  periodFrom: string;
  periodTo: string;
  updatedAt: string;
};

type Contact = {
  key: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  locations: string[];
  latestUpdatedAt: string;
  bookings: ContactBooking[];
};

export type CarddavAccountState = {
  server: string | null;
  account: {
    username: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
  } | null;
};

type Credentials = {
  server: string;
  username: string;
  password: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

function contactInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  return `${Array.from(parts[0])[0] ?? ""}${Array.from(parts.at(-1) ?? "")[0] ?? ""}`.toUpperCase();
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={() => void copy()} aria-label={`${label} kopieren`}>
      {copied ? <CheckIcon /> : <ClipboardIcon />}
    </Button>
  );
}

export function AdminContactsPage({ contacts, carddav }: { contacts: Contact[]; carddav: CarddavAccountState }) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [busy, setBusy] = useState<"credentials" | "sync" | "revoke" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [account, setAccount] = useState(carddav.account);

  const filteredContacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de-DE");
    if (!normalized) return contacts;
    return contacts.filter((contact) => {
      const haystack = [
        contact.name,
        contact.email,
        contact.phone,
        ...contact.bookings.map((booking) => booking.orderNumber),
      ]
        .join(" ")
        .toLocaleLowerCase("de-DE");
      return haystack.includes(normalized);
    });
  }, [contacts, query]);

  function openCarddavDialog() {
    setMessage(null);
    setCredentials(null);
    setDialogOpen(true);
  }

  async function rotateCredentials() {
    setBusy("credentials");
    setMessage(null);
    const response = await fetch("/api/admin/carddav", { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as {
      credentials?: Credentials;
      message?: string;
    };
    setBusy(null);
    if (!response.ok || !body.credentials) {
      setMessage(body.message ?? "Der CardDAV-Zugang konnte nicht eingerichtet werden.");
      return;
    }
    setCredentials(body.credentials);
    setAccount((current) => ({
      username: body.credentials!.username,
      enabled: true,
      createdAt: current?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: current?.lastSyncedAt ?? null,
      lastSyncError: null,
    }));
  }

  async function syncContacts() {
    setBusy("sync");
    setMessage(null);
    const response = await fetch("/api/admin/carddav/sync", { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as { synced?: number; message?: string; syncedAt?: string };
    setBusy(null);
    if (!response.ok) {
      setMessage(body.message ?? "Die Kontakte konnten nicht synchronisiert werden.");
      return;
    }
    setAccount((current) =>
      current ? { ...current, lastSyncedAt: body.syncedAt ?? new Date().toISOString(), lastSyncError: null } : current,
    );
    setMessage(`${body.synced ?? 0} Kontakte wurden an CardDAV übertragen.`);
  }

  async function revokeCredentials() {
    if (!window.confirm("CardDAV-Zugang wirklich widerrufen? Das iPhone kann danach nicht mehr synchronisieren."))
      return;
    setBusy("revoke");
    const response = await fetch("/api/admin/carddav", { method: "DELETE" });
    setBusy(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setMessage(
        body.message ??
          "Der CardDAV-Zugang konnte nicht widerrufen werden. Prüfe deine Berechtigung und versuche es erneut.",
      );
      return;
    }
    setAccount((current) => (current ? { ...current, enabled: false } : current));
    setCredentials(null);
    setMessage(
      "Der CardDAV-Zugang wurde widerrufen. Bereits synchronisierte Kontakte bleiben auf den Geräten, bis der Account entfernt wird.",
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kontakte</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={openCarddavDialog}>
            <SmartphoneIcon />
            iPhone verbinden
          </Button>
          {account?.enabled ? (
            <Button type="button" variant="outline" onClick={() => void syncContacts()} disabled={busy !== null}>
              <RefreshCwIcon className={busy === "sync" ? "animate-spin" : undefined} />
              Kontakte synchronisieren
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="rounded-3xl border-border/60 bg-card shadow-sm">
        <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 pb-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kontakte suchen …"
            className="min-w-0 flex-1 lg:max-w-xs"
          />
          <CardTitle className="shrink-0 text-right">{contacts.length} Kontakte</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredContacts.length ? (
            <Table className="[&_td]:px-6 [&_td]:py-5 [&_th]:px-6 [&_th]:py-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Telefonnummer</TableHead>
                  <TableHead>Aufträge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.key}>
                    <TableCell className="min-w-52">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <span className="text-sm font-semibold text-muted-foreground" aria-hidden="true">
                            {contactInitials(contact.name)}
                          </span>
                        </div>
                        <span className="truncate font-medium">{contact.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-56">
                      <a
                        className="truncate text-sm text-muted-foreground hover:text-foreground"
                        href={`mailto:${contact.email}`}
                      >
                        {contact.email}
                      </a>
                    </TableCell>
                    <TableCell className="min-w-44">
                      <a className="text-sm text-muted-foreground hover:text-foreground" href={`tel:${contact.phone}`}>
                        {contact.phone}
                      </a>
                    </TableCell>
                    <TableCell className="min-w-64">
                      <div className="flex flex-wrap gap-2">
                        {contact.bookings.map((booking) => (
                          <Link key={booking.id} href={`/admin/bookings/${booking.id}`}>
                            <Badge variant="outline" className="hover:bg-muted">
                              {booking.orderNumber}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <ContactRoundIcon className="size-8 text-muted-foreground" />
              <p className="font-medium">Keine Kontakte gefunden.</p>
              <p className="text-sm text-muted-foreground">
                Passe den Suchbegriff an oder prüfe die Standortberechtigung.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {message ? <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{message}</p> : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setCredentials(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SmartphoneIcon className="size-5" /> iPhone mit Kontakten verbinden
            </DialogTitle>
            <DialogDescription>
              CardDAV synchronisiert den sichtbaren Kontaktbestand im Hintergrund auf dein iPhone. Das CardDAV-Passwort
              ist unabhängig von deinem Login und wird nur bei der Erzeugung angezeigt.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Erzeuge unten deine persönlichen CardDAV-Zugangsdaten.</li>
              <li>Öffne auf dem iPhone Einstellungen → Apps → Kontakte → Kontakteaccounts.</li>
              <li>Wähle Account hinzufügen → Anderen Account hinzufügen → CardDAV-Account hinzufügen.</li>
              <li>Trage Server, Benutzername und Passwort aus diesem Dialog ein.</li>
            </ol>

            {!carddav.server ? (
              <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
                Der CardDAV-Server ist noch nicht für diese Umgebung konfiguriert.
              </div>
            ) : null}

            {credentials ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <KeyRoundIcon className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div>
                    <p className="font-medium">Passwort jetzt sicher speichern</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Nach dem Schließen kann es nicht erneut angezeigt werden. Bei Verlust erzeugst du ein neues
                      Passwort.
                    </p>
                  </div>
                </div>
                <CredentialRow label="Server" value={credentials.server} />
                <CredentialRow label="Benutzername" value={credentials.username} />
                <CredentialRow label="Passwort" value={credentials.password} secret />
              </div>
            ) : account?.enabled && carddav.server ? (
              <div className="rounded-2xl bg-muted/60 p-4 text-sm">
                <p className="font-medium">CardDAV ist eingerichtet.</p>
                <p className="mt-1 text-muted-foreground">
                  Das bestehende Passwort wird nicht angezeigt. Erzeuge nur bei Bedarf ein neues Passwort; dadurch wird
                  das alte sofort ungültig.
                </p>
              </div>
            ) : null}

            {account?.lastSyncedAt ? (
              <p className="text-xs text-muted-foreground">
                Letzte Synchronisierung: {formatDate(account.lastSyncedAt)}
              </p>
            ) : null}
            {account?.lastSyncError ? (
              <p className="text-sm text-destructive">Letzter Synchronisierungsfehler: {account.lastSyncError}</p>
            ) : null}
          </div>

          <DialogFooter>
            {account?.enabled ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void revokeCredentials()}
                disabled={busy !== null}
              >
                <XCircleIcon />
                Zugang widerrufen
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => void rotateCredentials()}
              disabled={busy !== null || !carddav.server}
            >
              <KeyRoundIcon />
              {account?.enabled ? "Neues Passwort erzeugen" : "Zugang einrichten"}
            </Button>
            <Button type="button" onClick={() => setDialogOpen(false)}>
              Fertig
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CredentialRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <code className="min-w-0 break-all rounded-lg bg-background px-3 py-2 text-xs ring-1 ring-border/60">
        {secret ? value : value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  );
}
