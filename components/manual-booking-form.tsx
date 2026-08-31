"use client";

import { FormEvent, useMemo, useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { euroToCents, formatEuro } from "@/lib/bookings/money";
import {
  calculateEquipmentSubtotalCents,
  calculatePrice,
  getBikePriceScheduleCents,
  getRentalDays,
} from "@/lib/inventory/pricing";

export type ManualBookingAsset = {
  id: number;
  location: string;
  label: string;
  nickname: string | null;
  modelLabel: string;
  priceCents: number;
  isBookable: boolean;
  state: "active" | "maintenance" | "retired";
};
export type ManualBookingItem = {
  key: number;
  requestedLabel: string;
  heightCm: string;
  needsPedals: boolean;
  pedalType: string;
  needsComputerMount: boolean;
  computerMountType: string;
  needsHelmet: boolean;
  needsClothing: boolean;
  needsBikepackingBag: boolean;
  needsGlasses: boolean;
  bottleHolderIncluded: boolean;
  repairKitIncluded: boolean;
  insuranceProtectionSelected: boolean;
  assetId: string;
};
export type ManualBookingPricing = {
  bikePrices: Array<{
    option: string;
    weekdayPriceCents: number;
    weekendPriceCents: number;
  }>;
  equipmentPrices: Array<{ key: string; priceCents: number }>;
  discounts: Array<{
    key: string;
    percentage: number;
    weekdayFrom: number | null;
    weekdayTo: number | null;
    minimumRentalDays: number | null;
    requiresStudent: boolean;
    isStackable: boolean;
  }>;
};
const locations = [
  ["munich", "München"],
  ["regensburg", "Regensburg"],
  ["lindau", "Lindau"],
  ["friedrichshafen", "Friedrichshafen"],
  ["konstanz", "Konstanz"],
] as const;
const emptyItem = (key: number): ManualBookingItem => ({
  key,
  requestedLabel: "",
  heightCm: "",
  needsPedals: false,
  pedalType: "",
  needsComputerMount: false,
  computerMountType: "",
  needsHelmet: false,
  needsClothing: false,
  needsBikepackingBag: false,
  needsGlasses: false,
  bottleHolderIncluded: true,
  repairKitIncluded: true,
  insuranceProtectionSelected: true,
  assetId: "",
});

function BikeOptionLabel({ asset }: { asset: ManualBookingAsset }) {
  return (
    <span>
      {asset.nickname ? <strong>{asset.nickname}</strong> : null}
      {asset.nickname ? " · " : null}
      <span>{asset.modelLabel}</span> · {formatEuro(asset.priceCents)} / Tag
      {asset.state !== "active" ? ` · ${asset.state === "retired" ? "ausgemustert" : "Wartung"}` : ""}
    </span>
  );
}

export type ManualBookingInitialValues = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  locale?: "de" | "en";
  periodFrom?: string;
  periodTo?: string;
  pickupTime?: string;
  dropoffTime?: string;
  message?: string;
  items?: Array<Partial<Omit<ManualBookingItem, "key">>>;
};

