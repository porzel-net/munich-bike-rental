"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type EditableItem = {
  id: number;
  position: number;
  requestedLabel: string;
  heightCm: number;
  needsPedals: boolean;
  pedalType: string | null;
  needsComputerMount: boolean;
  computerMountType: string | null;
  needsHelmet: boolean;
  needsClothing: boolean;
  needsBikepackingBag?: boolean;
  needsGlasses?: boolean;
  bottleHolderIncluded?: boolean;
  repairKitIncluded?: boolean;
};

type BookingEditValues = {
  expectedVersion: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  customerMessage: string;
  communicationLocale: "de" | "en";
  requestedItems: EditableItem[];
};

type BookingEditDialogProps = BookingEditValues & {
  bookingId: number;
  commercialEditingAllowed: boolean;
};

export function BookingEditDialog({ bookingId, commercialEditingAllowed, ...initialValues }: BookingEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<BookingEditValues>(initialValues);

  const update = (patch: Partial<BookingEditValues>) => setValues((current) => ({ ...current, ...patch }));
  const updateItem = (id: number, patch: Partial<EditableItem>) =>
    setValues((current) => ({
      ...current,
      requestedItems: current.requestedItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setBusy(true);
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          requestedItems: values.requestedItems.map((item) => ({
            ...item,
            pedalType: item.needsPedals ? item.pedalType || null : null,
            computerMountType: item.needsComputerMount ? item.computerMountType || null : null,
          })),
        }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Buchung konnte nicht gespeichert werden.");
      toast.success("Buchung wurde gespeichert.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Buchung konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Buchung bearbeiten
      </Button>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Buchung bearbeiten</DialogTitle>
          <DialogDescription>
            Kontaktdaten und interne Nachricht können jederzeit angepasst werden.
            {commercialEditingAllowed
              ? " Zeitraum, Fahrradwünsche und Zubehör sind in diesem Buchungsstatus ebenfalls editierbar."
              : " Zeitraum, Fahrräder und Zubehör sind nach der Bestätigung gesperrt."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-6" onSubmit={submit}>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-customer-name">Name</FieldLabel>
              <Input
                id="edit-customer-name"
                value={values.customerName}
                onChange={(event) => update({ customerName: event.target.value })}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-customer-email">E-Mail</FieldLabel>
              <Input
                id="edit-customer-email"
                type="email"
                value={values.customerEmail}
                onChange={(event) => update({ customerEmail: event.target.value })}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-customer-phone">Telefon</FieldLabel>
              <Input
                id="edit-customer-phone"
                value={values.customerPhone}
                onChange={(event) => update({ customerPhone: event.target.value })}
                required
              />
            </Field>
            <Field>
              <FieldLabel>Kommunikationssprache</FieldLabel>
              <Select
                value={values.communicationLocale}
                onValueChange={(value) => update({ communicationLocale: (value ?? "de") as "de" | "en" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{values.communicationLocale === "de" ? "Deutsch" : "English"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="edit-message">Interne Nachricht</FieldLabel>
              <Textarea
                id="edit-message"
                value={values.customerMessage}
                onChange={(event) => update({ customerMessage: event.target.value })}
                placeholder="Zusätzliche Hinweise zur Buchung"
              />
            </Field>
          </FieldGroup>

          <fieldset disabled={!commercialEditingAllowed} className="space-y-4">
            <legend className="text-sm font-medium">Zeitraum</legend>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="edit-period-from">Abholung</FieldLabel>
                <Input
                  id="edit-period-from"
                  type="date"
                  value={values.periodFrom}
                  onChange={(event) => update({ periodFrom: event.target.value })}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-pickup-time">Abholzeit</FieldLabel>
                <Input
                  id="edit-pickup-time"
                  type="time"
                  value={values.pickupTime}
                  onChange={(event) => update({ pickupTime: event.target.value })}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-period-to">Rückgabe</FieldLabel>
                <Input
                  id="edit-period-to"
                  type="date"
                  value={values.periodTo}
                  onChange={(event) => update({ periodTo: event.target.value })}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-dropoff-time">Rückgabezeit</FieldLabel>
                <Input
                  id="edit-dropoff-time"
                  type="time"
                  value={values.dropoffTime}
                  onChange={(event) => update({ dropoffTime: event.target.value })}
                  required
                />
              </Field>
            </FieldGroup>
          </fieldset>

          <fieldset disabled={!commercialEditingAllowed} className="space-y-4">
            <legend className="text-sm font-medium">Angefragte Fahrräder und Zubehör</legend>
            <FieldDescription>
              Wenn ein offenes Angebot durch diese Änderungen veraltet ist, wird es automatisch widerrufen.
            </FieldDescription>
            {values.requestedItems.map((item) => (
              <div className="space-y-4 rounded-2xl border bg-muted/25 p-4" key={item.id}>
                <p className="font-medium">Fahrrad {item.position}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`edit-item-label-${item.id}`}>Modell / Größe</FieldLabel>
                    <Input
                      id={`edit-item-label-${item.id}`}
                      value={item.requestedLabel}
                      onChange={(event) => updateItem(item.id, { requestedLabel: event.target.value })}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`edit-item-height-${item.id}`}>Körpergröße in cm</FieldLabel>
                    <Input
                      id={`edit-item-height-${item.id}`}
                      type="number"
                      min="100"
                      max="250"
                      value={item.heightCm}
                      onChange={(event) => updateItem(item.id, { heightCm: Number(event.target.value) })}
                      required
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={item.needsHelmet}
                      onCheckedChange={(checked) => updateItem(item.id, { needsHelmet: Boolean(checked) })}
                    />
                    Helm benötigt
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={item.needsClothing}
                      onCheckedChange={(checked) => updateItem(item.id, { needsClothing: Boolean(checked) })}
                    />
                    Kleidung benötigt
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={item.needsPedals}
                      onCheckedChange={(checked) => updateItem(item.id, { needsPedals: Boolean(checked) })}
                    />
                    Pedale benötigt
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={item.needsComputerMount}
                      onCheckedChange={(checked) => updateItem(item.id, { needsComputerMount: Boolean(checked) })}
                    />
                    Computerhalterung benötigt
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`edit-item-pedals-${item.id}`}>Pedaltyp (optional)</FieldLabel>
                    <Input
                      id={`edit-item-pedals-${item.id}`}
                      value={item.pedalType ?? ""}
                      onChange={(event) => updateItem(item.id, { pedalType: event.target.value })}
                      disabled={!item.needsPedals}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`edit-item-mount-${item.id}`}>Halterungstyp (optional)</FieldLabel>
                    <Input
                      id={`edit-item-mount-${item.id}`}
                      value={item.computerMountType ?? ""}
                      onChange={(event) => updateItem(item.id, { computerMountType: event.target.value })}
                      disabled={!item.needsComputerMount}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Wird gespeichert…" : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
