"use client";

import { useMemo, useState } from "react";
import { CheckIcon, CircleDollarSignIcon, SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { euroToCents, formatEuro } from "@/lib/bookings/money";
import type { BookingStatus } from "@/lib/db/schema";

type OfferAccessorySelection = {
  needsPedals: boolean;
  pedalType: string | null;
  needsComputerMount: boolean;
  computerMountType: string | null;
  needsHelmet: boolean;
  needsClothing: boolean;
};
type RequestedItem = { id: number; label: string; requestedLabel: string; accessories: OfferAccessorySelection };
type Asset = { id: number; label: string; priceCents: number };
type Entry = { id: number; label: string };
type Action = "offer" | "cancel" | "payment" | "refund" | "correct" | "reject";
type ConfirmAction = "check_out" | "complete" | null;
type AlternativeReasonType = "" | "size" | "unavailable" | "custom";
type RejectionReasonType = "" | "availability" | "handover" | "custom";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Aktion fehlgeschlagen";
}

export function BookingCommandActions({
  bookingId,
  status,
  customerName,
  senderName,
  canExecuteActions,
  requestedItems,
  availableAssets,
  journalEntries,
}: {
  bookingId: number;
  status: BookingStatus;
  customerName: string;
  senderName: string;
  canExecuteActions: boolean;
  requestedItems: RequestedItem[];
  availableAssets: Asset[];
  journalEntries: Entry[];
}) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [entryId, setEntryId] = useState("");
  const [assetsByRequestedItem, setAssetsByRequestedItem] = useState<Record<string, string>>({});
  const [offerAccessories, setOfferAccessories] = useState<Record<string, OfferAccessorySelection>>({});
  const [alternativeReasonType, setAlternativeReasonType] = useState<AlternativeReasonType>("");
  const [customAlternativeReason, setCustomAlternativeReason] = useState("");
  const [rejectionReasonType, setRejectionReasonType] = useState<RejectionReasonType>("");
  const [customRejectionReason, setCustomRejectionReason] = useState("");
  const [preview, setPreview] = useState<{
    quote: {
      totalCents: number;
      bikeSubtotalCents: number;
      equipmentSubtotalCents: number;
      discountCents: number;
      rentalDays: number;
      offeredItems: Array<{ requestedLabel: string; assetName: string }>;
    };
    mail: { subject: string; text: string };
  } | null>(null);

  const selectedAssetIds = useMemo(
    () => new Set(Object.values(assetsByRequestedItem).filter(Boolean)),
    [assetsByRequestedItem],
  );
  const isAlternativeOffer = requestedItems.some((item) => {
    const selectedAsset = availableAssets.find((asset) => String(asset.id) === assetsByRequestedItem[String(item.id)]);
    return Boolean(selectedAsset && selectedAsset.label !== item.requestedLabel);
  });
  const alternativeReason =
    alternativeReasonType === "size"
      ? "Die andere Größe passt besser."
      : alternativeReasonType === "unavailable"
        ? "Das gewünschte Fahrrad ist leider nicht verfügbar. Wir können dir stattdessen dieses Fahrrad anbieten."
        : alternativeReasonType === "custom"
          ? customAlternativeReason.trim()
          : "";
  const alternativeReasonLabel =
    alternativeReasonType === "size"
      ? "Die andere Größe passt besser"
      : alternativeReasonType === "unavailable"
        ? "Das gewünschte Fahrrad ist nicht verfügbar"
        : alternativeReasonType === "custom"
          ? "Eigener Text"
          : "Grund auswählen";
  const rejectionReason =
    rejectionReasonType === "availability"
      ? "Fahrrad Verfügbarkeit"
      : rejectionReasonType === "handover"
        ? "Übergabezeiten"
        : rejectionReasonType === "custom"
          ? customRejectionReason.trim()
          : "";
  const rejectionReasonLabel =
    rejectionReasonType === "availability"
      ? "Fahrrad Verfügbarkeit"
      : rejectionReasonType === "handover"
        ? "Übergabezeiten"
        : rejectionReasonType === "custom"
          ? "Anderen Grund"
          : "Grund auswählen";
  const rejectionMailPreview = `Hey ${customerName.trim().split(/\s+/)[0] || customerName},

vielen Dank für deine Anfrage.

Leider können wir dir für den Zeitraum kein passendes Fahrrad anbieten. Probiers gerne nochmal wann anders!

Wir hoffen, dass du fündig wirst und wünschen dir eine gute Fahrt.

Liebe Grüße
${senderName.trim().split(/\s+/)[0] || senderName}`;
  const requiresReason =
    activeAction === "cancel" ||
    activeAction === "payment" ||
    activeAction === "refund" ||
    activeAction === "correct" ||
    activeAction === "reject";
  const close = () => {
    setActiveAction(null);
    setReason("");
    setAmount("");
    setDueDate("");
    setEntryId("");
    setPreview(null);
    setAssetsByRequestedItem({});
    setOfferAccessories({});
    setAlternativeReasonType("");
    setCustomAlternativeReason("");
    setRejectionReasonType("");
    setCustomRejectionReason("");
  };

  const openOffer = () => {
    setActiveAction("offer");
    setAssetsByRequestedItem({});
    setOfferAccessories(Object.fromEntries(requestedItems.map((item) => [String(item.id), { ...item.accessories }])));
    setAlternativeReasonType("");
    setCustomAlternativeReason("");
    setPreview(null);
  };

  const openReject = () => {
    setActiveAction("reject");
    setRejectionReasonType("");
    setCustomRejectionReason("");
  };

  const updateOfferAccessories = (itemId: number, change: Partial<OfferAccessorySelection>) => {
    setOfferAccessories((current) => ({
      ...current,
      [String(itemId)]: { ...current[String(itemId)], ...change },
    }));
    setPreview(null);
  };

  const request = async (body: object) => {
    const response = await fetch(`/api/admin/bookings/${bookingId}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) throw new Error(result?.message ?? "Aktion fehlgeschlagen");
  };

  const submit = async () => {
    try {
      setBusy(true);
      if (activeAction === "offer") {
        if (requestedItems.some((item) => !assetsByRequestedItem[String(item.id)]))
          throw new Error("Bitte wähle für jedes angefragte Fahrrad ein konkretes Asset.");
        if (isAlternativeOffer && !alternativeReason)
          throw new Error("Bitte gib an, warum ein anderes Fahrrad angeboten wird.");
        await request({
          command: "send_offer",
          assetsByRequestedItem: Object.fromEntries(
            Object.entries(assetsByRequestedItem).map(([key, value]) => [key, Number(value)]),
          ),
          accessoriesByRequestedItem: Object.fromEntries(
            Object.entries(offerAccessories).map(([key, value]) => [key, value]),
          ),
          alternative: isAlternativeOffer,
          alternativeReason: isAlternativeOffer ? alternativeReason : undefined,
        });
        toast.success(
          isAlternativeOffer ? "Alternativangebot wurde in die Outbox gelegt." : "Angebot wurde in die Outbox gelegt.",
        );
      } else if (activeAction === "cancel") {
        const cancellationFeeCents = euroToCents(amount || "0");
        if (cancellationFeeCents === null) throw new Error("Bitte gib die Stornogebühr als gültigen Euro-Betrag ein.");
        await request({
          command: "cancel",
          reason,
          cancellationFeeCents,
          dueAt: dueDate ? `${dueDate}T00:00:00.000Z` : undefined,
        });
        toast.success("Buchung wurde storniert.");
      } else if (activeAction === "payment" || activeAction === "refund") {
        const amountCents = euroToCents(amount);
        if (amountCents === null || amountCents <= 0) throw new Error("Bitte gib einen positiven Euro-Betrag ein.");
        await request({ command: activeAction, amountCents, reason });
        toast.success(activeAction === "payment" ? "Zahlung wurde erfasst." : "Erstattung wurde erfasst.");
      } else if (activeAction === "correct") {
        if (!entryId) throw new Error("Bitte wähle eine Journalbuchung aus.");
        await request({ command: "correct_journal", entryId: Number(entryId), reason });
        toast.success("Korrekturbuchung wurde angelegt.");
      } else if (activeAction === "reject") {
        if (!rejectionReason) throw new Error("Bitte wähle einen Grund für die Absage aus.");
        await request({ command: "reject", reason: rejectionReason });
        toast.success("Anfrage wurde abgelehnt.");
      }
      close();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const loadPreview = async () => {
    try {
      if (requestedItems.some((item) => !assetsByRequestedItem[String(item.id)]))
        throw new Error("Bitte wähle zuerst für jedes Fahrrad ein Asset.");
      if (isAlternativeOffer && !alternativeReason)
        throw new Error("Bitte gib an, warum ein anderes Fahrrad angeboten wird.");
      setBusy(true);
      const response = await fetch(`/api/admin/bookings/${bookingId}/offer-preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetsByRequestedItem: Object.fromEntries(
            Object.entries(assetsByRequestedItem).map(([key, value]) => [key, Number(value)]),
          ),
          accessoriesByRequestedItem: Object.fromEntries(
            Object.entries(offerAccessories).map(([key, value]) => [key, value]),
          ),
          alternative: isAlternativeOffer,
          alternativeReason: isAlternativeOffer ? alternativeReason : undefined,
        }),
      });
      const result = (await response.json().catch(() => null)) as typeof preview & { message?: string };
      if (!response.ok || !result) throw new Error(result?.message ?? "Vorschau konnte nicht erstellt werden.");
      setPreview(result);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const confirmTransition = async () => {
    if (!confirmAction) return;
    try {
      setBusy(true);
      await request({ command: confirmAction });
      toast.success(confirmAction === "check_out" ? "Ausgabe wurde erfasst." : "Buchung wurde abgeschlossen.");
      setConfirmAction(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const showOfferFields = activeAction === "offer";
  const missingRequiredReason = activeAction === "reject" ? !rejectionReason : requiresReason && !reason.trim();
  const dialogDescription = showOfferFields
    ? "Prüfe die Fahrradauswahl und die Ausstattung. Vor dem Versand kannst du die Mail noch ansehen."
    : activeAction === "reject"
      ? "Der Ablehnungsgrund wird gespeichert und eine Absage-Mail an die Kundin oder den Kunden gesendet."
      : activeAction === "cancel"
        ? "Die Buchung wird storniert und der Vorgang wird dokumentiert."
        : activeAction === "payment"
          ? "Die Zahlung wird im Finanzjournal erfasst."
          : activeAction === "refund"
            ? "Die Erstattung wird im Finanzjournal erfasst."
            : activeAction === "correct"
              ? "Die Korrektur wird im Finanzjournal dokumentiert."
              : "Die Aktion wird dokumentiert.";
  const title =
    activeAction === "offer"
      ? status === "offer_sent"
        ? "Angebot überarbeiten"
        : "Angebot erstellen"
      : activeAction === "cancel"
        ? "Buchung stornieren"
        : activeAction === "payment"
        ? "Zahlung erfassen"
        : activeAction === "refund"
          ? "Erstattung erfassen"
          : activeAction === "correct"
            ? "Journal korrigieren"
            : "Anfrage ablehnen";
  const actionsLocked = !canExecuteActions;

  return (
    <>
      {actionsLocked ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          Für diese Buchung ist noch kein Sachbearbeiter eingetragen. Bitte zuerst zuweisen, dann können Angebote,
          Zahlungen und weitere Aktionen ausgeführt werden.
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(status === "inquiry_received" || status === "offer_sent" || status === "expired") && (
          <Button disabled={actionsLocked} onClick={openOffer}>
            <SendIcon /> {status === "offer_sent" ? "Angebot ersetzen" : "Angebot erstellen"}
          </Button>
        )}
        {status === "inquiry_received" && (
          <Button variant="outline" disabled={actionsLocked} onClick={openReject}>
            <XIcon /> Ablehnen
          </Button>
        )}
        {status === "confirmed" && (
          <Button disabled={actionsLocked} onClick={() => setConfirmAction("check_out")}>
            <CheckIcon /> Ausgabe erfassen
          </Button>
        )}
        {status === "checked_out" && (
          <Button disabled={actionsLocked} onClick={() => setConfirmAction("complete")}>
            <CheckIcon /> Abschließen
          </Button>
        )}
        {["inquiry_received", "offer_sent", "confirmed"].includes(status) && (
          <Button variant="destructive" disabled={actionsLocked} onClick={() => setActiveAction("cancel")}>
            <XIcon /> Stornieren
          </Button>
        )}
        <Button variant="outline" disabled={actionsLocked} onClick={() => setActiveAction("payment")}>
          <CircleDollarSignIcon /> Zahlung
        </Button>
        <Button variant="outline" disabled={actionsLocked} onClick={() => setActiveAction("refund")}>
          Erstattung
        </Button>
      </div>

      <Dialog open={activeAction !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {showOfferFields && (
              <>
                <div className="space-y-4">
                  {requestedItems.map((item) => {
                    const accessories = offerAccessories[String(item.id)] ?? item.accessories;
                    return (
                      <div className="rounded-xl border p-4" key={item.id}>
                        <Field>
                          <FieldLabel htmlFor={`asset-${item.id}`}>{item.label}</FieldLabel>
                          <Select
                            value={assetsByRequestedItem[String(item.id)] ?? ""}
                            onValueChange={(value) => {
                              setAssetsByRequestedItem((current) => ({ ...current, [String(item.id)]: value ?? "" }));
                              setPreview(null);
                            }}
                          >
                            <SelectTrigger id={`asset-${item.id}`} className="w-full">
                              <SelectValue>
                                {availableAssets.find(
                                  (asset) => String(asset.id) === assetsByRequestedItem[String(item.id)],
                                )?.label ?? "Konkretes Fahrrad auswählen"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {availableAssets.map((asset) => (
                                <SelectItem
                                  key={asset.id}
                                  value={String(asset.id)}
                                  disabled={
                                    selectedAssetIds.has(String(asset.id)) &&
                                    assetsByRequestedItem[String(item.id)] !== String(asset.id)
                                  }
                                >
                                  {asset.label} · {formatEuro(asset.priceCents)} / Tag
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase sm:col-span-2">
                            Im Angebot enthalten
                          </p>
                          {(
                            [
                              { label: "Pedale", key: "needsPedals", type: item.accessories.pedalType },
                              {
                                label: "Computerhalterung",
                                key: "needsComputerMount",
                                type: item.accessories.computerMountType,
                              },
                              { label: "Helm", key: "needsHelmet", type: null },
                              { label: "Kleidung", key: "needsClothing", type: null },
                            ] as const
                          ).map(({ label, key, type }) => (
                            <label className="flex items-center gap-3 text-sm" key={key}>
                              <Checkbox
                                checked={Boolean(accessories[key as keyof OfferAccessorySelection])}
                                onCheckedChange={(checked) => {
                                  const enabled = Boolean(checked);
                                  const change: Partial<OfferAccessorySelection> =
                                    key === "needsPedals"
                                      ? { needsPedals: enabled }
                                      : key === "needsComputerMount"
                                        ? { needsComputerMount: enabled }
                                        : key === "needsHelmet"
                                          ? { needsHelmet: enabled }
                                          : { needsClothing: enabled };
                                  if (!enabled && (key === "needsPedals" || key === "needsComputerMount")) {
                                    if (key === "needsPedals") change.pedalType = null;
                                    if (key === "needsComputerMount") change.computerMountType = null;
                                  } else if (enabled && type) {
                                    if (key === "needsPedals") change.pedalType = type;
                                    if (key === "needsComputerMount") change.computerMountType = type;
                                  }
                                  updateOfferAccessories(item.id, change);
                                }}
                              />
                              <span>
                                {label}
                                {type ? ` · ${type}` : ""}
                              </span>
                            </label>
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Nicht ausgewählte Ausstattung wird in der Mail als nicht enthalten aufgeführt.
                        </p>
                      </div>
                    );
                  })}
                </div>
                {isAlternativeOffer && (
                  <Field>
                    <FieldLabel htmlFor="alternative-reason">Grund für die Änderung</FieldLabel>
                    <Select
                      value={alternativeReasonType}
                      onValueChange={(value) => {
                        setAlternativeReasonType((value as AlternativeReasonType) ?? "");
                        setPreview(null);
                      }}
                    >
                      <SelectTrigger id="alternative-reason" className="w-full">
                        <SelectValue>{alternativeReasonLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="size">Die andere Größe passt besser</SelectItem>
                        <SelectItem value="unavailable">Das gewünschte Fahrrad ist nicht verfügbar</SelectItem>
                        <SelectItem value="custom">Eigener Text</SelectItem>
                      </SelectContent>
                    </Select>
                    {alternativeReasonType === "custom" && (
                      <Textarea
                        value={customAlternativeReason}
                        onChange={(event) => {
                          setCustomAlternativeReason(event.target.value);
                          setPreview(null);
                        }}
                        placeholder="Warum wird ein anderes Fahrrad angeboten?"
                      />
                    )}
                    <FieldDescription>Der Grund wird in der Angebotsmail angezeigt.</FieldDescription>
                  </Field>
                )}
                <div className="flex items-center justify-between rounded-2xl bg-muted/60 p-4">
                  <div>
                    <p className="font-medium">Preis und Mailvorschau</p>
                    <p className="text-sm text-muted-foreground">Vor dem Versand serverseitig berechnen.</p>
                  </div>
                  <Button type="button" variant="outline" disabled={busy} onClick={loadPreview}>
                    Vorschau laden
                  </Button>
                </div>
                {preview && (
                  <div className="grid gap-4 rounded-2xl border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="secondary">{formatEuro(preview.quote.totalCents)}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {preview.quote.rentalDays} Miettage · Rabatt {formatEuro(preview.quote.discountCents)}
                      </span>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-sm font-medium">{preview.mail.subject}</p>
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">
                        {preview.mail.text}
                      </pre>
                    </div>
                  </div>
                )}
              </>
            )}
            {activeAction === "cancel" && (
              <>
                <Field>
                  <FieldLabel htmlFor="cancel-reason">Stornogrund</FieldLabel>
                  <Textarea
                    id="cancel-reason"
                    required
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cancel-fee">Stornogebühr in Euro</FieldLabel>
                  <Input
                    id="cancel-fee"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <FieldDescription>Zwischen 0,00 € und dem aktuellen Auftragswert.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="cancel-due">Fälligkeitsdatum (optional)</FieldLabel>
                  <Input
                    id="cancel-due"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </Field>
              </>
            )}
            {(activeAction === "payment" || activeAction === "refund") && (
              <>
                <Field>
                  <FieldLabel htmlFor="amount">Betrag in Euro</FieldLabel>
                  <Input
                    id="amount"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reason">Buchungstext</FieldLabel>
                  <Textarea id="reason" required value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
              </>
            )}
            {activeAction === "correct" && (
              <>
                <Field>
                  <FieldLabel>Zu korrigierende Journalbuchung</FieldLabel>
                  <Select value={entryId} onValueChange={(value) => setEntryId(value ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {journalEntries.find((entry) => String(entry.id) === entryId)?.label ?? "Journalbuchung wählen"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {journalEntries.map((entry) => (
                        <SelectItem key={entry.id} value={String(entry.id)}>
                          {entry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="correction-reason">Begründung</FieldLabel>
                  <Textarea
                    id="correction-reason"
                    required
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </Field>
              </>
            )}
            {activeAction === "reject" && (
              <Field>
                <FieldLabel htmlFor="reject-reason">Grund für die Absage</FieldLabel>
                <Select
                  value={rejectionReasonType}
                  onValueChange={(value) => {
                    setRejectionReasonType((value as RejectionReasonType) ?? "");
                    setCustomRejectionReason("");
                  }}
                >
                  <SelectTrigger id="reject-reason" className="w-full">
                    <SelectValue>{rejectionReasonLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="availability">Fahrrad Verfügbarkeit</SelectItem>
                    <SelectItem value="handover">Übergabezeiten</SelectItem>
                    <SelectItem value="custom">Anderen Grund</SelectItem>
                  </SelectContent>
                </Select>
                {rejectionReasonType === "custom" && (
                  <Textarea
                    value={customRejectionReason}
                    onChange={(event) => setCustomRejectionReason(event.target.value)}
                    placeholder="Grund für die Absage"
                  />
                )}
                <FieldDescription>Der ausgewählte Grund wird im Buchungsverlauf gespeichert.</FieldDescription>
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="font-medium">Vorschau der Absage-Mail</p>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">
                    {rejectionMailPreview}
                  </pre>
                </div>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={close}>
              Abbrechen
            </Button>
            <Button disabled={busy || missingRequiredReason} onClick={submit}>
              {busy
                ? "Wird gesendet…"
                : showOfferFields
                  ? "Angebot versenden"
                  : activeAction === "reject"
                    ? "Ablehnung schicken"
                    : "Aktion speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "check_out" ? "Ausgabe wirklich erfassen?" : "Buchung wirklich abschließen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "check_out"
                ? "Das Fahrrad wird als ausgegeben markiert."
                : "Nach dem Abschluss sind keine weiteren Statuswechsel möglich."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void confirmTransition();
              }}
            >
              {busy ? "Wird gespeichert…" : "Bestätigen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
