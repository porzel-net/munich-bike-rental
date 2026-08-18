"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function BookingAiBatchAnalysisButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function analyze() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/bookings/ai-analysis", { method: "POST" });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        checked?: number;
        skipped?: number;
        candidates?: number;
      } | null;
      if (!response.ok)
        throw new Error(
          result?.message ?? "Die KI-Prüfung konnte nicht gestartet werden. Prüfe Mailverläufe und KI-Konfiguration.",
        );

      toast.success(
        `${result?.checked ?? 0} neue Mailverläufe geprüft · ${result?.skipped ?? 0} bereits geprüfte übersprungen.`,
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Die KI-Prüfung konnte nicht gestartet werden. Prüfe Mailverläufe und KI-Konfiguration.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button disabled={busy} onClick={analyze} size="sm" type="button" variant="outline">
      {busy ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <SparklesIcon className="mr-2 size-4" />}
      {busy ? "Prüfung läuft …" : "KI-Check starten"}
    </Button>
  );
}
