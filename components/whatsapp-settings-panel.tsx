"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

type Snapshot = {
  status: "idle" | "connecting" | "qr" | "connected" | "logged_out" | "error";
  qrDataUrl: string | null;
  phone: string | null;
  error: string | null;
};

const labels: Record<Snapshot["status"], string> = {
  idle: "Nicht verbunden",
  connecting: "Verbindung wird hergestellt …",
  qr: "Warte auf QR-Code-Scan",
  connected: "Verbunden",
  logged_out: "Abgemeldet",
  error: "Verbindungsfehler",
};

export function WhatsAppSettingsPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ status: "idle", qrDataUrl: null, phone: null, error: null });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/settings/whatsapp", { cache: "no-store" });
    if (!response.ok)
      throw new Error("Der WhatsApp-Status konnte nicht geladen werden. Prüfe die Verbindung und lade die Seite neu.");
    setSnapshot((await response.json()) as Snapshot);
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/settings/whatsapp", { method: "POST" });
      const result = (await response.json().catch(() => null)) as (Snapshot & { message?: string }) | null;
      if (!response.ok) throw new Error(result?.message ?? "WhatsApp-Verbindung konnte nicht gestartet werden.");
      if (result) setSnapshot(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "WhatsApp-Verbindung konnte nicht gestartet werden.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAndConnect() {
      try {
        const response = await fetch("/api/admin/settings/whatsapp", { cache: "no-store" });
        if (!response.ok)
          throw new Error(
            "Der WhatsApp-Status konnte nicht geladen werden. Prüfe die Verbindung und lade die Seite neu.",
          );
        const initialSnapshot = (await response.json()) as Snapshot;
        if (cancelled) return;
        setSnapshot(initialSnapshot);

        if (["idle", "logged_out", "error"].includes(initialSnapshot.status)) {
          await connect();
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Der WhatsApp-Status konnte nicht geladen werden. Prüfe die Verbindung und lade die Seite neu.",
          );
        }
      }
    }

    void loadAndConnect();
    return () => {
      cancelled = true;
    };
  }, [connect]);

  useEffect(() => {
    if (!["connecting", "qr", "error"].includes(snapshot.status)) return;
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(timer);
  }, [refresh, snapshot.status]);

  return (
    <Card className="w-full max-w-md">
      <CardContent className="space-y-3 p-5">
        {snapshot.qrDataUrl && (
          <div className="flex justify-center rounded-xl border bg-white p-3">
            <Image
              src={snapshot.qrDataUrl}
              alt="QR-Code zum Verbinden mit WhatsApp"
              width={220}
              height={220}
              unoptimized
            />
          </div>
        )}

        <div className="text-center">
          <h2 className="text-lg font-semibold">WhatsApp-Konto verbinden</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Öffne WhatsApp auf deinem Handy und gehe zu Einstellungen → Verknüpfte Geräte → Gerät hinzufügen. Scanne
            anschließend diesen QR-Code. Das verbundene Konto steht danach allen Admins zur Verfügung.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm">
          <span
            className={`size-2 rounded-full ${snapshot.status === "connected" ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          <span className="font-medium">{labels[snapshot.status]}</span>
          {snapshot.phone && <span className="text-muted-foreground">· +{snapshot.phone}</span>}
        </div>

        {snapshot.error && <p className="text-sm text-destructive">{snapshot.error}</p>}
      </CardContent>
      <CardFooter className="justify-center px-5 pb-5 pt-0">
        <Button
          type="button"
          onClick={connect}
          disabled={busy || ["connecting", "qr", "connected"].includes(snapshot.status)}
        >
          {snapshot.status === "connected"
            ? "Verbunden"
            : busy || snapshot.status === "connecting"
              ? "Verbinden …"
              : "Erneut verbinden"}
        </Button>
      </CardFooter>
    </Card>
  );
}
