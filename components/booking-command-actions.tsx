"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronRightIcon, CircleDollarSignIcon, RefreshCwIcon, SendIcon, XIcon } from "lucide-react";
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { euroToCents, formatEuro } from "@/lib/bookings/money";
import { getBikeSizeWarning } from "@/lib/bikes/size-fit";
import { getComputerMountTypeLabel, getPedalTypeLabel } from "@/lib/inquiries/catalog";
import type { BookingStatus } from "@/lib/db/schema";

type OfferAccessorySelection = {
  needsPedals: boolean;
  pedalType: string | null;
  needsComputerMount: boolean;
  computerMountType: string | null;
  needsHelmet: boolean;
  needsClothing: boolean;
};
type RequestedItem = {
  id: number;
  label: string;
  requestedLabel: string;
  heightCm: number;
  accessories: OfferAccessorySelection;
};
type Asset = { id: number; label: string; priceCents: number };
type Entry = { id: number; label: string };
type PaymentAccount = { id: number; name: string; iban: string | null; type: string };
type Action = "offer" | "cancel" | "payment" | "refund" | "correct" | "reject";
type ConfirmAction = "check_out" | "complete" | null;
type AlternativeReasonType = "" | "size" | "unavailable" | "custom";
type RejectionReasonType = "" | "availability" | "handover" | "custom";
type CancellationPeriod = "more_than_7_days" | "between_7_days_and_24_hours" | "less_than_24_hours";

const cancellationPeriods: Array<{
  value: CancellationPeriod;
  label: string;
  feeRate: number;
}> = [
  { value: "more_than_7_days", label: "Mehr als 7 Tage vorher · 25 % Gebühr", feeRate: 0.25 },
  { value: "between_7_days_and_24_hours", label: "7 Tage bis 24 Stunden vorher · 50 % Gebühr", feeRate: 0.5 },
  { value: "less_than_24_hours", label: "Innerhalb von 24 Stunden · 100 % Gebühr", feeRate: 1 },
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Aktion fehlgeschlagen";
}

function ActionItem({
  icon,
  title,
  description,
  onClick,
  disabled,
  destructive = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
  destructive?: boolean;
}) {
  return (
    <Item
      className="min-h-24 cursor-pointer text-left hover:bg-muted/80 disabled:pointer-events-none disabled:opacity-50"
      render={<button type="button" disabled={disabled} onClick={onClick} />}
      variant={destructive ? "outline" : "muted"}
    >
      <ItemMedia variant="icon">
        <div
          className={
            destructive
              ? "flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
              : "flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
          }
        >
          {icon}
        </div>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Item>
  );
}

