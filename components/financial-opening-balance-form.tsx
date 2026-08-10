"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FinancialOpeningBalanceForm({
  accountId,
  openingBalanceCents,
  openingBalanceDate,
}: {
  accountId: number;
  openingBalanceCents: number;
  openingBalanceDate: string | null;
}) {
  const [amount, setAmount] = useState((openingBalanceCents / 100).toFixed(2).replace(".", ","));
  const [date, setDate] = useState(openingBalanceDate || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isSafeInteger(amountCents) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setMessage("Betrag und Datum prüfen.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/financial/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingBalanceCents: amountCents, openingBalanceDate: date }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Anfangsbestand konnte nicht gespeichert werden.");
      setMessage("Anfangsbestand gespeichert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Anfangsbestand konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t pt-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Anfangsbestand zum Importbeginn</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-32"
          type="number"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-label="Anfangsbestand in Euro"
        />
        <Input
          className="w-40"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label="Datum des Anfangsbestands"
        />
        <Button type="button" size="sm" variant="outline" onClick={save} disabled={busy}>
          {busy ? "Speichert…" : "Speichern"}
        </Button>
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>
    </div>
  );
}
