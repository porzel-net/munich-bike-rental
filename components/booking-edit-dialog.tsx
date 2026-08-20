"use client";

import { useState, type FormEvent, type ReactNode } from "react";
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
import {
  computerMountTypes,
  getComputerMountTypeLabel,
  getPedalTypeLabel,
  normalizeComputerMountType,
  normalizePedalType,
  pedalTypes,
} from "@/lib/inquiries/catalog";
import { euroToCents } from "@/lib/bookings/money";

export type EditableItem = {
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
  quotedTotalCents?: number;
};

export type BookingEditAsset = {
  id: number;
  label: string;
  nickname: string | null;
  modelLabel: string;
  priceCents: number;
};

function bookingEditAssetLabel(asset: BookingEditAsset) {
  return `${asset.nickname ? `${asset.nickname} · ` : ""}${asset.label}`;
}

type BookingEditDialogProps = BookingEditValues & {
  bookingId: number;
  commercialEditingAllowed: boolean;
  priceEditingAllowed?: boolean;
  notifyCustomer?: boolean;
  availableAssets?: BookingEditAsset[];
  requestedBikeOptions?: string[];
  selectedAssetsByRequestedItem?: Record<number, number>;
  concreteBikeEditingAllowed?: boolean;
  trigger?: (open: () => void) => ReactNode;
};

