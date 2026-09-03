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
import { berlinDateKey } from "@/lib/datetime";

function today() {
  return berlinDateKey();
}

export function PrivateAssetContributionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<"bike" | "equipment" | "other">("bike");
  const [date, setDate] = useState(today());
  const [inServiceDate, setInServiceDate] = useState(today());
  const [value, setValue] = useState("");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("84");
  const [serialNumber, setSerialNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setAssetType("bike");
    setDate(today());
    setInServiceDate(today());
    setValue("");
    setUsefulLifeMonths("84");
    setSerialNumber("");
    setError(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const acquisitionCostCents = Math.round(Number(value.replace(",", ".")) * 100);
    const life = Number(usefulLifeMonths);
    if (
      !Number.isSafeInteger(acquisitionCostCents) ||
      acquisitionCostCents <= 0 ||
      !Number.isSafeInteger(life) ||
      life < 1
    ) {
      setError("Bitte gib einen gültigen Einlagewert und eine Nutzungsdauer ein.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/admin/financial/assets/private-contribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          assetType,
          acquisitionDate: date,
          inServiceDate,
          acquisitionCostCents,
          usefulLifeMonths: life,
          serialNumber,
        }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok)
        throw new Error(
          result?.message ??
            "Die Privateinlage konnte nicht gespeichert werden. Prüfe Anlageart, Betrag, Anschaffungsdatum und Nutzungsdauer.",
        );
      toast.success("Privateinlage wurde im Anlageverzeichnis erfasst.");
      reset();
      onOpenChange(false);
      window.location.reload();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Die Privateinlage konnte nicht gespeichert werden. Prüfe Anlageart, Betrag, Anschaffungsdatum und Nutzungsdauer.",
      );
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
      <DialogContent className="max-w-xl">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Privateinlage erfassen</DialogTitle>
            <DialogDescription>
              Das Fahrrad wird ohne Kassenbewegung als Anlagevermögen und Eigenkapital erfasst.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="mt-6">
            <Field>
              <FieldLabel htmlFor="private-asset-name">Bezeichnung</FieldLabel>
              <Input
                id="private-asset-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="z. B. Canyon Endurace M"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="private-asset-type">Anlageart</FieldLabel>
                <Select
                  value={assetType}
                  onValueChange={(value) => setAssetType((value || "bike") as "bike" | "equipment" | "other")}
                >
                  <SelectTrigger id="private-asset-type" className="w-full">
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
                <FieldLabel htmlFor="private-asset-value">Einlagewert in Euro</FieldLabel>
                <Input
                  id="private-asset-value"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="private-asset-date">Einlagedatum</FieldLabel>
                <Input
                  id="private-asset-date"
                  required
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="private-asset-service-date">Inbetriebnahme</FieldLabel>
                <Input
                  id="private-asset-service-date"
                  required
                  type="date"
                  value={inServiceDate}
                  onChange={(event) => setInServiceDate(event.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="private-asset-life">Verbleibende Nutzungsdauer in Monaten</FieldLabel>
                <Input
                  id="private-asset-life"
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={usefulLifeMonths}
                  onChange={(event) => setUsefulLifeMonths(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="private-asset-serial">
                  {assetType === "bike" ? "Rahmennummer" : "Seriennummer"}
                </FieldLabel>
                <Input
                  id="private-asset-serial"
                  value={serialNumber}
                  onChange={(event) => setSerialNumber(event.target.value)}
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
              {busy ? "Speichern…" : "Privateinlage speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PrivateAssetContributionLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Privateinlage erfassen
      </Button>
      <PrivateAssetContributionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
