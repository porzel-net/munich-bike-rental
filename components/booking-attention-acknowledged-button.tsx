"use client";

import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function BookingAttentionAcknowledgedButton({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function acknowledge() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: "acknowledge_booking_attention" }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok)
        throw new Error(result?.message ?? "Die Kenntnisnahme konnte nicht gespeichert werden. Versuche es erneut.");
      toast.success("Kenntnis genommen.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Die Kenntnisnahme konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button disabled={busy} onClick={acknowledge} size="sm" type="button" variant="outline">
      {busy ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <CheckCircle2Icon className="mr-2 size-4" />}
      {busy ? "Speichern …" : "Kenntnis genommen"}
    </Button>
  );
}
