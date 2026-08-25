"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { berlinDateKey } from "@/lib/datetime";

type Asset = {
  id: number;
  name: string;
  bookValueCents: number;
};
type FinancialAccount = { id: number; code: string; name: string };

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

function today() {
  return berlinDateKey();
}

export function FixedAssetDisposalLauncher({
  asset,
  financialAccounts,
}: {
  asset: Asset;
  financialAccounts: FinancialAccount[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Verkauf erfassen
      </Button>
      <FixedAssetDisposalDialog
        asset={asset}
        financialAccounts={financialAccounts}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function FixedAssetDisposalDialog({
  asset,
  financialAccounts,
  open,
  onOpenChange,
}: {
  asset: Asset;
  financialAccounts: FinancialAccount[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [disposedAt, setDisposedAt] = useState(today());
  const [proceeds, setProceeds] = useState("");
  const [vat, setVat] = useState("");
  const [financialAccountId, setFinancialAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const disposalProceedsCents = Math.round(Number(proceeds.replace(",", ".")) * 100);
    const disposalProceedsVatCents = Math.round(Number(vat.replace(",", ".")) * 100 || 0);
    if (!financialAccountId) {
      setError("Bitte wähle das Konto, auf dem der Verkaufserlös eingegangen ist.");
      setBusy(false);
      return;
    }
    if (!Number.isSafeInteger(disposalProceedsCents) || disposalProceedsCents < 0) {
      setError("Bitte gib einen gültigen Nettoverkaufspreis ein.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/admin/financial/assets/disposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          financialAccountId: Number(financialAccountId),
          disposedAt,
          disposalProceedsCents,
          disposalProceedsVatCents,
        }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok)
        throw new Error(
          result?.message ??
            "Der Verkauf konnte nicht erfasst werden. Prüfe Anlagegut, Verkaufskonto, Datum und Nettoverkaufspreis.",
        );
      toast.success("Verkauf erfasst; AfA und EÜR wurden aktualisiert.");
      onOpenChange(false);
      window.location.reload();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Der Verkauf konnte nicht erfasst werden. Prüfe Anlagegut, Verkaufskonto, Datum und Nettoverkaufspreis.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-xl">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Verkauf erfassen</DialogTitle>
            <DialogDescription>
              {asset.name}: aktueller Buchwert {euro.format(asset.bookValueCents / 100)}. Die AfA wird bis zum
              Verkaufsmonat nachgebucht und danach beendet.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="mt-6">
            <Field>
              <FieldLabel htmlFor="asset-disposal-date">Verkaufsdatum</FieldLabel>
              <Input
                id="asset-disposal-date"
                required
                type="date"
                value={disposedAt}
                onChange={(event) => setDisposedAt(event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="asset-disposal-proceeds">Verkaufspreis netto in Euro</FieldLabel>
                <Input
                  id="asset-disposal-proceeds"
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={proceeds}
                  onChange={(event) => setProceeds(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="asset-disposal-vat">Umsatzsteuer in Euro</FieldLabel>
                <Input
                  id="asset-disposal-vat"
                  min="0"
                  step="0.01"
                  type="number"
                  value={vat}
                  onChange={(event) => setVat(event.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="asset-disposal-account">Eingangskonto</FieldLabel>
              <Select value={financialAccountId} onValueChange={(value) => setFinancialAccountId(value ?? "")}>
                <SelectTrigger id="asset-disposal-account" className="w-full">
                  <SelectValue placeholder="Konto auswählen">
                    {(value) => {
                      const account = financialAccounts.find((item) => String(item.id) === String(value));
                      return account ? `${account.name} · ${account.code}` : "Konto auswählen";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {financialAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name} · {account.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Wird gespeichert…" : "Verkauf erfassen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
