"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function NevloSyncButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/financial/nevlo/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = (await response.json()) as { message?: string; inserted?: number; skipped?: number };
      if (!response.ok) throw new Error(result.message || "Nevlo-Synchronisation fehlgeschlagen.");
      setMessage(`${result.inserted ?? 0} neue Transaktionen importiert, ${result.skipped ?? 0} bereits vorhanden.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nevlo-Synchronisation fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" onClick={sync} disabled={busy}>
        {busy ? "Nevlo wird synchronisiert …" : "Nevlo synchronisieren"}
      </Button>
      {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
    </div>
  );
}

