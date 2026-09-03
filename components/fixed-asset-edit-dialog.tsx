"use client";

import { useState } from "react";
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

export type EditableFixedAsset = {
  id: number;
  name: string;
  assetType: AssetType;
  serialNumber: string | null;
  acquisitionDate: string;
  acquisitionCostCents: number;
  inServiceDate: string;
  usefulLifeMonths: number;
};

export function FixedAssetEditLauncher({ asset }: { asset: EditableFixedAsset }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bearbeiten
      </Button>
      <FixedAssetEditDialog asset={asset} open={open} onOpenChange={setOpen} />
    </>
  );
}

function FixedAssetEditDialog({
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
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/financial/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, assetType, serialNumber, inServiceDate, usefulLifeMonths: life }),
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
              Anschaffung: {asset.acquisitionDate} · Anschaffungskosten: {(asset.acquisitionCostCents / 100).toFixed(2)}{" "}
              €
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
                <Select value={assetType} onValueChange={(value) => setAssetType((value || "other") as AssetType)}>
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
