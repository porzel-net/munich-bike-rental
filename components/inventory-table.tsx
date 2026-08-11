"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";

import type { AdminInventoryBike, AdminInventoryEquipment } from "@/app/admin/inventory/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type LocationOption = { key: AdminInventoryBike["location"]; label: string };
type InventoryKind = "bike" | "equipment";
type EquipmentCategory = AdminInventoryEquipment["category"];
type EditingItem = (AdminInventoryBike & { kind: "bike" }) | (AdminInventoryEquipment & { kind: "equipment" });
type LocationFilter = "all" | LocationOption["key"];

const euroFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const allLocationsItem = { value: "all", label: "Alle Standorte" } as const;
const categoryLabels: Record<EquipmentCategory, string> = {
  pedal: "Pedale",
  "computer-mount": "Computer-Halterung",
  helmet: "Helm",
  clothing: "Kleidung",
};

function priceToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".00", "");
}

export function InventoryTable({
  initialBikes,
  initialEquipment,
  locations,
  canManageAllLocations,
}: {
  initialBikes: AdminInventoryBike[];
  initialEquipment: AdminInventoryEquipment[];
  locations: LocationOption[];
  canManageAllLocations: boolean;
}) {
  const [bikes, setBikes] = useState(initialBikes);
  const [equipment, setEquipment] = useState(initialEquipment);
  const [kind, setKind] = useState<InventoryKind>("bike");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>(
    canManageAllLocations ? "all" : (locations[0]?.key ?? "all"),
  );
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const locationItems = [
    allLocationsItem,
    ...locations.map((location) => ({
      value: location.key,
      label: location.label,
    })),
  ] as const;
  const selectedLocationLabel =
    locationFilter === "all"
      ? allLocationsItem.label
      : locations.find((location) => location.key === locationFilter)?.label;

  const visibleBikes = useMemo(
    () => (locationFilter === "all" ? bikes : bikes.filter((bike) => bike.location === locationFilter)),
    [bikes, locationFilter],
  );
  const visibleEquipment = useMemo(
    () => (locationFilter === "all" ? equipment : equipment.filter((item) => item.location === locationFilter)),
    [equipment, locationFilter],
  );

  function openCreate(nextKind: InventoryKind) {
    setKind(nextKind);
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEdit(item: EditingItem) {
    setKind(item.kind);
    setEditingItem(item);
    setDialogOpen(true);
  }

  async function toggleAvailability(item: EditingItem) {
    const payload =
      item.kind === "bike"
        ? {
            type: "bike" as const,
            id: item.id,
            location: item.location,
            title: item.title,
            frameNumber: item.frameNumber,
            size: item.size,
            priceCents: item.priceCents,
            discountTextDe: item.discountTextDe,
            discountTextEn: item.discountTextEn,
            isAvailable: !item.isAvailable,
          }
        : {
            type: "equipment" as const,
            id: item.id,
            location: item.location,
            category: item.category,
            labelDe: item.labelDe,
            labelEn: item.labelEn,
            priceCents: item.priceCents,
            isAvailable: !item.isAvailable,
          };
    const response = await fetch("/api/admin/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return;
    if (item.kind === "bike") {
      setBikes((current) =>
        current.map((bike) => (bike.id === item.id ? { ...bike, isAvailable: !bike.isAvailable } : bike)),
      );
    } else {
      setEquipment((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, isAvailable: !entry.isAvailable } : entry)),
      );
    }
  }

  async function deleteItem(item: EditingItem) {
    const label = item.kind === "bike" ? item.title : item.labelDe;
    if (!window.confirm(`„${label}“ wirklich aus dem Inventar entfernen?`)) return;
    const response = await fetch("/api/admin/inventory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: item.kind, id: item.id, location: item.location }),
    });
    if (!response.ok) return;
    if (item.kind === "bike") setBikes((current) => current.filter((bike) => bike.id !== item.id));
    else setEquipment((current) => current.filter((entry) => entry.id !== item.id));
    setDialogOpen(false);
  }

  function handleSaved(item: AdminInventoryBike | AdminInventoryEquipment, itemKind: InventoryKind, isNew: boolean) {
    if (itemKind === "bike") {
      setBikes((current) =>
        isNew
          ? [...current, item as AdminInventoryBike]
          : current.map((bike) => (bike.id === item.id ? (item as AdminInventoryBike) : bike)),
      );
    } else {
      setEquipment((current) =>
        isNew
          ? [...current, item as AdminInventoryEquipment]
          : current.map((entry) => (entry.id === item.id ? (item as AdminInventoryEquipment) : entry)),
      );
    }
    setDialogOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={kind === "bike" ? "default" : "outline"}
          onClick={() => setKind("bike")}
        >
          Bikes ({visibleBikes.length})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={kind === "equipment" ? "default" : "outline"}
          onClick={() => setKind("equipment")}
        >
          Ausrüstung ({visibleEquipment.length})
        </Button>
        {canManageAllLocations ? (
          <Select
            items={locationItems}
            value={locationFilter}
            onValueChange={(value) => value && setLocationFilter(value as LocationFilter)}
          >
            <SelectTrigger
              size="sm"
              className="min-w-0 flex-1 bg-white sm:w-40 sm:flex-none"
              aria-label="Standort filtern"
            >
              <SelectValue className="text-sm font-normal">{selectedLocationLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {locationItems.map((location) => (
                  <SelectItem key={location.value} value={location.value}>
                    {location.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
        <Button
          type="button"
          size="icon-sm"
          aria-label="Inventar hinzufügen"
          title="Inventar hinzufügen"
          onClick={() => openCreate(kind)}
        >
          <PlusIcon />
        </Button>
      </div>
      <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
        <CardContent className="p-0">
          {kind === "bike" ? (
            <Table className="[&_td]:px-6 [&_td]:py-5 [&_th]:px-6 [&_th]:py-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Bike / Typ</TableHead>
                  <TableHead>Größe</TableHead>
                  <TableHead>Standort</TableHead>
                  <TableHead>Rabatt-Hinweis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Preis / Tag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleBikes.length === 0 ? (
                  <EmptyRow colSpan={6} label="Noch keine Bikes für diesen Standort erfasst." />
                ) : (
                  visibleBikes.map((bike) => (
                    <TableRow
                      key={bike.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => openEdit({ ...bike, kind: "bike" })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openEdit({ ...bike, kind: "bike" });
                        }
                      }}
                    >
                      <TableCell className="font-medium">{bike.title}</TableCell>
                      <TableCell>{bike.size}</TableCell>
                      <TableCell>
                        {locations.find((location) => location.key === bike.location)?.label ?? bike.location}
                      </TableCell>
                      <TableCell>
                        {bike.discountTextDe ? (
                          <span className="text-sm font-medium text-red-700 dark:text-red-400">Hinterlegt</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusButton
                          active={bike.isAvailable}
                          onClick={() => toggleAvailability({ ...bike, kind: "bike" })}
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {euroFormatter.format(bike.priceCents / 100)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table className="[&_td]:px-6 [&_td]:py-5 [&_th]:px-6 [&_th]:py-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Ausrüstung</TableHead>
                  <TableHead>Art</TableHead>
                  <TableHead>Standort</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Preis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEquipment.length === 0 ? (
                  <EmptyRow colSpan={5} label="Noch keine Ausrüstung für diesen Standort erfasst." />
                ) : (
                  visibleEquipment.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => openEdit({ ...item, kind: "equipment" })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openEdit({ ...item, kind: "equipment" });
                        }
                      }}
                    >
                      <TableCell className="font-medium">{categoryLabels[item.category]}</TableCell>
                      <TableCell>{item.labelDe}</TableCell>
                      <TableCell>
                        {locations.find((location) => location.key === item.location)?.label ?? item.location}
                      </TableCell>
                      <TableCell>
                        <StatusButton
                          active={item.isAvailable}
                          onClick={() => toggleAvailability({ ...item, kind: "equipment" })}
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {euroFormatter.format(item.priceCents / 100)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <InventoryDialog
        key={`${kind}-${editingItem?.kind ?? "new"}-${editingItem?.id ?? "new"}-${dialogOpen}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        kind={kind}
        item={editingItem}
        locations={locations}
        defaultLocation={locationFilter === "all" ? locations[0]?.key : (locationFilter as LocationOption["key"])}
        onSaved={handleSaved}
        onDelete={editingItem ? () => deleteItem(editingItem) : undefined}
      />
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

function StatusButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={
        active
          ? "text-sm text-emerald-700 hover:underline dark:text-emerald-400"
          : "text-sm text-muted-foreground hover:underline"
      }
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {active ? "Aktiv" : "Pausiert"}
    </button>
  );
}

function InventoryDialog({
  open,
  onOpenChange,
  kind,
  item,
  locations,
  defaultLocation,
  onSaved,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: InventoryKind;
  item: EditingItem | null;
  locations: LocationOption[];
  defaultLocation: LocationOption["key"] | undefined;
  onSaved: (item: AdminInventoryBike | AdminInventoryEquipment, kind: InventoryKind, isNew: boolean) => void;
  onDelete?: () => Promise<void>;
}) {
  const [location, setLocation] = useState<LocationOption["key"]>(
    item?.location ?? defaultLocation ?? locations[0]?.key,
  );
  const [title, setTitle] = useState(item?.kind === "bike" ? item.title : "");
  const [size, setSize] = useState(item?.kind === "bike" ? item.size : "");
  const [frameNumber, setFrameNumber] = useState(item?.kind === "bike" ? (item.frameNumber ?? "") : "");
  const [discountTextDe, setDiscountTextDe] = useState(item?.kind === "bike" ? item.discountTextDe : "");
  const [discountTextEn, setDiscountTextEn] = useState(item?.kind === "bike" ? item.discountTextEn : "");
  const [category, setCategory] = useState<EquipmentCategory>(item?.kind === "equipment" ? item.category : "pedal");
  const [labelDe, setLabelDe] = useState(item?.kind === "equipment" ? item.labelDe : "");
  const [labelEn, setLabelEn] = useState(item?.kind === "equipment" ? item.labelEn : "");
  const [price, setPrice] = useState(item ? priceToInput(item.priceCents) : "");
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
      setError("Bitte gib einen gültigen Preis ein.");
      setSaving(false);
      return;
    }
    const isNew = !item;
    const payload =
      kind === "bike"
        ? {
            type: "bike" as const,
            ...(item ? { id: item.id } : {}),
            location,
            title: title.trim(),
            size: size.trim(),
            frameNumber: frameNumber.trim() || null,
            priceCents,
            discountTextDe: discountTextDe.trim(),
            discountTextEn: discountTextEn.trim(),
            isAvailable,
          }
        : {
            type: "equipment" as const,
            ...(item ? { id: item.id } : {}),
            location,
            category,
            labelDe: labelDe.trim(),
            labelEn: labelEn.trim() || labelDe.trim(),
            priceCents,
            isAvailable,
          };
    if (kind === "bike" && (!title.trim() || !size.trim())) {
      setError("Bitte Typ/Modell und genau eine Größe angeben.");
      setSaving(false);
      return;
    }
    if (kind === "equipment" && !labelDe.trim()) {
      setError("Bitte die Art der Ausrüstung angeben.");
      setSaving(false);
      return;
    }
    const response = await fetch("/api/admin/inventory", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as {
      item?: { id: number; bikeKey?: string; equipmentKey?: string };
      message?: string;
    } | null;
    if (!response.ok || !result?.item) {
      setError(result?.message ?? "Der Inventareintrag konnte nicht gespeichert werden.");
      setSaving(false);
      return;
    }
    if (kind === "bike") {
      onSaved(
        {
          id: result.item.id,
          location,
          bikeKey: item?.kind === "bike" ? item.bikeKey : (result.item.bikeKey ?? title),
          title: title.trim(),
          frameNumber: frameNumber.trim() || null,
          priceCents,
          discountTextDe: discountTextDe.trim(),
          discountTextEn: discountTextEn.trim(),
          size: size.trim(),
          isAvailable,
        },
        "bike",
        isNew,
      );
    } else {
      onSaved(
        {
          id: result.item.id,
          location,
          equipmentKey: item?.kind === "equipment" ? item.equipmentKey : (result.item.equipmentKey ?? labelDe),
          category,
          labelDe: labelDe.trim(),
          labelEn: labelEn.trim() || labelDe.trim(),
          priceCents,
          isAvailable,
        },
        "equipment",
        isNew,
      );
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>
              {item ? `${kind === "bike" ? "Bike" : "Inventar"} bearbeiten` : "Inventar hinzufügen"}
            </DialogTitle>
            <DialogDescription>
              {kind === "bike"
                ? "Pflege Modell, Größe, Tagespreis und einen optionalen Rabatt-Hinweis für dieses Bike."
                : "Pflege Kategorie, Art und Preis der Ausrüstung."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-6">
            <Field>
              <FieldLabel htmlFor="inventory-location">Standort</FieldLabel>
              <Select value={location} onValueChange={(value) => value && setLocation(value as LocationOption["key"])}>
                <SelectTrigger id="inventory-location" className="w-full">
                  <SelectValue>{locations.find((entry) => entry.key === location)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {locations.map((entry) => (
                    <SelectItem key={entry.key} value={entry.key}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {kind === "bike" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="inventory-title">Typ / Modell</FieldLabel>
                  <Input
                    id="inventory-title"
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="z. B. Endurace CF SL 8"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="inventory-size">Größe</FieldLabel>
                  <Input
                    id="inventory-size"
                    required
                    value={size}
                    onChange={(event) => setSize(event.target.value)}
                    placeholder="z. B. M"
                  />
                  <p className="text-xs text-muted-foreground">Pro Inventareintrag ist genau eine Größe erlaubt.</p>
                </Field>
                <Field>
                  <FieldLabel htmlFor="inventory-frame-number">Rahmennummer (optional)</FieldLabel>
                  <Input
                    id="inventory-frame-number"
                    value={frameNumber}
                    onChange={(event) => setFrameNumber(event.target.value)}
                    placeholder="z. B. WTU123456789"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="inventory-discount-de">Rabatt-Hinweis (Deutsch)</FieldLabel>
                    <Textarea
                      id="inventory-discount-de"
                      value={discountTextDe}
                      onChange={(event) => setDiscountTextDe(event.target.value)}
                      placeholder={"z. B. 50%\nRabatt insgesamt\nFür Größe S"}
                      maxLength={500}
                      rows={4}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="inventory-discount-en">Rabatt-Hinweis (Englisch)</FieldLabel>
                    <Textarea
                      id="inventory-discount-en"
                      value={discountTextEn}
                      onChange={(event) => setDiscountTextEn(event.target.value)}
                      placeholder={"e.g. 50%\nTotal discount\nFor size S"}
                      maxLength={500}
                      rows={4}
                    />
                  </Field>
                </div>
                <p className="-mt-3 text-xs text-muted-foreground">
                  Eine Zeile pro Textbaustein. Der Hinweis erscheint als Badge auf der öffentlichen Bike-Karte.
                </p>
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="inventory-category">Ausrüstung</FieldLabel>
                  <Select value={category} onValueChange={(value) => value && setCategory(value as EquipmentCategory)}>
                    <SelectTrigger id="inventory-category" className="w-full">
                      <SelectValue>{categoryLabels[category]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="inventory-label-de">Art / Bezeichnung</FieldLabel>
                    <Input
                      id="inventory-label-de"
                      required
                      value={labelDe}
                      onChange={(event) => setLabelDe(event.target.value)}
                      placeholder="z. B. SPD-SL"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="inventory-label-en">Englische Bezeichnung</FieldLabel>
                    <Input
                      id="inventory-label-en"
                      value={labelEn}
                      onChange={(event) => setLabelEn(event.target.value)}
                      placeholder="z. B. SPD-SL"
                    />
                  </Field>
                </div>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="inventory-price">Preis in Euro</FieldLabel>
                <Input
                  id="inventory-price"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="inventory-available">Status</FieldLabel>
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    id="inventory-available"
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(event) => setIsAvailable(event.target.checked)}
                  />
                  Auf Landingpage anbieten
                </label>
              </Field>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
          <DialogFooter>
            {onDelete ? (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                disabled={saving}
                onClick={async () => {
                  await onDelete();
                }}
              >
                Löschen
              </Button>
            ) : null}
            <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
