"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { FinancialReviewCategory } from "@/components/financial-review-inbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Account = { id: number; name: string; type: string };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ManualFinancialTransactionDialog({
  open,
  onOpenChange,
  categories,
  accounts,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinancialReviewCategory[];
  accounts: Account[];
  onSaved: () => void;
}) {
  const [source, setSource] = useState<"cash" | "manual">("cash");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [description, setDescription] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<"bike" | "equipment" | "other">("bike");
  const [assetCost, setAssetCost] = useState("");
  const [inputVat, setInputVat] = useState("0");
  const [inServiceDate, setInServiceDate] = useState(today());
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("84");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedCategory = categories.find((category) => String(category.id) === categoryId);
  const isAsset = selectedCategory?.euerTreatment === "asset_acquisition";

  function reset() {
    setSource("cash");
    setDate(today());
    setAmount("");
    setCategoryId("");
    setAccountId("");
    setCounterpartyName("");
    setDescription("");
    setAssetName("");
    setAssetType("bike");
    setAssetCost("");
    setInputVat("0");
    setInServiceDate(today());
    setUsefulLifeMonths("84");
    setError(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
    const assetCostCents = Math.round(Number((assetCost || amount).replace(",", ".")) * 100);
    const inputVatCents = Math.round(Number(inputVat.replace(",", ".")) * 100);
    const life = Number(usefulLifeMonths);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      setError("Bitte gib einen gültigen Betrag ein.");
      setBusy(false);
      return;
    }
    if (!categoryId || !selectedCategory) {
      setError("Bitte wähle eine Kategorie.");
      setBusy(false);
      return;
    }
    if (
      isAsset &&
      (!assetName.trim() ||
        !Number.isSafeInteger(assetCostCents) ||
        !Number.isSafeInteger(inputVatCents) ||
        !Number.isSafeInteger(life))
    ) {
      setError("Bitte erfasse Name, Netto-Anschaffungskosten, Vorsteuer und Nutzungsdauer des Anlageguts.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/admin/financial/transactions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          bookedAt: date,
          amountCents,
          categoryId: Number(categoryId),
          accountId: accountId ? Number(accountId) : undefined,
          counterpartyName,
          description,
          asset: isAsset
            ? {
                name: assetName,
                assetType,
                acquisitionDate: date,
                inServiceDate,
                acquisitionCostCents: assetCostCents,
                inputVatCents,
                usefulLifeMonths: life,
              }
            : undefined,
        }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message || "Transaktion konnte nicht gespeichert werden.");
      toast.success("Manuelle Transaktion wurde gespeichert.");
      onSaved();
      reset();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Transaktion konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Manuelle Transaktion erfassen</DialogTitle>
            <DialogDescription>
              Für Bargeld, private Auslagen und historische Vorgänge, die nicht aus der Bank importiert wurden.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="manual-source">Quelle</FieldLabel>
                <Select value={source} onValueChange={(value) => setSource((value || "cash") as "cash" | "manual")}>
                  <SelectTrigger id="manual-source" className="w-full">
                    <SelectValue>
                      {(value) => (value === "manual" ? "Sonstige manuelle Zahlung" : "Bargeld / Kasse")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="cash">Bargeld / Kasse</SelectItem>
                      <SelectItem value="manual">Sonstige manuelle Zahlung</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-date">Buchungsdatum</FieldLabel>
                <Input
                  id="manual-date"
                  required
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="manual-amount">Betrag in Euro</FieldLabel>
                <Input
                  id="manual-amount"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-account">Finanzkonto</FieldLabel>
                <Select value={accountId} onValueChange={(value) => setAccountId(value || "")}>
                  <SelectTrigger id="manual-account" className="w-full">
                    <SelectValue>
                      {(value) =>
                        accounts.find((account) => String(account.id) === String(value))?.name ?? "Automatisch: Kasse"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="manual-category">Kategorie</FieldLabel>
              <Select value={categoryId} onValueChange={(value) => setCategoryId(value || "")}>
                <SelectTrigger id="manual-category" className="w-full">
                  <SelectValue>
                    {(value) =>
                      categories.find((category) => String(category.id) === String(value))?.name ??
                      "Kategorie auswählen"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {categories
                      .filter((category) => category.euerTreatment !== "needs_review")
                      .map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="manual-counterparty">Zahlungsempfänger / Zahler</FieldLabel>
                <Input
                  id="manual-counterparty"
                  value={counterpartyName}
                  onChange={(event) => setCounterpartyName(event.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-description">Beschreibung</FieldLabel>
                <Input
                  id="manual-description"
                  required
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                />
              </Field>
            </div>
            {isAsset ? (
              <div className="grid gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="font-medium">Anlagegut</p>
                  <p className="text-xs text-muted-foreground">
                    Der Betrag muss Netto-Anschaffungskosten plus Vorsteuer entsprechen.
                  </p>
                </div>
                <Field>
                  <FieldLabel htmlFor="manual-asset-name">Bezeichnung</FieldLabel>
                  <Input
                    id="manual-asset-name"
                    required
                    value={assetName}
                    onChange={(event) => setAssetName(event.target.value)}
                    placeholder="z. B. Fahrrad Canyon M"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="manual-asset-type">Anlageart</FieldLabel>
                  <Select
                    value={assetType}
                    onValueChange={(value) => setAssetType((value || "bike") as "bike" | "equipment" | "other")}
                  >
                    <SelectTrigger id="manual-asset-type" className="w-full">
                      <SelectValue>
                        {(value) =>
                          value === "equipment" ? "Betriebsausstattung" : value === "other" ? "Sonstiges" : "Fahrrad"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="bike">Fahrrad</SelectItem>
                        <SelectItem value="equipment">Betriebsausstattung</SelectItem>
                        <SelectItem value="other">Sonstiges</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="manual-asset-cost">Netto-Anschaffungskosten</FieldLabel>
                  <Input
                    id="manual-asset-cost"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={assetCost}
                    onChange={(event) => setAssetCost(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="manual-asset-vat">Vorsteuer</FieldLabel>
                  <Input
                    id="manual-asset-vat"
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputVat}
                    onChange={(event) => setInputVat(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="manual-asset-service-date">Inbetriebnahme</FieldLabel>
                  <Input
                    id="manual-asset-service-date"
                    required
                    type="date"
                    value={inServiceDate}
                    onChange={(event) => setInServiceDate(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="manual-asset-life">Nutzungsdauer in Monaten</FieldLabel>
                  <Input
                    id="manual-asset-life"
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={usefulLifeMonths}
                    onChange={(event) => setUsefulLifeMonths(event.target.value)}
                  />
                  <FieldDescription>Für Fahrräder ist zunächst 84 Monate vorbelegt.</FieldDescription>
                </Field>
              </div>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={busy}>
                  Abbrechen
                </Button>
              }
            />
            <Button type="submit" disabled={busy}>
              {busy ? "Speichern…" : "Transaktion speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ManualFinancialTransactionLauncher({
  categories,
  accounts,
}: {
  categories: FinancialReviewCategory[];
  accounts: Account[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Manuelle Transaktion
      </Button>
      <ManualFinancialTransactionDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        accounts={accounts}
        onSaved={() => undefined}
      />
    </>
  );
}
