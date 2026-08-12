"use client";

import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type ImportResult = {
  created?: number;
  skippedExisting?: number;
  deduplicated?: number;
  candidateEmails?: number;
  message?: string;
};

export function LegacyBookingImportButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function importBookings() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/bookings/legacy-import", { method: "POST" });
      const result = (await response.json().catch(() => null)) as ImportResult | null;
      if (!response.ok) throw new Error(result?.message ?? "E-Mail-Import fehlgeschlagen.");
      toast.success(
        `${result?.created ?? 0} Buchungen importiert · ${result?.skippedExisting ?? 0} bereits vorhanden · ${result?.deduplicated ?? 0} Duplikate übersprungen.`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "E-Mail-Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button disabled={busy} onClick={importBookings} size="sm" type="button" variant="outline">
      {busy ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <DownloadIcon className="mr-2 size-4" />}
      {busy ? "Alte Buchungen werden importiert …" : "Alte Buchungen importieren"}
    </Button>
  );
}
