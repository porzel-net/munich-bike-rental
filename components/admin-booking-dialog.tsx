"use client";

import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import type { AdminBooking, AdminBookingBike } from "@/components/admin-bookings-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  computerMountTypeLabels,
  computerMountTypes,
  pedalTypeLabels,
  pedalTypes,
  rentalBikeOptions,
  type RentalLocation,
} from "@/lib/inquiries/catalog";

const statusOptions = [
  { label: "Abgelehnt", value: "rejected" },
  { label: "Buchung Ausstehend", value: "pending" },
  { label: "Buchung bestätigt", value: "confirmed" },
  { label: "Ausgeführt", value: "executed" },
  { label: "Buchung Storniert", value: "cancelled" },
  { label: "Unbeantwortet", value: "unanswered" },
] as const;

const sourceOptions = [
  { label: "Automatisch", value: "automatic" },
  { label: "Manuell", value: "manual" },
] as const;

const statusFieldStyles = {
  rejected: "border-[#D61F1F] bg-[#D61F1F]/10 text-[#D61F1F]",
  pending: "border-[#FFD301] bg-[#FFD301]/15 text-[#806900]",
  confirmed: "border-[#639754] bg-[#639754]/25 text-[#426537]",
  executed: "border-[#639754] bg-[#639754]/15 text-[#426537]",
  cancelled: "border-[#F59E0B] bg-[#F59E0B]/15 text-[#B45309]",
  unanswered: "border-slate-200 bg-slate-100 text-slate-600",
} as const;

const emptyBike: AdminBookingBike = {
  heightCm: 170,
  bikeSize: "",
  needsPedals: false,
  pedalType: null,
  needsComputerMount: false,
  computerMountType: null,
  needsHelmet: false,
  needsClothing: false,
};

type EditableBooking = {
  name: string;
  email: string;
  phone: string;
  location: RentalLocation;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  totalPrice: string;
  message: string;
  status: AdminBooking["status"];
  source: AdminBooking["source"];
  bikes: AdminBookingBike[];
};

function getInitialValues(booking: AdminBooking | null, defaultLocation: RentalLocation): EditableBooking {
  if (!booking) {
    return {
      name: "",
      email: "",
      phone: "",
      location: defaultLocation,
      periodFrom: "",
      periodTo: "",
      pickupTime: "",
      dropoffTime: "",
      totalPrice: "",
      message: "",
      status: "unanswered",
      source: "manual",
      bikes: [{ ...emptyBike }],
    };
  }

  return {
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    location: booking.location,
    periodFrom: booking.periodFrom,
    periodTo: booking.periodTo,
    pickupTime: booking.pickupTime,
    dropoffTime: booking.dropoffTime,
    totalPrice: (booking.totalPriceCents / 100).toFixed(2),
    message: booking.message,
    status: booking.status,
    source: booking.source,
    bikes: booking.bikeDetails.map((bike) => ({ ...bike })),
  };
}

