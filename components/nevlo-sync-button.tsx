"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function NevloSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoSyncStarted = useRef(false);

  const sync = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/financial/nevlo/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = (await response.json()) as { message?: string; inserted?: number; skipped?: number };
      if (!response.ok)
        throw new Error(
          result.message ||
            "Die Nevlo-Synchronisation konnte nicht abgeschlossen werden. Prüfe Zeitraum, Kontoauswahl und Nevlo-Verbindung.",
        );
      setMessage(`${result.inserted ?? 0} neue Transaktionen importiert, ${result.skipped ?? 0} bereits vorhanden.`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Die Nevlo-Synchronisation konnte nicht abgeschlossen werden. Prüfe Zeitraum, Kontoauswahl und Nevlo-Verbindung.",
      );
    } finally {
      setBusy(false);
    }
  }, [router]);

  useEffect(() => {
    if (autoSyncStarted.current) return;
    autoSyncStarted.current = true;
    void sync();
  }, [sync]);

  return (
    <span className="text-right text-xs text-muted-foreground">{busy ? "Nevlo wird synchronisiert …" : message}</span>
  );
}
