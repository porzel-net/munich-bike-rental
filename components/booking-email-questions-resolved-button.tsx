"use client";

import { CheckCircle2Icon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function BookingEmailQuestionsResolvedButton({ bookingId, resolved }: { bookingId: number; resolved: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const nextResolved = !resolved;

  async function updateStatus() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: "set_email_questions_resolved", resolved: nextResolved }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Status konnte nicht gespeichert werden.");
      toast.success(nextResolved ? "Fragen als geklärt markiert." : "Fragen wieder zur Prüfung geöffnet.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button disabled={busy} onClick={updateStatus} size="sm" type="button" variant={resolved ? "secondary" : "outline"}>
      {busy ? (
        <Loader2Icon className="mr-2 size-4 animate-spin" />
      ) : resolved ? (
        <RotateCcwIcon className="mr-2 size-4" />
      ) : (
        <CheckCircle2Icon className="mr-2 size-4" />
      )}
      {busy ? "Speichern …" : resolved ? "Markierung aufheben" : "Fragen geklärt"}
    </Button>
  );
}
