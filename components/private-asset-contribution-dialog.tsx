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
import { ScrollArea } from "@/components/ui/scroll-area";
import { berlinDateKey } from "@/lib/datetime";

type AssetMethod = "straight_line" | "declining_balance";
type OriginalCondition = "new" | "used";
type PrivateUseType = "personal" | "income_generation" | "mixed";

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
  const [originalAcquisitionDate, setOriginalAcquisitionDate] = useState(today());
  const [contributionDate, setContributionDate] = useState(today());
  const [inServiceDate, setInServiceDate] = useState(today());
  const [value, setValue] = useState("");
  const [originalAcquisitionCost, setOriginalAcquisitionCost] = useState("");
  const [originalUsefulLifeMonths, setOriginalUsefulLifeMonths] = useState("84");
  const [originalCondition, setOriginalCondition] = useState<OriginalCondition>("used");
  const [privateUseType, setPrivateUseType] = useState<PrivateUseType>("personal");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("84");
  const [method, setMethod] = useState<AssetMethod>("straight_line");
  const [serialNumber, setSerialNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setAssetType("bike");
    setOriginalAcquisitionDate(today());
    setContributionDate(today());
    setInServiceDate(today());
    setValue("");
    setOriginalAcquisitionCost("");
    setOriginalUsefulLifeMonths("84");
    setOriginalCondition("used");
    setPrivateUseType("personal");
    setUsefulLifeMonths("84");
    setMethod("straight_line");
    setSerialNumber("");
    setError(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const acquisitionCostCents = Math.round(Number(value.replace(",", ".")) * 100);
    const originalAcquisitionCostCents = Math.round(Number(originalAcquisitionCost.replace(",", ".")) * 100);
    const originalLife = Number(originalUsefulLifeMonths);
    const life = Number(usefulLifeMonths);
    if (
      !Number.isSafeInteger(acquisitionCostCents) ||
      acquisitionCostCents <= 0 ||
      !Number.isSafeInteger(originalAcquisitionCostCents) ||
      originalAcquisitionCostCents <= 0 ||
      !Number.isSafeInteger(originalLife) ||
      originalLife < 1 ||
      !Number.isSafeInteger(life) ||
      life < 1
    ) {
      setError("Bitte gib Einlagewert, ursprüngliche Anschaffungskosten sowie gültige Nutzungsdauern ein.");
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
          originalAcquisitionDate,
          contributionDate,
          inServiceDate,
          acquisitionCostCents,
          originalAcquisitionCostCents,
          originalUsefulLifeMonths: originalLife,
          originalCondition,
          privateUseType,
          usefulLifeMonths: life,
          method,
          serialNumber,
        }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok)
        throw new Error(
          result?.message ??
            "Die Privateinlage konnte nicht gespeichert werden. Prüfe ursprüngliche Anschaffungskosten, Vor-Nutzung, Einlagewert und Nutzungsdauern.",
        );
      toast.success("Privateinlage wurde im Anlageverzeichnis erfasst.");
      reset();
      onOpenChange(false);
      window.location.reload();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Die Privateinlage konnte nicht gespeichert werden. Prüfe ursprüngliche Anschaffungskosten, Vor-Nutzung, Einlagewert und Nutzungsdauern.",
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl grid-rows-[auto_minmax(0,1fr)_auto_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Privateinlage erfassen</DialogTitle>
          <DialogDescription>
            Das Fahrrad wird ohne Kassenbewegung als Anlagevermögen und Eigenkapital erfasst.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 pr-2">
          <form id="private-asset-contribution-form" onSubmit={save}>
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
                    items={[
                      { value: "bike", label: "Fahrrad" },
                      { value: "equipment", label: "Betriebsausstattung" },
                      { value: "other", label: "Sonstiges" },
                    ]}
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
                  <FieldLabel htmlFor="private-asset-original-date">Ursprüngliches Anschaffungsdatum</FieldLabel>
                  <Input
                    id="private-asset-original-date"
                    required
                    type="date"
                    value={originalAcquisitionDate}
                    onChange={(event) => setOriginalAcquisitionDate(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="private-asset-contribution-date">Einlagedatum</FieldLabel>
                  <Input
                    id="private-asset-contribution-date"
                    required
                    type="date"
                    min={originalAcquisitionDate}
                    value={contributionDate}
                    onChange={(event) => setContributionDate(event.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="private-asset-original-cost">
                    Ursprüngliche private Anschaffungskosten in Euro
                  </FieldLabel>
                  <Input
                    id="private-asset-original-cost"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={originalAcquisitionCost}
                    onChange={(event) => setOriginalAcquisitionCost(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nicht der Einlagewert: Daraus berechnet die Software die fortgeführten Anschaffungskosten.
                  </p>
                </Field>
                <Field>
                  <FieldLabel htmlFor="private-asset-original-life">Ursprüngliche Nutzungsdauer in Monaten</FieldLabel>
                  <Input
                    id="private-asset-original-life"
                    required
                    min="1"
                    step="1"
                    type="number"
                    value={originalUsefulLifeMonths}
                    onChange={(event) => setOriginalUsefulLifeMonths(event.target.value)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="private-asset-original-condition">Zustand beim privaten Kauf</FieldLabel>
                <Select
                  items={[
                    { value: "new", label: "Neu" },
                    { value: "used", label: "Gebraucht" },
                  ]}
                  value={originalCondition}
                  onValueChange={(value) => setOriginalCondition((value || "used") as OriginalCondition)}
                >
                  <SelectTrigger id="private-asset-original-condition" className="w-full">
                    <SelectValue>{(value) => (value === "new" ? "Neu" : "Gebraucht")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="new">Neu</SelectItem>
                      <SelectItem value="used">Gebraucht</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Der Zustand ändert die AfA-Methode nicht, wird aber für die Plausibilität der Restnutzungsdauer
                  dokumentiert.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="private-asset-use-type">Nutzung vor der Einlage</FieldLabel>
                <Select
                  items={[
                    { value: "personal", label: "Privat / keine Einkünfte" },
                    { value: "income_generation", label: "Zur Einkunftserzielung" },
                    { value: "mixed", label: "Gemischt" },
                  ]}
                  value={privateUseType}
                  onValueChange={(value) => setPrivateUseType((value || "personal") as PrivateUseType)}
                >
                  <SelectTrigger id="private-asset-use-type" className="w-full">
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
                <p className="text-xs text-muted-foreground">
                  Die Angabe dokumentiert die Vor-Nutzung. Die rechnerische Vor-AfA wird für die Einlagewertprüfung auch
                  ohne private Steuererklärung berücksichtigt.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="private-asset-method">AfA-Verfahren</FieldLabel>
                <Select
                  items={[
                    { value: "straight_line", label: "Linear" },
                    { value: "declining_balance", label: "Degressiv vom Restbuchwert" },
                  ]}
                  value={method}
                  onValueChange={(value) => setMethod((value || "straight_line") as AssetMethod)}
                >
                  <SelectTrigger id="private-asset-method" className="w-full">
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
                  Für die degressive AfA zählt das ursprüngliche Anschaffungsdatum. Die AfA-Bemessungsgrundlage ist der
                  zulässige Einlagewert; innerhalb von drei Jahren prüft die Software zusätzlich die fortgeführten
                  ursprünglichen Anschaffungskosten.
                </p>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="private-asset-service-date" className="sm:min-h-10">
                    Inbetriebnahme
                  </FieldLabel>
                  <Input
                    id="private-asset-service-date"
                    required
                    type="date"
                    value={inServiceDate}
                    onChange={(event) => setInServiceDate(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="private-asset-life" className="sm:min-h-10">
                    Verbleibende Nutzungsdauer in Monaten
                  </FieldLabel>
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
              </div>
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
            </FieldGroup>
          </form>
        </ScrollArea>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter className="mt-6">
          <DialogClose
            render={
              <Button type="button" variant="outline" disabled={busy}>
                Abbrechen
              </Button>
            }
          />
          <Button type="submit" form="private-asset-contribution-form" disabled={busy}>
            {busy ? "Speichern…" : "Privateinlage speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PrivateAssetContributionLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Privateinlage erfassen
      </Button>
      <PrivateAssetContributionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