export function ManualBookingForm({
  assets,
  pricingByLocation,
  initialValues,
}: {
  assets: ManualBookingAsset[];
  pricingByLocation: Record<string, ManualBookingPricing>;
  initialValues?: ManualBookingInitialValues;
}) {
  const availableLocations = locations.filter(([value]) => pricingByLocation[value]);
  const [mode, setMode] = useState<"inquiry" | "direct" | "historical">("inquiry");
  const [location, setLocation] = useState(initialValues?.location ?? availableLocations[0]?.[0] ?? "munich");
  const [locale, setLocale] = useState<"de" | "en">(initialValues?.locale ?? "de");
  const [items, setItems] = useState<ManualBookingItem[]>(
    initialValues?.items?.length
      ? initialValues.items.map((item, index) => ({ ...emptyItem(index + 1), ...item, key: index + 1 }))
      : [emptyItem(1)],
  );
  const [periodFrom, setPeriodFrom] = useState(initialValues?.periodFrom ?? "");
  const [periodTo, setPeriodTo] = useState(initialValues?.periodTo ?? "");
  const [historicalTotal, setHistoricalTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const availableAssets = useMemo(
    () => assets.filter((asset) => asset.location === location && (mode === "historical" || asset.isBookable)),
    [assets, location, mode],
  );
  const availableBikeOptions = useMemo(() => {
    const pricingOptions = pricingByLocation[location]?.bikePrices.map((bike) => bike.option) ?? [];
    const assetOptions = availableAssets.map((asset) => asset.modelLabel);
    return [...new Set([...pricingOptions, ...assetOptions])];
  }, [availableAssets, location, pricingByLocation]);
  const calculatedEstimateCents = useMemo(() => {
    const pricing = pricingByLocation[location];
    if (!pricing) return 0;
    if (!periodFrom || !periodTo) return 0;
    const rentalDays = getRentalDays(periodFrom, periodTo);
    const bikePriceSchedules = items.map(
      (item) =>
        getBikePriceScheduleCents(pricing, item.requestedLabel) ?? {
          weekdayPriceCents: 0,
          weekendPriceCents: 0,
        },
    );
    const equipmentSubtotalCents = calculateEquipmentSubtotalCents(pricing, items);
    const price = calculatePrice(pricing, {
      bikes: bikePriceSchedules,
      equipmentSubtotalCents,
      periodFrom,
      rentalDays,
    });
    return price.totalCents;
  }, [items, location, periodFrom, periodTo, pricingByLocation]);
  const update = (key: number, updateItem: Partial<ManualBookingItem>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...updateItem } : item)));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quotedTotalCents = mode === "historical" ? euroToCents(historicalTotal) : calculatedEstimateCents;
    if (quotedTotalCents === null || quotedTotalCents === undefined)
      return toast.error("Bitte gib einen gültigen Gesamtpreis ein.");
    if (items.some((item) => !item.requestedLabel.trim() || !Number.isInteger(Number(item.heightCm))))
      return toast.error("Bitte vervollständige jede Fahrradposition.");
    if ((mode === "direct" || mode === "historical") && items.some((item) => !item.assetId))
      return toast.error("Für diesen Modus muss jedes Fahrrad konkret ausgewählt sein.");
    const payload = {
      mode,
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      location,
      locale,
      periodFrom: form.get("periodFrom"),
      periodTo: form.get("periodTo"),
      pickupTime: form.get("pickupTime"),
      dropoffTime: form.get("dropoffTime"),
      message: form.get("message"),
      quotedTotalCents,
      requestedItems: items.map((item) => ({
        requestedLabel: item.requestedLabel.trim(),
        heightCm: Number(item.heightCm),
        needsPedals: item.needsPedals,
        pedalType: item.needsPedals ? item.pedalType || null : null,
        needsComputerMount: item.needsComputerMount,
        computerMountType: item.needsComputerMount ? item.computerMountType || null : null,
        needsHelmet: item.needsHelmet,
        needsClothing: item.needsClothing,
        needsBikepackingBag: item.needsBikepackingBag,
        needsGlasses: item.needsGlasses,
        bottleHolderIncluded: item.bottleHolderIncluded,
        repairKitIncluded: item.repairKitIncluded,
        insuranceProtectionSelected: item.insuranceProtectionSelected,
      })),
      ...(mode === "direct"
        ? {
            assetsByPosition: Object.fromEntries(items.map((item, index) => [String(index + 1), Number(item.assetId)])),
          }
        : {}),
      ...(mode === "historical"
        ? {
            assetsByPosition: Object.fromEntries(items.map((item, index) => [String(index + 1), Number(item.assetId)])),
          }
        : {}),
    };
    try {
      setBusy(true);
      const response = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { id?: number; message?: string } | null;
      if (!response.ok || !result?.id)
        throw new Error(
          result?.message ??
            "Die Buchung konnte nicht angelegt werden. Prüfe Kundendaten, Zeitraum, Gesamtpreis und Fahrradauswahl.",
        );
      window.location.assign(`/admin/bookings/${result.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Die Buchung konnte nicht angelegt werden. Prüfe Kundendaten, Zeitraum, Gesamtpreis und Fahrradauswahl.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>Modus</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant={mode === "inquiry" ? "default" : "outline"} onClick={() => setMode("inquiry")}>
            Anfrage erfassen
          </Button>
          <Button type="button" variant={mode === "direct" ? "default" : "outline"} onClick={() => setMode("direct")}>
            Direkt verbindlich buchen
          </Button>
          <Button
            type="button"
            variant={mode === "historical" ? "default" : "outline"}
            onClick={() => setMode("historical")}
          >
            Abgeschlossene Buchung nachtragen
          </Button>
          {mode === "historical" ? (
            <FieldDescription className="basis-full">
              Für eine bereits durchgeführte Buchung werden die ursprünglichen Daten, das tatsächlich vermietete Fahrrad
              und eine automatisch vergebene Rechnungsnummer gespeichert. Es wird keine Kund:innen-Mail versendet.
            </FieldDescription>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Kund:in und Zeitraum</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" defaultValue={initialValues?.name} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">E-Mail</FieldLabel>
              <Input id="email" name="email" type="email" defaultValue={initialValues?.email} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Telefon</FieldLabel>
              <Input id="phone" name="phone" defaultValue={initialValues?.phone} required />
            </Field>
            <Field>
              <FieldLabel>Kommunikationssprache</FieldLabel>
              <Select value={locale} onValueChange={(value) => setLocale((value ?? "de") as "de" | "en")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{locale === "de" ? "Deutsch" : "English"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Standort</FieldLabel>
              <Select
                value={location}
                onValueChange={(value) => {
                  setLocation(value ?? "munich");
                  setItems((current) => current.map((item) => ({ ...item, requestedLabel: "", assetId: "" })));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{locations.find(([value]) => value === location)?.[1] ?? "Standort"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableLocations.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={mode === "historical" ? "historical-total" : "estimate"}>
                {mode === "historical" ? "Tatsächlicher Gesamtpreis in Euro" : "Schätzung in Euro"}
              </FieldLabel>
              {mode === "historical" ? (
                <Input
                  id="historical-total"
                  inputMode="decimal"
                  value={historicalTotal}
                  onChange={(event) => setHistoricalTotal(event.target.value)}
                  placeholder="z. B. 120,00"
                  required
                />
              ) : (
                <Input
                  id="estimate"
                  inputMode="decimal"
                  value={periodFrom && periodTo ? formatEuro(calculatedEstimateCents) : "—"}
                  readOnly
                  tabIndex={-1}
                />
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="period-from">Abholung</FieldLabel>
              <Input
                id="period-from"
                name="periodFrom"
                type="date"
                value={periodFrom}
                onChange={(event) => setPeriodFrom(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="period-to">Rückgabe</FieldLabel>
              <Input
                id="period-to"
                name="periodTo"
                type="date"
                value={periodTo}
                onChange={(event) => setPeriodTo(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pickup-time">Abholzeit</FieldLabel>
              <Input id="pickup-time" name="pickupTime" type="time" defaultValue={initialValues?.pickupTime} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="dropoff-time">Rückgabezeit</FieldLabel>
              <Input
                id="dropoff-time"
                name="dropoffTime"
                type="time"
                defaultValue={initialValues?.dropoffTime}
                required
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Angefragte Fahrräder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div className="rounded-3xl border bg-muted/25 p-4" key={item.key}>
              <div className="mb-4 flex items-center justify-between">
                <p className="font-medium">Fahrrad {index + 1}</p>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))}
                  >
                    <MinusIcon /> Entfernen
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Gewünschtes Modell / Größe</FieldLabel>
                  <Select
                    value={item.requestedLabel}
                    onValueChange={(value) => update(item.key, { requestedLabel: value ?? "" })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Modell / Größe auswählen">
                        {item.requestedLabel || "Modell / Größe auswählen"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {availableBikeOptions.length ? (
                        availableBikeOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__no-bike-option" disabled>
                          Keine Modelle / Größen verfügbar
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Körpergröße in cm</FieldLabel>
                  <Input
                    type="number"
                    min="100"
                    max="250"
                    value={item.heightCm}
                    onChange={(event) => update(item.key, { heightCm: event.target.value })}
                    required
                  />
                </Field>
                {(mode === "direct" || mode === "historical") && (
                  <Field className="md:col-span-2">
                    <FieldLabel>
                      {mode === "historical" ? "Tatsächlich vermietetes Fahrrad" : "Konkretes Fahrrad"}
                    </FieldLabel>
                    <Select value={item.assetId} onValueChange={(value) => update(item.key, { assetId: value ?? "" })}>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(() => {
                            const asset = availableAssets.find((candidate) => String(candidate.id) === item.assetId);
                            return asset ? (
                              <BikeOptionLabel asset={asset} />
                            ) : mode === "historical" ? (
                              "Fahrrad auswählen"
                            ) : (
                              "Aktives Fahrrad auswählen"
                            );
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {availableAssets.map((asset) => (
                          <SelectItem
                            key={asset.id}
                            value={String(asset.id)}
                            disabled={items.some(
                              (other) => other.key !== item.key && other.assetId === String(asset.id),
                            )}
                          >
                            <BikeOptionLabel asset={asset} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.needsPedals}
                    onCheckedChange={(checked) => update(item.key, { needsPedals: checked })}
                  />{" "}
                  Pedale benötigt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.needsComputerMount}
                    onCheckedChange={(checked) => update(item.key, { needsComputerMount: checked })}
                  />{" "}
                  Computerhalterung benötigt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.needsHelmet}
                    onCheckedChange={(checked) => update(item.key, { needsHelmet: checked })}
                  />{" "}
                  Helm benötigt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.needsClothing}
                    onCheckedChange={(checked) => update(item.key, { needsClothing: checked })}
                  />{" "}
                  Kleidung benötigt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.needsBikepackingBag}
                    onCheckedChange={(checked) => update(item.key, { needsBikepackingBag: checked })}
                  />{" "}
                  Bikepacking-Tasche benötigt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.needsGlasses}
                    onCheckedChange={(checked) => update(item.key, { needsGlasses: checked })}
                  />{" "}
                  Brille benötigt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.bottleHolderIncluded}
                    onCheckedChange={(checked) => update(item.key, { bottleHolderIncluded: checked })}
                  />{" "}
                  Flaschenhalter inklusive
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.repairKitIncluded}
                    onCheckedChange={(checked) => update(item.key, { repairKitIncluded: checked })}
                  />{" "}
                  Reparaturset inklusive
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.insuranceProtectionSelected}
                    onCheckedChange={(checked) => update(item.key, { insuranceProtectionSelected: checked })}
                  />{" "}
                  Versicherungsschutz ausgewählt
                </label>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setItems((current) => [...current, emptyItem(Math.max(...current.map((item) => item.key), 0) + 1)])
            }
          >
            <PlusIcon /> Fahrrad hinzufügen
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Interne Notiz</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            name="message"
            defaultValue={initialValues?.message}
            placeholder="Zusätzliche Hinweise zur Buchung"
          />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button disabled={busy} type="submit">
          {busy
            ? "Wird angelegt…"
            : mode === "direct"
              ? "Verbindlich buchen"
              : mode === "historical"
                ? "Abgeschlossene Buchung speichern"
                : "Anfrage anlegen"}
        </Button>
      </div>
    </form>
  );
}
