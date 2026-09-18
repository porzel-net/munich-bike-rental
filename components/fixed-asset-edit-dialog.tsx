"use client";

import { type ReactNode, useState } from "react";
import { toast } from "sonner";

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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AssetType = "bike" | "equipment" | "other";
type AssetMethod = "straight_line" | "declining_balance";
type OriginalCondition = "new" | "used";
type PrivateUseType = "personal" | "income_generation" | "mixed";

export type EditableFixedAsset = {
  id: number;
  name: string;
  assetType: AssetType;
  method: AssetMethod;
  acquisitionSource: "transaction" | "private_contribution";
  serialNumber: string | null;
  acquisitionDate: string;
  originalAcquisitionDate: string | null;
  originalAcquisitionCostCents: number | null;
  originalUsefulLifeMonths: number | null;
  originalCondition: OriginalCondition | null;
  privateUseType: PrivateUseType | null;
  preEntryDepreciationCents: number;
  acquisitionCostCents: number;
  inServiceDate: string;
  usefulLifeMonths: number;
};

export function FixedAssetEditLauncher({
  asset,
  trigger,
}: {
  asset: EditableFixedAsset;
  trigger?: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Bearbeiten
        </Button>
      )}
      <FixedAssetEditDialog asset={asset} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function FixedAssetEditDialog({
  asset,
  open,
  onOpenChange,
}: {
  asset: EditableFixedAsset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(asset.name);
  const [assetType, setAssetType] = useState<AssetType>(asset.assetType);
  const [method, setMethod] = useState<AssetMethod>(asset.method);
  const [originalAcquisitionDate, setOriginalAcquisitionDate] = useState(asset.originalAcquisitionDate ?? "");
  const [originalAcquisitionCost, setOriginalAcquisitionCost] = useState(
    asset.originalAcquisitionCostCents === null ? "" : (asset.originalAcquisitionCostCents / 100).toFixed(2),
  );
  const [originalUsefulLifeMonths, setOriginalUsefulLifeMonths] = useState(
    asset.originalUsefulLifeMonths === null ? "" : String(asset.originalUsefulLifeMonths),
  );
  const [originalCondition, setOriginalCondition] = useState<OriginalCondition | "">(asset.originalCondition ?? "");
  const [privateUseType, setPrivateUseType] = useState<PrivateUseType>(asset.privateUseType ?? "personal");
  const [serialNumber, setSerialNumber] = useState(asset.serialNumber ?? "");
  const [inServiceDate, setInServiceDate] = useState(asset.inServiceDate);
  const [usefulLifeMonths, setUsefulLifeMonths] = useState(String(asset.usefulLifeMonths));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const life = Number(usefulLifeMonths);
    if (!name.trim() || !inServiceDate || !Number.isSafeInteger(life) || life < 1) {
      setError("Bitte prüfe Bezeichnung, Inbetriebnahmedatum und Nutzungsdauer.");
      return;
    }
    const originalCostCents = originalAcquisitionCost.trim()
      ? Math.round(Number(originalAcquisitionCost.replace(",", ".")) * 100)
      : null;
    const originalLife = originalUsefulLifeMonths.trim() ? Number(originalUsefulLifeMonths) : null;
    if (
      asset.acquisitionSource === "private_contribution" &&
      method === "declining_balance" &&
      (!originalAcquisitionDate ||
        originalCostCents === null ||
        !Number.isSafeInteger(originalCostCents) ||
        originalCostCents <= 0 ||
        originalLife === null ||
        !Number.isSafeInteger(originalLife) ||
        originalLife < 1 ||
        !originalCondition)
    ) {
      setError(
        "Für degressive AfA müssen ursprüngliches Anschaffungsdatum, Anschaffungskosten, Zustand und Nutzungsdauer vollständig sein.",
      );
      return;
    }
    const privateAuditDataProvided =
      asset.acquisitionSource === "private_contribution" &&
      Boolean(
        originalAcquisitionDate ||
        originalCostCents !== null ||
        originalLife !== null ||
        originalCondition ||
        asset.privateUseType !== null,
      );
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/financial/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          assetType,
          method,
          serialNumber,
          inServiceDate,
          usefulLifeMonths: life,
          ...(asset.acquisitionSource === "private_contribution" && privateAuditDataProvided
            ? {
                originalAcquisitionDate: originalAcquisitionDate || null,
                originalAcquisitionCostCents: originalCostCents,
                originalUsefulLifeMonths: originalLife,
                originalCondition: originalCondition || null,
                privateUseType,
              }
            : asset.acquisitionSource === "private_contribution"
              ? {
                  originalAcquisitionDate: null,
                  originalAcquisitionCostCents: null,
                  originalUsefulLifeMonths: null,
                  originalCondition: null,
                  privateUseType: null,
                }
              : {}),
        }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Das Anlagegut konnte nicht geändert werden.");
      toast.success("Anlagegut wurde geändert.");
      onOpenChange(false);
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Das Anlagegut konnte nicht geändert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-xl">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Anlagegut bearbeiten</DialogTitle>
            <DialogDescription>
              {asset.acquisitionSource === "private_contribution"
                ? `Einlage: ${asset.acquisitionDate} · Ursprüngliche Anschaffung: ${asset.originalAcquisitionDate ?? "nicht hinterlegt"}`
                : `Anschaffung: ${asset.acquisitionDate}`}{" "}
              · Anschaffungskosten: {(asset.acquisitionCostCents / 100).toFixed(2)} €
              {asset.acquisitionSource === "private_contribution" && asset.preEntryDepreciationCents > 0
                ? ` · rechnerische Vor-AfA: ${(asset.preEntryDepreciationCents / 100).toFixed(2)} €`
                : null}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="mt-6">
            <Field>
              <FieldLabel htmlFor={`fixed-asset-name-${asset.id}`}>Bezeichnung</FieldLabel>
              <Input
                id={`fixed-asset-name-${asset.id}`}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`fixed-asset-type-${asset.id}`}>Anlageart</FieldLabel>
                <Select
                  items={[
                    { value: "bike", label: "Fahrrad" },
                    { value: "equipment", label: "Betriebsausstattung" },
                    { value: "other", label: "Sonstiges" },
                  ]}
                  value={assetType}
                  onValueChange={(value) => setAssetType((value || "other") as AssetType)}
                >
                  <SelectTrigger id={`fixed-asset-type-${asset.id}`} className="w-full">
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
                <FieldLabel htmlFor={`fixed-asset-serial-${asset.id}`}>
                  {assetType === "bike" ? "Rahmennummer" : "Seriennummer"}
                </FieldLabel>
                <Input
                  id={`fixed-asset-serial-${asset.id}`}
                  value={serialNumber}
                  onChange={(event) => setSerialNumber(event.target.value)}
                />
              </Field>
            </div>
            {asset.acquisitionSource === "private_contribution" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`fixed-asset-original-date-${asset.id}`}>
                      Ursprüngliches Anschaffungsdatum
                    </FieldLabel>
                    <Input
                      id={`fixed-asset-original-date-${asset.id}`}
                      required={method === "declining_balance"}
                      type="date"
                      max={asset.acquisitionDate}
                      value={originalAcquisitionDate}
                      onChange={(event) => setOriginalAcquisitionDate(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`fixed-asset-original-cost-${asset.id}`}>
                      Ursprüngliche Anschaffungskosten in Euro
                    </FieldLabel>
                    <Input
                      id={`fixed-asset-original-cost-${asset.id}`}
                      required={method === "declining_balance"}
                      min="0.01"
                      step="0.01"
                      type="number"
                      value={originalAcquisitionCost}
                      onChange={(event) => setOriginalAcquisitionCost(event.target.value)}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor={`fixed-asset-original-condition-${asset.id}`}>
                    Zustand beim privaten Kauf
                  </FieldLabel>
                  <Select
                    items={[
                      { value: "new", label: "Neu" },
                      { value: "used", label: "Gebraucht" },
                    ]}
                    value={originalCondition || "used"}
                    onValueChange={(value) => setOriginalCondition((value || "used") as OriginalCondition)}
                  >
                    <SelectTrigger id={`fixed-asset-original-condition-${asset.id}`} className="w-full">
                      <SelectValue>{(value) => (value === "new" ? "Neu" : "Gebraucht")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="new">Neu</SelectItem>
                        <SelectItem value="used">Gebraucht</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`fixed-asset-original-life-${asset.id}`}>
                      Ursprüngliche Nutzungsdauer in Monaten
                    </FieldLabel>
                    <Input
                      id={`fixed-asset-original-life-${asset.id}`}
                      required={method === "declining_balance"}
                      min="1"
                      step="1"
                      type="number"
                      value={originalUsefulLifeMonths}
                      onChange={(event) => setOriginalUsefulLifeMonths(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`fixed-asset-use-type-${asset.id}`}>Nutzung vor der Einlage</FieldLabel>
                    <Select
                      items={[
                        { value: "personal", label: "Privat / keine Einkünfte" },
                        { value: "income_generation", label: "Zur Einkunftserzielung" },
                        { value: "mixed", label: "Gemischt" },
                      ]}
                      value={privateUseType}
                      onValueChange={(value) => setPrivateUseType((value || "personal") as PrivateUseType)}
                    >
                      <SelectTrigger id={`fixed-asset-use-type-${asset.id}`} className="w-full">
                        <SelectValue>
                          {(value) =>
                            value === "income_generation"
                              ? "Zur Einkunftserzielung"
                              : value === "mixed"
                                ? "Gemischt"
                                : "Privat / keine Einkünfte"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="personal">Privat / keine Einkünfte</SelectItem>
                          <SelectItem value="income_generation">Zur Einkunftserzielung</SelectItem>
                          <SelectItem value="mixed">Gemischt</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bei einer Privateinlage prüft die Software die fortgeführten Anschaffungskosten und die zulässige
                  Restnutzungsdauer. Für alte lineare Datensätze dürfen die neuen Nachweise zunächst leer bleiben.
                </p>
              </>
            ) : null}
            <Field>
              <FieldLabel htmlFor={`fixed-asset-method-${asset.id}`}>AfA-Verfahren</FieldLabel>
              <Select
                items={[
                  { value: "straight_line", label: "Linear" },
                  { value: "declining_balance", label: "Degressiv vom Restbuchwert" },
                ]}
                value={method}
                onValueChange={(value) => setMethod((value || "straight_line") as AssetMethod)}
              >
                <SelectTrigger id={`fixed-asset-method-${asset.id}`} className="w-full">
                  <SelectValue>
                    {(value) => (value === "declining_balance" ? "Degressiv vom Restbuchwert" : "Linear")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="straight_line">Linear</SelectItem>
                    <SelectItem value="declining_balance">Degressiv vom Restbuchwert</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ein Wechsel korrigiert bereits gebuchte AfA über Storno- und Neubuchungen. Linear → degressiv ist
                steuerlich nur als dokumentierte Korrektur nach Prüfung zu verwenden.
              </p>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`fixed-asset-service-date-${asset.id}`}>Inbetriebnahme</FieldLabel>
                <Input
                  id={`fixed-asset-service-date-${asset.id}`}
                  required
                  type="date"
                  value={inServiceDate}
                  onChange={(event) => setInServiceDate(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`fixed-asset-life-${asset.id}`}>Nutzungsdauer in Monaten</FieldLabel>
                <Input
                  id={`fixed-asset-life-${asset.id}`}
                  required
                  min="1"
                  step="1"
                  type="number"
                  value={usefulLifeMonths}
                  onChange={(event) => setUsefulLifeMonths(event.target.value)}
                />
              </Field>
            </div>
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
              {busy ? "Wird gespeichert…" : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
