"use client";

import { useState } from "react";

function formatEuro(amountCents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amountCents / 100);
}

export function StripeTestCheckout() {
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/stripe-test/checkout", { method: "POST" });
      const payload = (await response.json()) as { amountCents?: number; url?: string; error?: string };

      if (!response.ok || !payload.url || !payload.amountCents) {
        throw new Error(payload.error ?? "Die Stripe-Testzahlung konnte nicht gestartet werden.");
      }

      setAmountCents(payload.amountCents);
      window.location.assign(payload.url);
    } catch (checkoutError) {
      setStatus("error");
      setError(checkoutError instanceof Error ? checkoutError.message : "Unbekannter Fehler.");
    }
  }

  return (
    <div className="stripe-test-card">
      <div className="stripe-test-card__amount" aria-live="polite">
        {amountCents ? formatEuro(amountCents) : "zufälliger Betrag"}
      </div>
      <p className="stripe-test-card__hint">
        Bei jedem Klick wird serverseitig ein neuer Testbetrag zwischen 5 € und 50 € erzeugt.
      </p>
      <button
        className="button--arrow stripe-test-card__button"
        type="button"
        onClick={startCheckout}
        disabled={status === "loading"}
      >
        <span>{status === "loading" ? "Stripe wird geöffnet …" : "Sandbox-Zahlung starten"}</span>
      </button>
      {status === "error" ? (
        <p className="stripe-test-card__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