export function AdminBookingDialog({
  booking,
  locations,
  open,
  onOpenChange,
  onSaved,
}: {
  booking: AdminBooking | null;
  locations: Array<{ key: RentalLocation; label: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (booking: AdminBooking) => void;
}) {
  const isEditing = booking !== null;
  const defaultLocation = locations[0]?.key ?? "munich";
  const [values, setValues] = useState(() => getInitialValues(booking, defaultLocation));
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateValue<Key extends keyof EditableBooking>(key: Key, value: EditableBooking[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateBike(index: number, change: Partial<AdminBookingBike>) {
    setValues((current) => ({
      ...current,
      bikes: current.bikes.map((bike, bikeIndex) => (bikeIndex === index ? { ...bike, ...change } : bike)),
    }));
  }

  function addBike() {
    setValues((current) => ({ ...current, bikes: [...current.bikes, { ...emptyBike }] }));
  }

  function removeBike(index: number) {
    setValues((current) => ({ ...current, bikes: current.bikes.filter((_, bikeIndex) => bikeIndex !== index) }));
  }

  async function recalculatePrice() {
    setCalculating(true);
    setError(null);
    const response = await fetch(`/api/admin/inquiries/${booking?.id ?? 0}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: values.location,
        periodFrom: values.periodFrom,
        periodTo: values.periodTo,
        bikes: values.bikes,
      }),
    });
    const result = (await response.json().catch(() => null)) as { totalPriceCents?: number } | null;
    const recalculatedPrice = result?.totalPriceCents;
    if (!response.ok || typeof recalculatedPrice !== "number") {
      setError("Der Preis konnte nicht neu berechnet werden.");
    } else {
      setValues((current) => ({ ...current, totalPrice: (recalculatedPrice / 100).toFixed(2) }));
    }
    setCalculating(false);
  }

  async function saveBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const totalPriceCents = Math.round(Number(values.totalPrice.replace(",", ".")) * 100);
    if (!Number.isFinite(totalPriceCents) || totalPriceCents < 0) {
      setError("Bitte gib einen gültigen Preis ein.");
      setSaving(false);
      return;
    }

    const response = await fetch(isEditing ? `/api/admin/inquiries/${booking.id}` : "/api/admin/inquiries", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEditing ? {} : { name: values.name, email: values.email, phone: values.phone, message: values.message }),
        location: values.location,
        periodFrom: values.periodFrom,
        periodTo: values.periodTo,
        pickupTime: values.pickupTime,
        dropoffTime: values.dropoffTime,
        totalPriceCents,
        status: values.status,
        source: values.source,
        ...(values.bikes.length > 0 ? { bikes: values.bikes } : {}),
      }),
    });

    const result = (await response.json().catch(() => null)) as {
      id?: number;
      orderNumber?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      setError(result?.message ?? "Die Buchung konnte nicht gespeichert werden.");
      setSaving(false);
      return;
    }

    const savedId = booking?.id ?? result?.id;
    if (!savedId) {
      setError("Die Buchung konnte nicht gespeichert werden.");
      setSaving(false);
      return;
    }

    onSaved({
      ...(booking ?? {
        id: savedId,
        orderNumber: result?.orderNumber ?? "",
        source: "manual",
        name: values.name,
        bikeTitle: null,
        email: values.email,
        phone: values.phone,
        message: values.message,
        paidAmountCents: 0,
        mailActions: { confirmation: false, rejection: false },
      }),
      name: booking?.name ?? values.name,
      bikeTitle: booking?.bikeTitle ?? null,
      email: booking?.email ?? values.email,
      phone: booking?.phone ?? values.phone,
      location: values.location,
      periodFrom: values.periodFrom,
      periodTo: values.periodTo,
      pickupTime: values.pickupTime,
      dropoffTime: values.dropoffTime,
      totalPriceCents,
      message: booking?.message ?? values.message,
      status: values.status,
      source: values.source,
      bikes: values.bikes.map((bike) => bike.bikeSize),
      bikeDetails: values.bikes,
    });
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[108rem] overflow-y-auto p-0">
        <form onSubmit={saveBooking}>
          <Card className="rounded-4xl shadow-none ring-0">
            <CardHeader>
              <DialogHeader>
                <DialogTitle>{isEditing ? "Buchung bearbeiten" : "Manuelle Buchung hinzufügen"}</DialogTitle>
                <DialogDescription>
                  {isEditing ? `Auftrag ${booking.orderNumber}` : "Neue Buchung manuell anlegen"}
                </DialogDescription>
              </DialogHeader>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="booking-name">Name</FieldLabel>
                    <Input
                      id="booking-name"
                      readOnly={isEditing}
                      className={isEditing ? "bg-muted/50" : undefined}
                      value={values.name}
                      onChange={(event) => updateValue("name", event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="booking-status">Status</FieldLabel>
                    <Select
                      value={values.status}
                      onValueChange={(value) => value && updateValue("status", value as AdminBooking["status"])}
                    >
                      <SelectTrigger id="booking-status" className={`w-full ${statusFieldStyles[values.status]}`}>
                        <SelectValue>{statusOptions.find((item) => item.value === values.status)?.label}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {statusOptions.map((item) => (
                            <SelectItem key={item.value} value={item.value} className={statusFieldStyles[item.value]}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="booking-source">Buchungsart</FieldLabel>
                    <Select
                      value={values.source}
                      disabled
                    >
                      <SelectTrigger id="booking-source" className="w-full">
                        <SelectValue>{sourceOptions.find((item) => item.value === values.source)?.label}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {sourceOptions.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="booking-email">E-Mail</FieldLabel>
                    <Input
                      id="booking-email"
                      type="email"
                      readOnly={isEditing}
                      className={isEditing ? "bg-muted/50" : undefined}
                      value={values.email}
                      onChange={(event) => updateValue("email", event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="booking-phone">Telefon</FieldLabel>
                    <Input
                      id="booking-phone"
                      readOnly={isEditing}
                      className={isEditing ? "bg-muted/50" : undefined}
                      value={values.phone}
                      onChange={(event) => updateValue("phone", event.target.value)}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="booking-location">Standort</FieldLabel>
                  <Select
                    value={values.location}
                    disabled={isEditing}
                    onValueChange={(value) => value && updateValue("location", value as RentalLocation)}
                  >
                    <SelectTrigger id="booking-location" className={`w-full ${isEditing ? "bg-muted/50" : ""}`}>
                      <SelectValue>{locations.find((location) => location.key === values.location)?.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {locations.map((location) => (
                          <SelectItem key={location.key} value={location.key}>
                            {location.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="booking-from">Datum von</FieldLabel>
                    <Input
                      id="booking-from"
                      type="date"
                      value={values.periodFrom}
                      onChange={(event) => updateValue("periodFrom", event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="booking-to">Datum bis</FieldLabel>
                    <Input
                      id="booking-to"
                      type="date"
                      value={values.periodTo}
                      onChange={(event) => updateValue("periodTo", event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="booking-pickup">Abholzeit</FieldLabel>
                    <Input
                      id="booking-pickup"
                      type="time"
                      value={values.pickupTime}
                      onChange={(event) => updateValue("pickupTime", event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="booking-dropoff">Rückgabezeit</FieldLabel>
                    <Input
                      id="booking-dropoff"
                      type="time"
                      value={values.dropoffTime}
                      onChange={(event) => updateValue("dropoffTime", event.target.value)}
                    />
                  </Field>
                </div>

                <Field>
                  <div className="flex items-end justify-between gap-3">
                    <FieldLabel htmlFor="booking-price">Wert der Buchung</FieldLabel>
                    <Button type="button" variant="outline" size="sm" onClick={recalculatePrice} disabled={calculating}>
                      {calculating ? "Berechne..." : "Preis neu berechnen"}
                    </Button>
                  </div>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>€</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="booking-price"
                      inputMode="decimal"
                      value={values.totalPrice}
                      onChange={(event) => updateValue("totalPrice", event.target.value)}
                    />
                  </InputGroup>
                </Field>

                {values.bikes.map((bike, index) => (
                  <div key={index} className="rounded-2xl border p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Fahrrad {index + 1}</p>
                      {values.bikes.length > 1 ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeBike(index)}>
                          <Trash2Icon /> Entfernen
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor={`bike-size-${index}`}>Rad und Größe</FieldLabel>
                        <Select
                          value={bike.bikeSize}
                          onValueChange={(value) => value && updateBike(index, { bikeSize: value })}
                        >
                          <SelectTrigger id={`bike-size-${index}`} className="w-full">
                            <SelectValue>{bike.bikeSize || "Rad auswählen"}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {rentalBikeOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`bike-height-${index}`}>Körpergröße (cm)</FieldLabel>
                        <Input
                          id={`bike-height-${index}`}
                          type="number"
                          min={100}
                          max={250}
                          value={bike.heightCm}
                          onChange={(event) => updateBike(index, { heightCm: Number(event.target.value) })}
                        />
                      </Field>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {(
                        [
                          ["needsPedals", "Pedale"],
                          ["needsComputerMount", "Computerhalterung"],
                          ["needsHelmet", "Helm"],
                          ["needsClothing", "Bekleidung"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={bike[key]}
                            onCheckedChange={(checked) => updateBike(index, { [key]: checked === true })}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-6 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor={`bike-pedals-${index}`}>Pedaltyp</FieldLabel>
                        <Select
                          value={bike.pedalType ?? ""}
                          onValueChange={(value) => updateBike(index, { pedalType: value || null })}
                        >
                          <SelectTrigger id={`bike-pedals-${index}`} className="w-full">
                            <SelectValue>
                              {pedalTypeLabels.de[bike.pedalType as (typeof pedalTypes)[number]] ??
                                "Pedaltyp auswählen"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {pedalTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {pedalTypeLabels.de[type]}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`bike-computer-${index}`}>Halterungstyp</FieldLabel>
                        <Select
                          value={bike.computerMountType ?? ""}
                          onValueChange={(value) => updateBike(index, { computerMountType: value || null })}
                        >
                          <SelectTrigger id={`bike-computer-${index}`} className="w-full">
                            <SelectValue>
                              {computerMountTypeLabels.de[
                                bike.computerMountType as (typeof computerMountTypes)[number]
                              ] ?? "Halterungstyp auswählen"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {computerMountTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {computerMountTypeLabels.de[type]}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addBike} disabled={values.bikes.length >= 10}>
                  <PlusIcon /> Fahrrad hinzufügen
                </Button>

                <Field>
                  <FieldLabel htmlFor="booking-message">Nachricht</FieldLabel>
                  <Textarea
                    id="booking-message"
                    readOnly={isEditing}
                    className={isEditing ? "bg-muted/50" : undefined}
                    value={values.message}
                    onChange={(event) => updateValue("message", event.target.value)}
                    rows={4}
                  />
                </Field>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <DialogFooter className="w-full">
                <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
                <Button type="submit" disabled={saving}>
                  {saving ? "Speichern..." : "Änderungen speichern"}
                </Button>
              </DialogFooter>
            </CardFooter>
          </Card>
        </form>
      </DialogContent>
    </Dialog>
  );
}