export function BookingCommandActions({
  bookingId,
  bookingTotalCents,
  status,
  customerName,
  senderName,
  canExecuteActions,
  requestedItems,
  availableAssets,
  unavailableAssetIds,
  journalEntries,
  paymentAccounts,
}: {
  bookingId: number;
  bookingTotalCents: number;
  status: BookingStatus;
  customerName: string;
  senderName: string;
  canExecuteActions: boolean;
  requestedItems: RequestedItem[];
  availableAssets: Asset[];
  unavailableAssetIds: number[];
  journalEntries: Entry[];
  paymentAccounts: PaymentAccount[];
}) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [bookedAt, setBookedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [financialAccountId, setFinancialAccountId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [cancellationPeriod, setCancellationPeriod] = useState<CancellationPeriod | "">("");
  const [entryId, setEntryId] = useState("");
  const [assetsByRequestedItem, setAssetsByRequestedItem] = useState<Record<string, string>>({});
  const [offerAccessories, setOfferAccessories] = useState<Record<string, OfferAccessorySelection>>({});
  const [alternativeReasonType, setAlternativeReasonType] = useState<AlternativeReasonType>("");
  const [customAlternativeReason, setCustomAlternativeReason] = useState("");
  const [rejectionReasonType, setRejectionReasonType] = useState<RejectionReasonType>("");
  const [customRejectionReason, setCustomRejectionReason] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [customOfferPrice, setCustomOfferPrice] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRequestId = useRef(0);
  const commandIdRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<{
    quote: {
      totalCents: number;
      bikeSubtotalCents: number;
      equipmentSubtotalCents: number;
      discountCents: number;
      rentalDays: number;
      offeredItems: Array<{ requestedLabel: string; assetName: string }>;
      calculatedTotalCents?: number;
      customPriceCents?: number;
    };
    mail: { subject: string; text: string; html: string };
  } | null>(null);

  const selectedAssetIds = useMemo(
    () => new Set(Object.values(assetsByRequestedItem).filter(Boolean)),
    [assetsByRequestedItem],
  );
  const unavailableAssetIdSet = useMemo(() => new Set(unavailableAssetIds), [unavailableAssetIds]);
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

${personalMessage.trim() ? `${personalMessage.trim()}\n\n` : ""}vielen Dank für deine Anfrage.

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
    setBookedAt(new Date().toISOString().slice(0, 10));
    setFinancialAccountId("");
    setDueDate("");
    setCancellationPeriod("");
    setEntryId("");
    setPreview(null);
    setAssetsByRequestedItem({});
    setOfferAccessories({});
    setAlternativeReasonType("");
    setCustomAlternativeReason("");
    setRejectionReasonType("");
    setCustomRejectionReason("");
    setPersonalMessage("");
    setCustomOfferPrice("");
    setPreviewError(null);
    setPreviewLoading(false);
    commandIdRef.current = null;
  };

  const openOffer = () => {
    setActiveAction("offer");
    setAssetsByRequestedItem({});
    setOfferAccessories(Object.fromEntries(requestedItems.map((item) => [String(item.id), { ...item.accessories }])));
    setAlternativeReasonType("");
    setCustomAlternativeReason("");
    setPreview(null);
    setPersonalMessage("");
    setCustomOfferPrice("");
    setPreviewError(null);
    setPreviewLoading(false);
  };

  const openReject = () => {
    setActiveAction("reject");
    setRejectionReasonType("");
    setCustomRejectionReason("");
    setPersonalMessage("");
    setPreviewError(null);
    setPreviewLoading(false);
  };

  const updateOfferAccessories = (itemId: number, change: Partial<OfferAccessorySelection>) => {
    setOfferAccessories((current) => ({
      ...current,
      [String(itemId)]: { ...current[String(itemId)], ...change },
    }));
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
  };

  const request = async (body: object) => {
    const command = (body as { command?: string }).command;
    const idempotencyKey =
      command === "payment" || command === "refund" ? (commandIdRef.current ??= crypto.randomUUID()) : undefined;
    const response = await fetch(`/api/admin/bookings/${bookingId}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(idempotencyKey ? { ...body, idempotencyKey } : body),
    });
    const result = (await response.json().catch(() => null)) as { message?: string; mailStatus?: string } | null;
    if (!response.ok) throw new Error(result?.message ?? "Aktion fehlgeschlagen");
    return result;
  };

  const submit = async () => {
    try {
      setBusy(true);
      if (activeAction === "offer") {
        const customTotalCents = customOfferPrice.trim() ? euroToCents(customOfferPrice) : undefined;
        if (customOfferPrice.trim() && customTotalCents === null)
          throw new Error("Bitte gib den individuellen Gesamtpreis als gültigen Euro-Betrag ein.");
        if (requestedItems.some((item) => !assetsByRequestedItem[String(item.id)]))
          throw new Error("Bitte wähle für jedes angefragte Fahrrad ein konkretes Asset.");
        if (Object.values(assetsByRequestedItem).some((assetId) => unavailableAssetIdSet.has(Number(assetId))))
          throw new Error("Mindestens ein ausgewähltes Fahrrad ist im angefragten Zeitraum bereits vermietet.");
        if (isAlternativeOffer && !alternativeReason)
          throw new Error("Bitte gib an, warum ein anderes Fahrrad angeboten wird.");
        const result = await request({
          command: "send_offer",
          assetsByRequestedItem: Object.fromEntries(
            Object.entries(assetsByRequestedItem).map(([key, value]) => [key, Number(value)]),
          ),
          accessoriesByRequestedItem: Object.fromEntries(
            Object.entries(offerAccessories).map(([key, value]) => [key, value]),
          ),
          alternative: isAlternativeOffer,
          alternativeReason: isAlternativeOffer ? alternativeReason : undefined,
          personalMessage: personalMessage.trim() || undefined,
          customTotalCents,
        });
        toast.success(
          result?.mailStatus === "sent"
            ? isAlternativeOffer
              ? "Alternativangebot wurde versendet."
              : "Angebot wurde versendet."
            : "Angebot wurde in die Outbox gelegt und wird später versendet.",
        );
      } else if (activeAction === "cancel") {
        if (!cancellationPeriod) throw new Error("Bitte wähle den Stornozeitraum aus.");
        const cancellationFeeCents = euroToCents(amount || "0");
        if (cancellationFeeCents === null) throw new Error("Bitte gib die Stornogebühr als gültigen Euro-Betrag ein.");
        await request({
          command: "cancel",
          reason,
          personalMessage: personalMessage.trim() || undefined,
          cancellationPeriod,
          cancellationFeeCents,
          dueAt: dueDate ? `${dueDate}T00:00:00.000Z` : undefined,
        });
        toast.success("Buchung wurde storniert.");
      } else if (activeAction === "payment" || activeAction === "refund") {
        const amountCents = euroToCents(amount);
        if (amountCents === null || (activeAction === "payment" ? amountCents === 0 : amountCents <= 0))
          throw new Error(
            activeAction === "payment"
              ? "Bitte gib einen von 0 € verschiedenen Euro-Betrag ein."
              : "Bitte gib einen positiven Euro-Betrag ein.",
          );
        if (!financialAccountId) throw new Error("Bitte wähle das Zahlungskonto bzw. die IBAN aus.");
        await request({
          command: activeAction,
          amountCents,
          bookedAt,
          financialAccountId: Number(financialAccountId),
          reason,
        });
        toast.success(activeAction === "payment" ? "Zahlung wurde erfasst." : "Erstattung wurde erfasst.");
      } else if (activeAction === "correct") {
        if (!entryId) throw new Error("Bitte wähle eine Journalbuchung aus.");
        await request({ command: "correct_journal", entryId: Number(entryId), reason });
        toast.success("Korrekturbuchung wurde angelegt.");
      } else if (activeAction === "reject") {
        if (!rejectionReason) throw new Error("Bitte wähle einen Grund für die Absage aus.");
        await request({
          command: "reject",
          reason: rejectionReason,
          personalMessage: personalMessage.trim() || undefined,
        });
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

  const loadPreview = useCallback(
    async (notify = true) => {
      const requestId = ++previewRequestId.current;
      try {
        if (requestedItems.some((item) => !assetsByRequestedItem[String(item.id)]))
          throw new Error("Bitte wähle zuerst für jedes Fahrrad ein Asset.");
        if (Object.values(assetsByRequestedItem).some((assetId) => unavailableAssetIdSet.has(Number(assetId))))
          throw new Error("Mindestens ein ausgewähltes Fahrrad ist im angefragten Zeitraum bereits vermietet.");
        if (isAlternativeOffer && !alternativeReason)
          throw new Error("Bitte gib an, warum ein anderes Fahrrad angeboten wird.");
        const customTotalCents = customOfferPrice.trim() ? euroToCents(customOfferPrice) : undefined;
        if (customOfferPrice.trim() && customTotalCents === null)
          throw new Error("Bitte gib den individuellen Gesamtpreis als gültigen Euro-Betrag ein.");
        setPreviewLoading(true);
        setPreviewError(null);
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
            personalMessage: personalMessage.trim() || undefined,
            customTotalCents,
          }),
        });
        const result = (await response.json().catch(() => null)) as typeof preview & { message?: string };
        if (!response.ok || !result) throw new Error(result?.message ?? "Vorschau konnte nicht erstellt werden.");
        if (requestId === previewRequestId.current) setPreview(result);
      } catch (error) {
        if (requestId === previewRequestId.current) {
          setPreviewError(errorMessage(error));
          if (notify) toast.error(errorMessage(error));
        }
      } finally {
        if (requestId === previewRequestId.current) setPreviewLoading(false);
      }
    },
    [
      alternativeReason,
      assetsByRequestedItem,
      bookingId,
      isAlternativeOffer,
      offerAccessories,
      personalMessage,
      customOfferPrice,
      requestedItems,
      unavailableAssetIdSet,
    ],
  );

  const previewInputsComplete =
    requestedItems.length > 0 &&
    requestedItems.every((item) => Boolean(assetsByRequestedItem[String(item.id)])) &&
    (!isAlternativeOffer || Boolean(alternativeReason));
  const previewInputsKey = JSON.stringify({
    assetsByRequestedItem,
    offerAccessories,
    alternativeReason,
    isAlternativeOffer,
    personalMessage,
    customOfferPrice,
  });

  useEffect(() => {
    if (activeAction !== "offer") {
      previewRequestId.current += 1;
      return;
    }
    if (!previewInputsComplete) {
      previewRequestId.current += 1;
      return;
    }
    const timer = window.setTimeout(() => void loadPreview(false), 250);
    return () => window.clearTimeout(timer);
  }, [activeAction, loadPreview, previewInputsComplete, previewInputsKey]);

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
          ? "Gib den Betrag und den Buchungstext ein."
          : activeAction === "refund"
            ? "Gib den Betrag und den Buchungstext ein."
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
          ? "Manuelle Zahlung erfassen"
          : activeAction === "refund"
            ? "Erstattung erfassen"
            : activeAction === "correct"
              ? "Journal korrigieren"
              : "Anfrage ablehnen";
  const actionsLocked = !canExecuteActions;

  return (
    <>
      {actionsLocked ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 sm:px-5">
          Für diese Buchung ist aktuell kein berechtigter Sachbearbeiter für Aktionen eingetragen. Bitte die Buchung dem
          zuständigen Sachbearbeiter zuweisen oder als Admin öffnen.
        </div>
      ) : null}
      <ItemGroup className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(status === "inquiry_received" || status === "offer_sent" || status === "expired") && (
          <ActionItem
            icon={<SendIcon />}
            title={status === "offer_sent" ? "Angebot überarbeiten" : "Angebot erstellen"}
            description="Fahrrad, Zubehör und Preis prüfen"
            disabled={actionsLocked}
            onClick={openOffer}
          />
        )}
        {status === "inquiry_received" && (
          <ActionItem
            icon={<XIcon />}
            title="Anfrage ablehnen"
            description="Absage mit Begründung senden"
            disabled={actionsLocked}
            onClick={openReject}
          />
        )}
        {status === "confirmed" && (
          <ActionItem
            icon={<CheckIcon />}
            title="Ausgabe erfassen"
            description="Fahrradübergabe dokumentieren"
            disabled={actionsLocked}
            onClick={() => setConfirmAction("check_out")}
          />
        )}
        {status === "checked_out" && (
          <ActionItem
            icon={<CheckIcon />}
            title="Buchung abschließen"
            description="Rückgabe bestätigen und Vorgang beenden"
            disabled={actionsLocked}
            onClick={() => setConfirmAction("complete")}
          />
        )}
        {["offer_sent", "confirmed"].includes(status) && (
          <ActionItem
            icon={<XIcon />}
            title="Buchung stornieren"
            description="Storno und Gebühr dokumentieren"
            disabled={actionsLocked}
            destructive
            onClick={() => setActiveAction("cancel")}
          />
        )}
        <ActionItem
          icon={<CircleDollarSignIcon />}
          title="Manuelle Zahlung erfassen"
          description="Zahlungseingang im Journal verbuchen"
          disabled={actionsLocked}
          onClick={() => setActiveAction("payment")}
        />
        <ActionItem
          icon={<RefreshCwIcon />}
          title="Erstattung erfassen"
          description="Erstattungsbetrag im Journal dokumentieren"
          disabled={actionsLocked}
          onClick={() => setActiveAction("refund")}
        />
      </ItemGroup>

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
                    const selectedAsset = availableAssets.find(
                      (asset) => String(asset.id) === assetsByRequestedItem[String(item.id)],
                    );
                    const sizeWarning = getBikeSizeWarning(selectedAsset?.label ?? item.requestedLabel, item.heightCm);
                    return (
                      <div className="rounded-xl border p-4" key={item.id}>
                        <Field>
                          <FieldLabel htmlFor={`asset-${item.id}`}>{item.label}</FieldLabel>
                          <Select
                            items={availableAssets.map((asset) => ({
                              value: String(asset.id),
                              label: `${asset.label} · ${formatEuro(asset.priceCents)} / Tag`,
                            }))}
                            value={assetsByRequestedItem[String(item.id)] ?? ""}
                            onValueChange={(value) => {
                              setAssetsByRequestedItem((current) => ({ ...current, [String(item.id)]: value ?? "" }));
                              setPreview(null);
                              setPreviewLoading(false);
                            }}
                          >
                            <SelectTrigger id={`asset-${item.id}`} className="w-full">
                              <SelectValue className="text-sm font-normal">
                                {availableAssets.find(
                                  (asset) => String(asset.id) === assetsByRequestedItem[String(item.id)],
                                )?.label ?? "Konkretes Fahrrad auswählen"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {availableAssets.map((asset) => (
                                  <SelectItem
                                    key={asset.id}
                                    value={String(asset.id)}
                                    disabled={
                                      unavailableAssetIdSet.has(asset.id) ||
                                      (selectedAssetIds.has(String(asset.id)) &&
                                        assetsByRequestedItem[String(item.id)] !== String(asset.id))
                                    }
                                  >
                                    {asset.label} · {formatEuro(asset.priceCents)} / Tag
                                    {unavailableAssetIdSet.has(asset.id) ? " · im Zeitraum belegt" : ""}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        {sizeWarning && (
                          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                            <p className="font-medium">Warnhinweis zur Rahmengröße</p>
                            <p className="mt-1">
                              {item.heightCm} cm liegen außerhalb der empfohlenen Größe {sizeWarning.selectedSize} (
                              {sizeWarning.selectedRange.minCm}–{sizeWarning.selectedRange.maxCm} cm).
                              {sizeWarning.recommendedRange
                                ? ` Für diese Körpergröße wird ${sizeWarning.recommendedRange.size} (${sizeWarning.recommendedRange.minCm}–${sizeWarning.recommendedRange.maxCm} cm) empfohlen.`
                                : " Bitte prüfe die Auswahl manuell."}
                            </p>
                          </div>
                        )}
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
                                {type
                                  ? ` · ${
                                      key === "needsPedals"
                                        ? getPedalTypeLabel(type, "de")
                                        : getComputerMountTypeLabel(type, "de")
                                    }`
                                  : ""}
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
                        setPreviewLoading(false);
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
                          setPreviewLoading(false);
                        }}
                        placeholder="Warum wird ein anderes Fahrrad angeboten?"
                      />
                    )}
                    <FieldDescription>Der Grund wird in der Angebotsmail angezeigt.</FieldDescription>
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="offer-personal-message">Persönliche Nachricht (optional)</FieldLabel>
                  <Textarea
                    id="offer-personal-message"
                    value={personalMessage}
                    onChange={(event) => {
                      setPersonalMessage(event.target.value);
                      setPreview(null);
                      setPreviewLoading(false);
                      setPreviewError(null);
                    }}
                    placeholder="Zum Beispiel eine persönliche Antwort auf eine Frage aus der Anfrage"
                    maxLength={2000}
                  />
                  <FieldDescription>
                    Dieser Text wird direkt oben nach der Anrede in die Angebotsmail eingefügt.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="offer-custom-price">Individueller Gesamtpreis (optional)</FieldLabel>
                  <Input
                    id="offer-custom-price"
                    inputMode="decimal"
                    value={customOfferPrice}
                    onChange={(event) => {
                      setCustomOfferPrice(event.target.value);
                      setPreview(null);
                      setPreviewLoading(false);
                      setPreviewError(null);
                    }}
                    placeholder="Automatisch berechneten Preis verwenden"
                  />
                </Field>
                <div className="flex items-center justify-between rounded-2xl bg-muted/60 p-4">
                  <div>
                    <p className="font-medium">Preis und Mailvorschau</p>
                    <p className="text-sm text-muted-foreground">
                      {previewLoading
                        ? "Vorschau wird automatisch aktualisiert…"
                        : previewInputsComplete
                          ? "Vorschau ist automatisch auf dem aktuellen Stand."
                          : "Vorschau erscheint, sobald alle Fahrräder ausgewählt sind."}
                    </p>
                  </div>
                </div>
                {previewInputsComplete && previewError && <p className="text-sm text-destructive">{previewError}</p>}
                {previewInputsComplete && preview && (
                  <div className="grid gap-4 rounded-2xl border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{formatEuro(preview.quote.totalCents)}</Badge>
                        {preview.quote.calculatedTotalCents !== undefined ? (
                          <Badge variant="outline">Individuell vereinbart</Badge>
                        ) : null}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {preview.quote.calculatedTotalCents !== undefined
                          ? `Standardberechnung: ${formatEuro(preview.quote.calculatedTotalCents)}`
                          : `${preview.quote.rentalDays} Miettage · Rabatt ${formatEuro(preview.quote.discountCents)}`}
                      </span>
                    </div>
                    <div className="overflow-hidden rounded-xl border bg-[#f5f6f8]">
                      <div className="border-b bg-card px-3 py-2">
                        <p className="text-sm font-medium">{preview.mail.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          HTML-Vorschau · responsive Mail mit Plaintext-Fallback
                        </p>
                      </div>
                      <iframe
                        title="HTML-Vorschau der Angebotsmail"
                        srcDoc={preview.mail.html}
                        sandbox=""
                        className="h-[620px] w-full bg-[#f5f6f8]"
                      />
                    </div>
                    <details className="rounded-xl border bg-muted/50 p-3">
                      <summary className="cursor-pointer text-sm font-medium">Plaintext-Fallback anzeigen</summary>
                      <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">
                        {preview.mail.text}
                      </pre>
                    </details>
                  </div>
                )}
              </>
            )}
            {activeAction === "cancel" && (
              <>
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Ursprünglicher Buchungsbetrag</p>
                  <p className="mt-1 text-xl font-semibold">{formatEuro(bookingTotalCents)}</p>
                </div>
                <Field>
                  <FieldLabel htmlFor="cancel-period">Stornozeitraum</FieldLabel>
                  <Select
                    value={cancellationPeriod}
                    onValueChange={(value) => {
                      const period = cancellationPeriods.find((option) => option.value === value);
                      setCancellationPeriod((value as CancellationPeriod) ?? "");
                      if (period) {
                        const feeCents = Math.round(bookingTotalCents * period.feeRate);
                        setAmount((feeCents / 100).toFixed(2).replace(".", ","));
                      }
                    }}
                  >
                    <SelectTrigger id="cancel-period" className="w-full">
                      <SelectValue>
                        {cancellationPeriods.find((period) => period.value === cancellationPeriod)?.label ??
                          "Stornozeitraum auswählen"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {cancellationPeriods.map((period) => (
                        <SelectItem key={period.value} value={period.value}>
                          {period.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Die Auswahl setzt die Stornogebühr automatisch. Mehr als 7 Tage: 75 % Erstattung, 7 Tage bis 24
                    Stunden: 50 %, innerhalb von 24 Stunden: keine Erstattung.
                  </FieldDescription>
                </Field>
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
                  <FieldLabel htmlFor="cancel-personal-message">Persönliche Nachricht (optional)</FieldLabel>
                  <Textarea
                    id="cancel-personal-message"
                    value={personalMessage}
                    onChange={(event) => setPersonalMessage(event.target.value)}
                    placeholder="Zum Beispiel eine persönliche Antwort oder weitere Hinweise zur Rückerstattung"
                    maxLength={2000}
                  />
                  <FieldDescription>Dieser Text wird zusätzlich in die Stornomail eingefügt.</FieldDescription>
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="amount">Betrag in Euro</FieldLabel>
                    <Input
                      id="amount"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                    {activeAction === "payment" && (
                      <FieldDescription>
                        Ein negativer Betrag wird als Erstattung/Stornierung dieser Rechnung erfasst.
                      </FieldDescription>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="booked-at">Erfasst am</FieldLabel>
                    <Input
                      id="booked-at"
                      type="date"
                      required
                      value={bookedAt}
                      onChange={(event) => setBookedAt(event.target.value)}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="payment-account">Zahlungskonto / IBAN</FieldLabel>
                  <Select value={financialAccountId} onValueChange={(value) => setFinancialAccountId(value ?? "")}>
                    <SelectTrigger id="payment-account" className="w-full">
                      <SelectValue>
                        {paymentAccounts.find((account) => String(account.id) === financialAccountId)?.name ??
                          "Konto auswählen"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {paymentAccounts.map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            {account.name} ·{" "}
                            {account.iban || (account.type === "cash" ? "Kasse" : "keine IBAN hinterlegt")}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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
                <div className="mt-4 space-y-2">
                  <FieldLabel htmlFor="reject-personal-message">Persönliche Nachricht (optional)</FieldLabel>
                  <Textarea
                    id="reject-personal-message"
                    value={personalMessage}
                    onChange={(event) => setPersonalMessage(event.target.value)}
                    placeholder="Zum Beispiel eine persönliche Antwort auf eine Frage aus der Anfrage"
                    maxLength={2000}
                  />
                  <FieldDescription>
                    Dieser Text wird direkt oben nach der Anrede in die Absage-Mail eingefügt.
                  </FieldDescription>
                </div>
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
            <Button disabled={busy || previewLoading || missingRequiredReason} onClick={submit}>
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
