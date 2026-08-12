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

type Asset = {
  id: number;
  location: string;
  label: string;
  nickname: string | null;
  modelLabel: string;
  priceCents: number;
};
type Item = {
  key: number;
  requestedLabel: string;
  heightCm: string;
  needsPedals: boolean;
  pedalType: string;
  needsComputerMount: boolean;
  computerMountType: string;
  needsHelmet: boolean;
  needsClothing: boolean;
  assetId: string;
};
const locations = [
  ["munich", "München"],
  ["regensburg", "Regensburg"],
  ["lindau", "Lindau"],
  ["friedrichshafen", "Friedrichshafen"],
  ["konstanz", "Konstanz"],
] as const;
const emptyItem = (key: number): Item => ({
  key,
  requestedLabel: "",
  heightCm: "",
  needsPedals: false,
  pedalType: "",
  needsComputerMount: false,
  computerMountType: "",
  needsHelmet: false,
  needsClothing: false,
  assetId: "",
});

function BikeOptionLabel({ asset }: { asset: Asset }) {
  return (
    <span>
      {asset.nickname ? <strong>{asset.nickname}</strong> : null}
      {asset.nickname ? " · " : null}
      <span>{asset.modelLabel}</span> · {formatEuro(asset.priceCents)} / Tag
    </span>
  );
}

export function ManualBookingForm({ assets }: { assets: Asset[] }) {
  const [mode, setMode] = useState<"inquiry" | "direct">("inquiry");
  const [location, setLocation] = useState("munich");
  const [locale, setLocale] = useState<"de" | "en">("de");
  const [items, setItems] = useState<Item[]>([emptyItem(1)]);
  const [estimateEuro, setEstimateEuro] = useState("");
  const [busy, setBusy] = useState(false);
  const availableAssets = useMemo(() => assets.filter((asset) => asset.location === location), [assets, location]);
  const update = (key: number, updateItem: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...updateItem } : item)));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quotedTotalCents = euroToCents(estimateEuro);
    if (quotedTotalCents === null) return toast.error("Bitte gib die unverbindliche Schätzung als Euro-Betrag ein.");
    if (items.some((item) => !item.requestedLabel.trim() || !Number.isInteger(Number(item.heightCm))))
      return toast.error("Bitte vervollständige jede Fahrradposition.");
    if (mode === "direct" && items.some((item) => !item.assetId))
      return toast.error("Für eine Direktbuchung muss jedes Fahrrad konkret ausgewählt sein.");
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
      })),
      ...(mode === "direct"
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
      if (!response.ok || !result?.id) throw new Error(result?.message ?? "Buchung konnte nicht angelegt werden.");
      window.location.assign(`/admin/bookings/${result.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Buchung konnte nicht angelegt werden.");
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
              <Input id="name" name="name" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">E-Mail</FieldLabel>
              <Input id="email" name="email" type="email" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Telefon</FieldLabel>
              <Input id="phone" name="phone" required />
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
                  setItems((current) => current.map((item) => ({ ...item, assetId: "" })));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{locations.find(([value]) => value === location)?.[1] ?? "Standort"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {locations.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="estimate">Unverbindliche Schätzung in Euro</FieldLabel>
              <Input
                id="estimate"
                inputMode="decimal"
                placeholder="0,00"
                value={estimateEuro}
                onChange={(event) => setEstimateEuro(event.target.value)}
                required
              />
              <FieldDescription>
                Bei einem konkreten Angebot oder einer Direktbuchung wird der Preis serverseitig neu berechnet.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="period-from">Abholung</FieldLabel>
              <Input id="period-from" name="periodFrom" type="date" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="period-to">Rückgabe</FieldLabel>
              <Input id="period-to" name="periodTo" type="date" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="pickup-time">Abholzeit</FieldLabel>
              <Input id="pickup-time" name="pickupTime" type="time" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="dropoff-time">Rückgabezeit</FieldLabel>
              <Input id="dropoff-time" name="dropoffTime" type="time" required />
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
                  <Input
                    value={item.requestedLabel}
                    onChange={(event) => update(item.key, { requestedLabel: event.target.value })}
                    required
                  />
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
                {mode === "direct" && (
                  <Field className="md:col-span-2">
                    <FieldLabel>Konkretes Fahrrad</FieldLabel>
                    <Select value={item.assetId} onValueChange={(value) => update(item.key, { assetId: value ?? "" })}>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(() => {
                            const asset = availableAssets.find((candidate) => String(candidate.id) === item.assetId);
                            return asset ? <BikeOptionLabel asset={asset} /> : "Aktives Asset auswählen";
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
          <Textarea name="message" placeholder="Zusätzliche Hinweise zur Buchung" />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button disabled={busy} type="submit">
          {busy ? "Wird angelegt…" : mode === "direct" ? "Verbindlich buchen" : "Anfrage anlegen"}
        </Button>
      </div>
    </form>
  );
}
