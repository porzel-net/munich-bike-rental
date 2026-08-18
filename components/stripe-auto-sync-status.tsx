"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SyncResponse = {
  message?: string;
  imported?: number;
  failed?: number;
};

export function StripeAutoSyncStatus() {
  const router = useRouter();
  const [status, setStatus] = useState<"syncing" | "done" | "error">("syncing");
  const [message, setMessage] = useState("Stripe wird synchronisiert …");

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const response = await fetch("/api/admin/financial/stripe/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const result = (await response.json().catch(() => null)) as SyncResponse | null;
        if (!response.ok)
          throw new Error(
            result?.message ??
              "Die Stripe-Synchronisation konnte nicht abgeschlossen werden. Prüfe den Zeitraum und die Stripe-Verbindung.",
          );
        if (cancelled) return;

        setStatus("done");
        setMessage(
          "Stripe synchronisiert · " +
            (result?.imported ?? 0) +
            " neu" +
            (result?.failed ? ", " + result.failed + " fehlgeschlagen" : ""),
        );
        router.refresh();
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Die Stripe-Synchronisation konnte nicht abgeschlossen werden. Prüfe den Zeitraum und die Stripe-Verbindung.",
        );
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <span
      className={status === "error" ? "text-xs text-amber-700 dark:text-amber-400" : "text-xs text-muted-foreground"}
    >
      {status === "syncing" ? <Loader2 className="mr-1 inline-block size-3 animate-spin" aria-hidden="true" /> : null}
      {message}
    </span>
  );
}