export function BookingEditDialog({
  bookingId,
  commercialEditingAllowed,
  priceEditingAllowed = false,
  notifyCustomer = false,
  availableAssets = [],
  requestedBikeOptions = [],
  selectedAssetsByRequestedItem = {},
  concreteBikeEditingAllowed = false,
  trigger,
  ...initialValues
}: BookingEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendMail, setSendMail] = useState(notifyCustomer);
  const [values, setValues] = useState<BookingEditValues>(initialValues);
  const [quotedTotal, setQuotedTotal] = useState(
    initialValues.quotedTotalCents === undefined
      ? ""
      : (initialValues.quotedTotalCents / 100).toFixed(2).replace(".", ","),
  );
  const [selectedAssets, setSelectedAssets] = useState<Record<number, number>>(selectedAssetsByRequestedItem);
  const bikeOptions = [...new Set([...requestedBikeOptions, ...availableAssets.map((asset) => asset.modelLabel)])];

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
      const quotedTotalCents = priceEditingAllowed ? euroToCents(quotedTotal) : undefined;
      if (priceEditingAllowed && (quotedTotalCents === null || quotedTotalCents === undefined || quotedTotalCents < 0))
        throw new Error("Bitte gib einen gültigen Gesamtpreis ein.");
      if (concreteBikeEditingAllowed && values.requestedItems.some((item) => !selectedAssets[item.id]))
        throw new Error("Bitte wähle für jedes angefragte Fahrrad ein konkretes verfügbares Fahrrad aus.");
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          ...(priceEditingAllowed ? { quotedTotalCents } : {}),
          notifyCustomer: sendMail,
          ...(concreteBikeEditingAllowed ? { assetsByRequestedItem: selectedAssets } : {}),
          requestedItems: values.requestedItems.map((item) => ({
            ...item,
            pedalType: item.needsPedals ? item.pedalType || null : null,
            computerMountType: item.needsComputerMount ? item.computerMountType || null : null,
          })),
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        mailStatus?: string | null;
      } | null;
      if (!response.ok)
        throw new Error(
          result?.message ??
            "Die Buchung konnte nicht gespeichert werden. Prüfe Zeitraum, Übergabezeiten, Gesamtpreis und Fahrradauswahl.",
        );
      toast.success(
        sendMail
          ? result?.mailStatus === "sent"
            ? "Buchung wurde geändert und die Änderungsmail wurde versendet."
            : "Buchung wurde geändert."
          : "Buchung wurde gespeichert.",
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Die Buchung konnte nicht gespeichert werden. Prüfe Zeitraum, Übergabezeiten, Gesamtpreis und Fahrradauswahl.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setSendMail(notifyCustomer);
      }}
    >
      {trigger ? (
        trigger(() => {
          setSendMail(notifyCustomer);
          setOpen(true);
        })
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSendMail(notifyCustomer);
            setOpen(true);
          }}
        >
          {notifyCustomer ? "Buchungsinformationen ändern" : "Buchung bearbeiten"}
        </Button>
      )}
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{notifyCustomer ? "Buchungsinformationen ändern" : "Buchung bearbeiten"}</DialogTitle>
          <DialogDescription>
            {notifyCustomer
              ? concreteBikeEditingAllowed
                ? "Ändere die Buchungsdaten oder ordne ein anderes verfügbares Fahrrad am jeweiligen Standort zu. Danach erhält die Kundin oder der Kunde eine Änderungsmail; alle geänderten Angaben werden darin fett markiert."
                : "Ändere die Buchungsdaten. Danach erhält die Kundin oder der Kunde eine Änderungsmail; alle geänderten Angaben werden darin fett markiert."
              : `Kontaktdaten und interne Nachricht können jederzeit angepasst werden.${commercialEditingAllowed ? " Zeitraum, Fahrradwünsche und Zubehör sind in diesem Buchungsstatus ebenfalls editierbar." : " Zeitraum, Fahrräder und Zubehör sind nach der Bestätigung gesperrt."}${priceEditingAllowed ? " Der Mietbetrag kann bei importierten Buchungen weiterhin angepasst werden." : ""}`}
          </DialogDescription>
        </DialogHeader>
        {notifyCustomer ? (
          <label className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
            <Checkbox checked={sendMail} onCheckedChange={(checked) => setSendMail(Boolean(checked))} />
            <span>
              <span className="font-medium">Änderungsmail mitsenden</span>
              <span className="block text-muted-foreground">
                Deaktivieren, wenn die Buchung ohne Kund:innen-Mail gespeichert werden soll.
              </span>
            </span>
          </label>
        ) : null}
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
                disabled={notifyCustomer}
              />
            </Field>
          </FieldGroup>

          {priceEditingAllowed ? (
            <Field>
              <FieldLabel htmlFor="edit-quoted-total">Mietbetrag gesamt</FieldLabel>
              <Input
                id="edit-quoted-total"
                inputMode="decimal"
                value={quotedTotal}
                onChange={(event) => setQuotedTotal(event.target.value)}
                placeholder="0,00"
                required
              />
              <FieldDescription>Der Gesamtbetrag, für den das Fahrrad vermietet wird.</FieldDescription>
            </Field>
          ) : null}

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
                    <Select
                      value={item.requestedLabel}
                      onValueChange={(value) => updateItem(item.id, { requestedLabel: value ?? item.requestedLabel })}
                    >
                      <SelectTrigger id={`edit-item-label-${item.id}`} className="w-full">
                        <SelectValue>{item.requestedLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {[...new Set([item.requestedLabel, ...bikeOptions])].map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <FieldLabel htmlFor={`edit-item-pedals-${item.id}`}>Pedaltyp</FieldLabel>
                    <Select
                      value={normalizePedalType(item.pedalType) ?? undefined}
                      onValueChange={(value) => updateItem(item.id, { pedalType: value ?? null })}
                      disabled={!item.needsPedals}
                    >
                      <SelectTrigger id={`edit-item-pedals-${item.id}`} className="w-full">
                        <SelectValue placeholder="Pedaltyp auswählen">
                          {item.pedalType ? getPedalTypeLabel(item.pedalType, "de") : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {pedalTypes.map((value) => (
                          <SelectItem key={value} value={value}>
                            {getPedalTypeLabel(value, "de")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`edit-item-mount-${item.id}`}>Halterungstyp</FieldLabel>
                    <Select
                      value={normalizeComputerMountType(item.computerMountType) ?? undefined}
                      onValueChange={(value) => updateItem(item.id, { computerMountType: value ?? null })}
                      disabled={!item.needsComputerMount}
                    >
                      <SelectTrigger id={`edit-item-mount-${item.id}`} className="w-full">
                        <SelectValue placeholder="Halterungstyp auswählen">
                          {item.computerMountType ? getComputerMountTypeLabel(item.computerMountType, "de") : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {computerMountTypes.map((value) => (
                          <SelectItem key={value} value={value}>
                            {getComputerMountTypeLabel(value, "de")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            ))}
          </fieldset>

          {concreteBikeEditingAllowed ? (
            <fieldset className="space-y-4">
              <legend className="text-sm font-medium">Konkrete Fahrräder</legend>
              <FieldDescription>
                Wähle ein verfügbares Fahrrad am Standort der Buchung. Das vereinbarte Mietentgelt bleibt dabei
                unverändert.
              </FieldDescription>
              {values.requestedItems.map((item) => {
                const selectedAsset = availableAssets.find((asset) => asset.id === selectedAssets[item.id]);
                return (
                  <Field key={item.id}>
                    <FieldLabel htmlFor={`edit-concrete-asset-${item.id}`}>Fahrrad {item.position}</FieldLabel>
                    <Select
                      value={selectedAssets[item.id] ? String(selectedAssets[item.id]) : undefined}
                      onValueChange={(value) =>
                        setSelectedAssets((current) => ({ ...current, [item.id]: Number(value) }))
                      }
                    >
                      <SelectTrigger id={`edit-concrete-asset-${item.id}`} className="w-full">
                        <SelectValue placeholder="Fahrrad auswählen">
                          {selectedAsset ? bookingEditAssetLabel(selectedAsset) : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {availableAssets.map((asset) => {
                          const selectedForOtherItem = Object.entries(selectedAssets).some(
                            ([requestedItemId, assetId]) =>
                              Number(requestedItemId) !== item.id && Number(assetId) === asset.id,
                          );
                          return (
                            <SelectItem key={asset.id} value={String(asset.id)} disabled={selectedForOtherItem}>
                              {asset.nickname ? `${asset.nickname} · ` : ""}
                              {asset.modelLabel} · {asset.label} ·{" "}
                              {(asset.priceCents / 100).toFixed(2).replace(".", ",")} €/Tag
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </Field>
                );
              })}
              {!availableAssets.length ? (
                <p className="text-sm text-destructive">
                  Für diesen Zeitraum sind am Standort keine Fahrräder verfügbar.
                </p>
              ) : null}
            </fieldset>
          ) : null}

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
