"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function BookingAiAnalysisButton({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function analyze() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/ai-analysis`, { method: "POST" });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        review?: { status?: "needs_action" | "no_action" | "error" } | null;
      } | null;
      if (!response.ok) throw new Error(result?.message ?? "KI-Analyse konnte nicht gestartet werden.");

      if (result?.review?.status === "needs_action")
        toast.warning("Wahrscheinlich ist noch eine Antwort erforderlich.");
      else if (result?.review?.status === "error")
        toast.error("Die KI-Prüfung ist fehlgeschlagen. Bitte den Mailverlauf prüfen.");
      else toast.success("Alle Fragen wirken beantwortet.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "KI-Analyse konnte nicht gestartet werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button disabled={busy} onClick={analyze} size="sm" type="button" variant="outline">
      {busy ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <SparklesIcon className="mr-2 size-4" />}
      {busy ? "Analyse läuft …" : "KI-Check starten"}
    </Button>
  );
}
