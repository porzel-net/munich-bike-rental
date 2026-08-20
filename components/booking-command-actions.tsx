"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  PencilIcon,
  RefreshCwIcon,
  SendIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
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
import { BookingEditDialog, type EditableItem } from "@/components/booking-edit-dialog";
import { euroToCents, formatEuro } from "@/lib/bookings/money";
import { getBikeSizeWarning } from "@/lib/bikes/size-fit";
import { bikeMatchesRequestedLabel } from "@/lib/inventory/display-name";
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
type Asset = {
  id: number;
  label: string;
  nickname: string | null;
  modelTitle: string;
  size: string;
  modelLabel: string;
  priceCents: number;
};
type Entry = { id: number; label: string };
type PaymentAccount = { id: number; name: string; iban: string | null; type: string };
type Action =
  | "offer"
  | "stripe_payment"
  | "revoke_offer"
  | "cancel"
  | "refund"
  | "correct"
  | "reject"
  | "status"
  | "manual_confirm";
type ConfirmAction = "check_out" | "complete" | "delete_permanently" | null;
type AlternativeReasonType = "" | "size" | "unavailable" | "custom";
type RejectionReasonType = "" | "availability" | "handover" | "custom";
type CancellationPeriod = "more_than_7_days" | "between_7_days_and_24_hours" | "less_than_24_hours";
type OfferOption = {
  id: number;
  label: string;
  status: "sent" | "expired" | "accepted" | "revoked";
  totalCents: number;
};
type StripePayment = {
  id: string;
  amountCents: number;
  createdAt: number | null;
  customerEmail: string | null;
  offerId: number | null;
  offerMatchesBooking: boolean;
  assignedBookingId: number | null;
};

const bookingStatusLabels: Record<BookingStatus, string> = {
  inquiry_received: "Anfrage eingegangen",
  offer_sent: "Angebot versendet",
  confirmed: "Verbindlich gebucht",
  checked_out: "Fahrrad ausgegeben",
  completed: "Abgeschlossen",
  rejected: "Abgelehnt",
  cancelled: "Storniert",
  expired: "Angebot abgelaufen",
};

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
  return error instanceof Error
    ? error.message
    : "Die Buchungsaktion konnte nicht ausgeführt werden. Prüfe den aktuellen Buchungsstatus und die Eingaben.";
}

function BikeOptionLabel({
  asset,
  includePrice = true,
  suffix = "",
}: {
  asset: Asset;
  includePrice?: boolean;
  suffix?: string;
}) {
  return (
    <span>
      {asset.nickname ? <strong>{asset.nickname}</strong> : null}
      {asset.nickname ? " · " : null}
      <span>{asset.modelLabel}</span>
      {includePrice ? ` · ${formatEuro(asset.priceCents)} / Tag` : null}
      {suffix}
    </span>
  );
}

export function ActionItem({
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
  invoiceNumber,
  periodFrom,
  periodTo,
  pickupTime,
  dropoffTime,
  status,
  customerName,
  senderName,
  canExecuteActions,
  isAdmin,
  hasActiveOffer,
  offers,
  requestedItems,
  availableAssets,
  unavailableAssetIds,
  journalEntries,
  paymentAccounts,
  isLegacy,
  confirmedBookingEdit,
}: {
  bookingId: number;
  bookingTotalCents: number;
  invoiceNumber: string | null;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  status: BookingStatus;
  customerName: string;
  senderName: string;
  canExecuteActions: boolean;
  isAdmin: boolean;
  hasActiveOffer: boolean;
  offers: OfferOption[];
  requestedItems: RequestedItem[];
  availableAssets: Asset[];
  unavailableAssetIds: number[];
  journalEntries: Entry[];
  paymentAccounts: PaymentAccount[];
  isLegacy: boolean;
  confirmedBookingEdit?: {
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
    availableAssets: Asset[];
    requestedBikeOptions: string[];
    selectedAssetsByRequestedItem: Record<number, number>;
    concreteBikeEditingAllowed: boolean;
  };
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
  const [stripeSessionId, setStripeSessionId] = useState("");
  const [stripeOfferId, setStripeOfferId] = useState("");
  const [stripePayments, setStripePayments] = useState<StripePayment[]>([]);
  const [stripePaymentsLoading, setStripePaymentsLoading] = useState(false);
  const [stripePaymentsError, setStripePaymentsError] = useState<string | null>(null);
  const [assetsByRequestedItem, setAssetsByRequestedItem] = useState<Record<string, string>>({});
  const [offerAccessories, setOfferAccessories] = useState<Record<string, OfferAccessorySelection>>({});
  const [alternativeReasonType, setAlternativeReasonType] = useState<AlternativeReasonType>("");
  const [customAlternativeReason, setCustomAlternativeReason] = useState("");
  const [rejectionReasonType, setRejectionReasonType] = useState<RejectionReasonType>("");
  const [customRejectionReason, setCustomRejectionReason] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [sendMail, setSendMail] = useState(true);
  const [customOfferPrice, setCustomOfferPrice] = useState("");
  const [offerPeriodFrom, setOfferPeriodFrom] = useState(periodFrom);
  const [offerPeriodTo, setOfferPeriodTo] = useState(periodTo);
  const [offerPickupTime, setOfferPickupTime] = useState(pickupTime);
  const [offerDropoffTime, setOfferDropoffTime] = useState(dropoffTime);
  const [isStudent, setIsStudent] = useState(false);
  const [legacyStatus, setLegacyStatus] = useState<BookingStatus>(status);
  const [legacyPeriodFrom, setLegacyPeriodFrom] = useState(periodFrom);
  const [legacyPeriodTo, setLegacyPeriodTo] = useState(periodTo);
  const [legacyPickupTime, setLegacyPickupTime] = useState(pickupTime);
  const [legacyDropoffTime, setLegacyDropoffTime] = useState(dropoffTime);
  const [legacyPrice, setLegacyPrice] = useState((bookingTotalCents / 100).toFixed(2).replace(".", ","));
  const [legacyInvoiceNumber, setLegacyInvoiceNumber] = useState(invoiceNumber ?? "");
  const [legacyReason, setLegacyReason] = useState("");
  const [legacyAssetsByRequestedItem, setLegacyAssetsByRequestedItem] = useState<Record<string, string>>({});
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
  const offerDateRangeChanged = offerPeriodFrom !== periodFrom || offerPeriodTo !== periodTo;
  const unavailableAssetIdSet = useMemo(
    () => new Set(offerDateRangeChanged ? [] : unavailableAssetIds),
    [offerDateRangeChanged, unavailableAssetIds],
  );
  const isAlternativeOffer = requestedItems.some((item) => {
    const selectedAsset = availableAssets.find((asset) => String(asset.id) === assetsByRequestedItem[String(item.id)]);
    return Boolean(selectedAsset && !bikeMatchesRequestedLabel(selectedAsset, item.requestedLabel));
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

${
  personalMessage.trim()
    ? personalMessage.trim()
    : `vielen Dank für deine Anfrage.

Leider können wir dir für den Zeitraum kein passendes Fahrrad anbieten. Probiers gerne nochmal wann anders!

Wir hoffen, dass du fündig wirst und wünschen dir eine gute Fahrt.`
}

Liebe Grüße
${senderName.trim().split(/\s+/)[0] || senderName}`;
  const requiresReason =
    activeAction === "cancel" || activeAction === "refund" || activeAction === "correct" || activeAction === "reject";
  const close = () => {
    setActiveAction(null);
    setReason("");
    setAmount("");
    setBookedAt(new Date().toISOString().slice(0, 10));
    setFinancialAccountId("");
    setDueDate("");
    setCancellationPeriod("");
    setEntryId("");
    setStripeSessionId("");
    setStripeOfferId("");
    setStripePayments([]);
    setStripePaymentsError(null);
    setPreview(null);
    setAssetsByRequestedItem({});
    setOfferAccessories({});
    setAlternativeReasonType("");
    setCustomAlternativeReason("");
    setRejectionReasonType("");
    setCustomRejectionReason("");
    setPersonalMessage("");
    setSendMail(true);
    setCustomOfferPrice("");
    setOfferPeriodFrom(periodFrom);
    setOfferPeriodTo(periodTo);
    setOfferPickupTime(pickupTime);
    setOfferDropoffTime(dropoffTime);
    setIsStudent(false);
    setLegacyStatus(status);
    setLegacyPeriodFrom(periodFrom);
    setLegacyPeriodTo(periodTo);
    setLegacyPickupTime(pickupTime);
    setLegacyDropoffTime(dropoffTime);
    setLegacyPrice((bookingTotalCents / 100).toFixed(2).replace(".", ","));
    setLegacyInvoiceNumber(invoiceNumber ?? "");
    setLegacyReason("");
    setLegacyAssetsByRequestedItem({});
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
    setOfferPeriodFrom(periodFrom);
    setOfferPeriodTo(periodTo);
    setOfferPickupTime(pickupTime);
    setOfferDropoffTime(dropoffTime);
    setIsStudent(false);
    setPreviewError(null);
    setPreviewLoading(false);
  };

  const openStripePayment = () => {
    setStripeOfferId(String(offers.find((offer) => offer.status === "sent" || offer.status === "expired")?.id ?? ""));
    setStripeSessionId("");
    setStripePayments([]);
    setStripePaymentsLoading(true);
    setStripePaymentsError(null);
    setActiveAction("stripe_payment");
  };

  const openLegacyStatus = () => {
    setLegacyStatus(status);
    setLegacyPeriodFrom(periodFrom);
    setLegacyPeriodTo(periodTo);
    setLegacyPickupTime(pickupTime);
    setLegacyDropoffTime(dropoffTime);
    setLegacyPrice((bookingTotalCents / 100).toFixed(2).replace(".", ","));
    setLegacyInvoiceNumber(invoiceNumber ?? "");
    setLegacyReason("");
    setLegacyAssetsByRequestedItem({});
    setActiveAction("status");
  };

  const openManualConfirmation = () => {
    setLegacyPeriodFrom(periodFrom);
    setLegacyPeriodTo(periodTo);
    setLegacyPickupTime(pickupTime);
    setLegacyDropoffTime(dropoffTime);
    setLegacyPrice((bookingTotalCents / 100).toFixed(2).replace(".", ","));
    setLegacyAssetsByRequestedItem({});
    setActiveAction("manual_confirm");
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

  useEffect(() => {
    if (activeAction !== "stripe_payment") return;
    let cancelled = false;
    void fetch(`/api/admin/bookings/${bookingId}/stripe-payments`)
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as {
          payments?: StripePayment[];
          message?: string;
        } | null;
        if (!response.ok) throw new Error(result?.message ?? "Stripe-Zahlungen konnten nicht geladen werden.");
        if (!cancelled) setStripePayments(result?.payments ?? []);
      })
      .catch((error) => {
        if (!cancelled) setStripePaymentsError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setStripePaymentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAction, bookingId]);

  const request = async (body: object) => {
    const command = (body as { command?: string }).command;
    const idempotencyKey = command === "refund" ? (commandIdRef.current ??= crypto.randomUUID()) : undefined;
    const response = await fetch(`/api/admin/bookings/${bookingId}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(idempotencyKey ? { ...body, idempotencyKey } : body),
    });
    const result = (await response.json().catch(() => null)) as {
      message?: string;
      mailStatus?: string;
      accountingWarning?: string | null;
    } | null;
    if (!response.ok)
      throw new Error(
        result?.message ??
          "Die Aktion für diese Buchung konnte nicht ausgeführt werden. Prüfe Buchungsstatus und Eingaben.",
      );
    return result;
  };

  const submit = async () => {
    try {
      setBusy(true);
      if (activeAction === "offer") {
        const customTotalCents = customOfferPrice.trim() ? euroToCents(customOfferPrice) : undefined;
        if (customOfferPrice.trim() && customTotalCents === null)
          throw new Error("Bitte gib den individuellen Gesamtpreis als gültigen Euro-Betrag ein.");
        if (!offerPeriodFrom || !offerPeriodTo || !offerPickupTime || !offerDropoffTime)
          throw new Error("Bitte vervollständige Zeitraum und Übergabezeiten.");
        if (offerPeriodFrom > offerPeriodTo)
          throw new Error("Das Rückgabedatum muss am oder nach dem Abholdatum liegen.");
        if (requestedItems.some((item) => !assetsByRequestedItem[String(item.id)]))
          throw new Error("Bitte wähle für jedes angefragte Fahrrad ein konkretes verfügbares Fahrrad aus.");
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
          isStudent,
          alternative: isAlternativeOffer,
          alternativeReason: isAlternativeOffer ? alternativeReason : undefined,
          personalMessage: personalMessage.trim() || undefined,
          sendMail,
          customTotalCents,
          periodFrom: offerPeriodFrom,
          periodTo: offerPeriodTo,
          pickupTime: offerPickupTime,
          dropoffTime: offerDropoffTime,
        });
        toast.success(
          result?.mailStatus === "sent"
            ? isAlternativeOffer
              ? "Alternativangebot wurde versendet."
              : "Angebot wurde versendet."
            : sendMail
              ? "Angebot wurde versendet."
              : "Angebot wurde gespeichert. Es wurde keine Mail versendet.",
        );
      } else if (activeAction === "cancel") {
        if (!cancellationPeriod) throw new Error("Bitte wähle den Stornozeitraum aus.");
        const cancellationFeeCents = euroToCents(amount || "0");
        if (cancellationFeeCents === null) throw new Error("Bitte gib die Stornogebühr als gültigen Euro-Betrag ein.");
        await request({
          command: "cancel",
          reason,
          personalMessage: personalMessage.trim() || undefined,
          sendMail,
          cancellationPeriod,
          cancellationFeeCents,
          dueAt: dueDate ? `${dueDate}T00:00:00.000Z` : undefined,
        });
        toast.success("Buchung wurde storniert.");
      } else if (activeAction === "revoke_offer") {
        await request({ command: "revoke_offer", reason: reason.trim() || undefined });
        toast.success("Angebot wurde zurückgezogen. Der Hinweis ist jetzt online sichtbar.");
      } else if (activeAction === "refund") {
        const amountCents = euroToCents(amount);
        if (amountCents === null || amountCents <= 0) throw new Error("Bitte gib einen positiven Euro-Betrag ein.");
        if (!financialAccountId) throw new Error("Bitte wähle das Zahlungskonto bzw. die IBAN aus.");
        await request({
          command: activeAction,
          amountCents,
          bookedAt,
          financialAccountId: Number(financialAccountId),
          reason,
        });
        toast.success("Erstattung wurde erfasst.");
      } else if (activeAction === "correct") {
        if (!entryId) throw new Error("Bitte wähle eine Journalbuchung aus.");
        await request({ command: "correct_journal", entryId: Number(entryId), reason });
        toast.success("Korrekturbuchung wurde angelegt.");
      } else if (activeAction === "stripe_payment") {
        if (!stripeOfferId) throw new Error("Bitte wähle das Angebot aus, zu dem die Zahlung gehört.");
        if (!stripeSessionId) throw new Error("Bitte wähle eine Stripe-Zahlung aus.");
        const result = await request({
          command: "assign_stripe_payment",
          offerId: Number(stripeOfferId),
          sessionId: stripeSessionId,
          sendMail,
        });
        toast.success(
          result?.accountingWarning
            ? `Zahlung zugeordnet. Hinweis: ${result.accountingWarning}`
            : "Stripe-Zahlung wurde zugeordnet und die Buchung bestätigt.",
        );
      } else if (activeAction === "reject") {
        if (!rejectionReason) throw new Error("Bitte wähle einen Grund für die Absage aus.");
        await request({
          command: "reject",
          reason: rejectionReason,
          personalMessage: personalMessage.trim() || undefined,
          sendMail,
        });
        toast.success("Anfrage wurde abgelehnt.");
      } else if (activeAction === "manual_confirm") {
        const manualPriceCents = legacyPrice.trim() ? euroToCents(legacyPrice) : null;
        if (!legacyPeriodFrom || !legacyPeriodTo || !legacyPickupTime || !legacyDropoffTime)
          throw new Error("Bitte vervollständige Zeitraum und Übergabezeiten.");
        if (legacyPeriodFrom > legacyPeriodTo)
          throw new Error("Das Rückgabedatum muss am oder nach dem Abholdatum liegen.");
        if (manualPriceCents === null || manualPriceCents < 0)
          throw new Error("Bitte gib einen gültigen Gesamtpreis ein.");
        if (requestedItems.some((item) => !legacyAssetsByRequestedItem[String(item.id)]))
          throw new Error("Bitte wähle für jedes Fahrrad ein konkretes Fahrrad aus.");
        await request({
          command: "confirm_manual_booking",
          periodFrom: legacyPeriodFrom,
          periodTo: legacyPeriodTo,
          pickupTime: legacyPickupTime,
          dropoffTime: legacyDropoffTime,
          quotedTotalCents: manualPriceCents,
          assetsByRequestedItem: Object.fromEntries(
            Object.entries(legacyAssetsByRequestedItem).map(([key, value]) => [key, Number(value)]),
          ),
        });
        toast.success("Buchung wurde manuell als verbindlich gebucht.");
      } else if (activeAction === "status") {
        const needsBookingDetails = ["offer_sent", "confirmed", "checked_out", "completed"].includes(legacyStatus);
        const needsAssets = needsBookingDetails;
        const needsInvoice = ["confirmed", "checked_out", "completed"].includes(legacyStatus);
        const legacyPriceCents = legacyPrice.trim() ? euroToCents(legacyPrice) : null;
        if (needsBookingDetails && (!legacyPeriodFrom || !legacyPeriodTo || !legacyPickupTime || !legacyDropoffTime))
          throw new Error("Bitte vervollständige Zeitraum und Übergabezeiten.");
        if (needsBookingDetails && (legacyPriceCents === null || legacyPriceCents < 0))
          throw new Error("Bitte gib einen gültigen Gesamtpreis ein.");
        if (needsAssets && requestedItems.some((item) => !legacyAssetsByRequestedItem[String(item.id)]))
          throw new Error("Bitte wähle für jedes Fahrrad ein konkretes Fahrrad aus.");
        if (needsInvoice && !legacyInvoiceNumber.trim()) throw new Error("Bitte gib die Rechnungsnummer ein.");
        if (["rejected", "cancelled", "expired"].includes(legacyStatus) && !legacyReason.trim())
          throw new Error("Bitte gib einen Grund für diesen Status an.");
        await request({
          command: "set_legacy_status",
          status: legacyStatus,
          reason: legacyReason.trim() || undefined,
          details: needsBookingDetails
            ? {
                periodFrom: legacyPeriodFrom,
                periodTo: legacyPeriodTo,
                pickupTime: legacyPickupTime,
                dropoffTime: legacyDropoffTime,
                quotedTotalCents: legacyPriceCents!,
                assetsByRequestedItem: Object.fromEntries(
                  Object.entries(legacyAssetsByRequestedItem).map(([key, value]) => [key, Number(value)]),
                ),
                invoiceNumber: needsInvoice ? legacyInvoiceNumber.trim() : undefined,
              }
            : undefined,
        });
        toast.success("Status der importierten Buchung wurde geändert.");
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
          throw new Error("Bitte wähle zuerst für jedes angefragte Fahrrad ein konkretes verfügbares Fahrrad aus.");
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
            isStudent,
            alternative: isAlternativeOffer,
            alternativeReason: isAlternativeOffer ? alternativeReason : undefined,
            personalMessage: personalMessage.trim() || undefined,
            customTotalCents,
            periodFrom: offerPeriodFrom,
            periodTo: offerPeriodTo,
            pickupTime: offerPickupTime,
            dropoffTime: offerDropoffTime,
          }),
        });
        const result = (await response.json().catch(() => null)) as typeof preview & { message?: string };
        if (!response.ok || !result)
          throw new Error(
            result?.message ??
              "Die Angebotsvorschau konnte nicht erstellt werden. Prüfe Zeitraum, Übergabezeiten und Fahrradauswahl.",
          );
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
      isStudent,
      offerPeriodFrom,
      offerPeriodTo,
      offerPickupTime,
      offerDropoffTime,
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
    isStudent,
    offerPeriodFrom,
    offerPeriodTo,
    offerPickupTime,
    offerDropoffTime,
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
      await request({ command: confirmAction, ...(confirmAction === "check_out" ? { sendMail } : {}) });
      if (confirmAction === "delete_permanently") {
        toast.success("Buchung wurde endgültig gelöscht.");
        router.push("/admin/bookings");
        return;
      }
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
  const missingRequiredReason =
    activeAction === "reject"
      ? !rejectionReason
      : activeAction === "stripe_payment"
        ? !stripeOfferId || !stripeSessionId || stripePaymentsLoading
        : requiresReason && !reason.trim();
  const dialogDescription =
    activeAction === "manual_confirm"
      ? "Lege Zeitraum, Übergabezeiten, Gesamtbetrag und konkrete Fahrräder fest. Die Rechnungsnummer wird automatisch vergeben."
      : activeAction === "status"
        ? "Der Statuswechsel prüft automatisch, welche Buchungsdaten für den Zielstatus noch benötigt werden."
        : showOfferFields
          ? "Prüfe die Fahrradauswahl und die Ausstattung. Vor dem Versand kannst du die Mail noch ansehen."
          : activeAction === "revoke_offer"
            ? "Das Angebot wird sofort ungültig. Es wird keine neue E-Mail versendet; die Angebotsseite zeigt den Hinweis online an."
            : activeAction === "stripe_payment"
              ? "Wähle eine in Stripe als bezahlt ausgewiesene Zahlung aus. Das Angebot darf bereits abgelaufen sein; die Auswahl wird zusätzlich serverseitig geprüft."
              : activeAction === "reject"
                ? "Der Ablehnungsgrund wird gespeichert und eine Absage-Mail an die Kundin oder den Kunden gesendet."
                : activeAction === "cancel"
                  ? "Die Buchung wird storniert und der Vorgang wird dokumentiert."
                  : activeAction === "refund"
                    ? "Gib den Betrag und den Buchungstext ein."
                    : activeAction === "correct"
                      ? "Die Korrektur wird im Finanzjournal dokumentiert."
                      : "Die Aktion wird dokumentiert.";
  const title =
    activeAction === "manual_confirm"
      ? "Buchung manuell verbindlich buchen"
      : activeAction === "status"
        ? "Buchungsstatus ändern"
        : activeAction === "offer"
          ? status === "offer_sent"
            ? "Angebot überarbeiten"
            : "Angebot erstellen"
          : activeAction === "revoke_offer"
            ? "Angebot zurückziehen"
            : activeAction === "stripe_payment"
              ? "Stripe-Zahlung manuell zuordnen"
              : activeAction === "cancel"
                ? "Buchung stornieren"
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
        {confirmedBookingEdit ? (
          <BookingEditDialog
            bookingId={bookingId}
            {...confirmedBookingEdit}
            commercialEditingAllowed
            notifyCustomer
            availableAssets={confirmedBookingEdit.availableAssets}
            requestedBikeOptions={confirmedBookingEdit.requestedBikeOptions}
            selectedAssetsByRequestedItem={confirmedBookingEdit.selectedAssetsByRequestedItem}
            concreteBikeEditingAllowed={confirmedBookingEdit.concreteBikeEditingAllowed}
            trigger={(open) => (
              <ActionItem
                icon={<PencilIcon />}
                title="Buchungsinformationen ändern"
                description="Änderungsmail mit aktualisierten Daten senden"
                disabled={actionsLocked}
                onClick={open}
              />
            )}
          />
        ) : null}
        {isLegacy && (
          <ActionItem
            icon={<SlidersHorizontalIcon />}
            title="Status ändern"
            description="Importierte Buchung frei umstellen"
            disabled={actionsLocked}
            onClick={() => {
              openLegacyStatus();
            }}
          />
        )}
        {!isLegacy && ["inquiry_received", "offer_sent", "expired"].includes(status) && (
          <ActionItem
            icon={<CheckIcon />}
            title="Manuell verbindlich buchen"
            description="Zeitraum, Preis und Fahrrad festlegen – auch bei Überweisung"
            disabled={actionsLocked}
            onClick={openManualConfirmation}
          />
        )}
        {(status === "inquiry_received" || status === "offer_sent" || status === "expired") && (
          <ActionItem
            icon={<SendIcon />}
            title={status === "offer_sent" ? "Angebot überarbeiten" : "Angebot erstellen"}
            description="Fahrrad, Zubehör und Preis prüfen"
            disabled={actionsLocked}
            onClick={openOffer}
          />
        )}
        {(["offer_sent", "expired"] as BookingStatus[]).includes(status) &&
        offers.some((offer) => offer.status === "sent" || offer.status === "expired") ? (
          <ActionItem
            icon={<CheckIcon />}
            title="Stripe-Zahlung manuell zuordnen"
            description="Bezahlte Stripe-Zahlung auswählen und Buchung bestätigen"
            disabled={actionsLocked}
            onClick={openStripePayment}
          />
        ) : null}
        {status === "offer_sent" && hasActiveOffer && (
          <ActionItem
            icon={<XIcon />}
            title="Angebot zurückziehen"
            description="Online ungültig machen, ohne neue Mail zu senden"
            disabled={actionsLocked}
            destructive
            onClick={() => {
              setReason("");
              setActiveAction("revoke_offer");
            }}
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
          icon={<RefreshCwIcon />}
          title="Erstattung erfassen"
          description="Erstattungsbetrag im Journal dokumentieren"
          disabled={actionsLocked}
          onClick={() => setActiveAction("refund")}
        />
        {isAdmin && !["confirmed", "checked_out", "completed"].includes(status) ? (
          <ActionItem
            icon={<Trash2Icon />}
            title="Buchung endgültig löschen"
            description="Nur möglich, wenn keine Finanz- oder Ausgabedaten verknüpft sind"
            disabled={busy}
            destructive
            onClick={() => setConfirmAction("delete_permanently")}
          />
        ) : null}
      </ItemGroup>

      <Dialog open={activeAction !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {activeAction === "revoke_offer" && (
              <Field>
                <FieldLabel htmlFor="revoke-offer-reason">Grund (optional)</FieldLabel>
                <Textarea
                  id="revoke-offer-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="z. B. Fahrrad kurzfristig nicht verfügbar"
                  maxLength={500}
                />
                <FieldDescription>
                  Der Grund wird nur intern im Buchungsverlauf gespeichert und nicht per E-Mail versendet.
                </FieldDescription>
              </Field>
            )}
            {activeAction === "stripe_payment" && (
              <>
                <Field>
                  <FieldLabel htmlFor="stripe-offer">Angebot dieser Buchung</FieldLabel>
                  <Select value={stripeOfferId} onValueChange={(value) => setStripeOfferId(value ?? "")}>
                    <SelectTrigger id="stripe-offer" className="w-full">
                      <SelectValue>
                        {offers.find((offer) => String(offer.id) === stripeOfferId)?.label ?? "Angebot auswählen"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {offers
                        .filter((offer) => offer.status === "sent" || offer.status === "expired")
                        .map((offer) => (
                          <SelectItem key={offer.id} value={String(offer.id)}>
                            {offer.label} · {formatEuro(offer.totalCents)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="stripe-payment">Bezahlte Stripe-Zahlung</FieldLabel>
                  {stripePaymentsLoading ? <FieldDescription>Stripe-Zahlungen werden geladen…</FieldDescription> : null}
                  {stripePaymentsError ? <p className="text-sm text-destructive">{stripePaymentsError}</p> : null}
                  {!stripePaymentsLoading && !stripePaymentsError && stripePayments.length === 0 ? (
                    <FieldDescription>
                      Keine bezahlte Checkout-Zahlung aus dem letzten Jahr gefunden. Prüfe, ob die Zahlung in Stripe
                      wirklich den Status „Bezahlt“ hat.
                    </FieldDescription>
                  ) : null}
                  {stripePayments.length > 0 ? (
                    <Select value={stripeSessionId} onValueChange={(value) => setStripeSessionId(value ?? "")}>
                      <SelectTrigger id="stripe-payment" className="w-full">
                        <SelectValue>
                          {stripePayments.find((payment) => payment.id === stripeSessionId)?.id ??
                            "Stripe-Zahlung auswählen"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {stripePayments.map((payment) => (
                            <SelectItem key={payment.id} value={payment.id}>
                              {payment.id} · {formatEuro(payment.amountCents)}
                              {payment.createdAt
                                ? ` · ${new Date(payment.createdAt * 1_000).toLocaleString("de-DE")}`
                                : ""}
                              {payment.customerEmail ? ` · ${payment.customerEmail}` : ""}
                              {payment.offerMatchesBooking ? " · Angebot passt" : " · manuell prüfen"}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : null}
                  <FieldDescription>
                    Nur Zahlungen, die Stripe als bezahlt meldet, können ausgewählt werden. Betrag und Zahlung werden
                    beim Speichern nochmals geprüft.
                  </FieldDescription>
                </Field>
                <label className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
                  <Checkbox checked={sendMail} onCheckedChange={(checked) => setSendMail(Boolean(checked))} />
                  <span>
                    <span className="font-medium">Bestätigungsmail mitsenden</span>
                    <span className="block text-muted-foreground">
                      Deaktivieren, wenn die Zahlung nur intern zugeordnet werden soll.
                    </span>
                  </span>
                </label>
              </>
            )}
            {(activeAction === "manual_confirm" || activeAction === "status") && (
              <>
                {activeAction === "status" ? (
                  <Field>
                    <FieldLabel htmlFor="legacy-booking-status">Neuer Buchungsstatus</FieldLabel>
                    <Select
                      value={legacyStatus}
                      onValueChange={(value) => value && setLegacyStatus(value as BookingStatus)}
                    >
                      <SelectTrigger id="legacy-booking-status" className="w-full">
                        <SelectValue>{bookingStatusLabels[legacyStatus]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(bookingStatusLabels) as BookingStatus[]).map((value) => (
                          <SelectItem key={value} value={value}>
                            {bookingStatusLabels[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Je nach Zielstatus werden darunter die dafür notwendigen Buchungsdaten eingeblendet.
                    </FieldDescription>
                  </Field>
                ) : (
                  <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                    Diese Buchung wird ohne Angebots- oder Stripe-Zahlungsablauf verbindlich bestätigt. Eine bereits
                    eingegangene Überweisung kannst du anschließend in der Finanzübersicht zuordnen.
                  </div>
                )}
                {activeAction === "manual_confirm" ||
                ["offer_sent", "confirmed", "checked_out", "completed"].includes(legacyStatus) ? (
                  <>
                    <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                      Für die verbindliche Buchung müssen Zeitraum, Übergabezeiten, Preis und konkrete Fahrräder
                      hinterlegt werden.
                      {activeAction === "manual_confirm"
                        ? " Die nächste freie Rechnungsnummer wird automatisch vergeben."
                        : ["confirmed", "checked_out", "completed"].includes(legacyStatus)
                          ? " Zusätzlich ist eine gültige, lückenlose Rechnungsnummer erforderlich."
                          : ""}
                    </div>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="legacy-period-from">Abholdatum</FieldLabel>
                        <Input
                          id="legacy-period-from"
                          type="date"
                          value={legacyPeriodFrom}
                          onChange={(event) => setLegacyPeriodFrom(event.target.value)}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="legacy-pickup-time">Abholzeit</FieldLabel>
                        <Input
                          id="legacy-pickup-time"
                          type="time"
                          value={legacyPickupTime}
                          onChange={(event) => setLegacyPickupTime(event.target.value)}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="legacy-period-to">Rückgabedatum</FieldLabel>
                        <Input
                          id="legacy-period-to"
                          type="date"
                          value={legacyPeriodTo}
                          onChange={(event) => setLegacyPeriodTo(event.target.value)}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="legacy-dropoff-time">Rückgabezeit</FieldLabel>
                        <Input
                          id="legacy-dropoff-time"
                          type="time"
                          value={legacyDropoffTime}
                          onChange={(event) => setLegacyDropoffTime(event.target.value)}
                          required
                        />
                      </Field>
                    </FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="legacy-price">Gesamtpreis</FieldLabel>
                      <Input
                        id="legacy-price"
                        inputMode="decimal"
                        value={legacyPrice}
                        onChange={(event) => setLegacyPrice(event.target.value)}
                        placeholder="0,00"
                        required
                      />
                    </Field>
                    {activeAction === "status" && ["confirmed", "checked_out", "completed"].includes(legacyStatus) ? (
                      <Field>
                        <FieldLabel htmlFor="legacy-invoice-number">Rechnungsnummer</FieldLabel>
                        <Input
                          id="legacy-invoice-number"
                          value={legacyInvoiceNumber}
                          onChange={(event) => setLegacyInvoiceNumber(event.target.value.toUpperCase())}
                          placeholder="YBR-2026-0001"
                          pattern="YBR-[0-9]{4}-[0-9]{4}"
                          readOnly={Boolean(invoiceNumber)}
                          required
                        />
                      </Field>
                    ) : null}
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">Konkrete Fahrräder</p>
                        <p className="text-sm text-muted-foreground">
                          Wähle das tatsächlich zugeordnete Fahrrad für jede Anfrage.
                        </p>
                      </div>
                      {requestedItems.map((item) => (
                        <Field key={item.id}>
                          <FieldLabel htmlFor={`legacy-asset-${item.id}`}>{item.label}</FieldLabel>
                          <Select
                            value={legacyAssetsByRequestedItem[String(item.id)] ?? ""}
                            onValueChange={(value) =>
                              setLegacyAssetsByRequestedItem((current) => ({
                                ...current,
                                [String(item.id)]: value ?? "",
                              }))
                            }
                          >
                            <SelectTrigger id={`legacy-asset-${item.id}`} className="w-full">
                              <SelectValue>
                                {(() => {
                                  const asset = availableAssets.find(
                                    (candidate) =>
                                      String(candidate.id) === legacyAssetsByRequestedItem[String(item.id)],
                                  );
                                  return asset ? <BikeOptionLabel asset={asset} /> : "Fahrrad auswählen";
                                })()}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {availableAssets.map((asset) => (
                                  <SelectItem key={asset.id} value={String(asset.id)}>
                                    <BikeOptionLabel asset={asset} />
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                      ))}
                    </div>
                  </>
                ) : null}
                {activeAction === "status" && ["rejected", "cancelled", "expired"].includes(legacyStatus) ? (
                  <Field>
                    <FieldLabel htmlFor="legacy-status-reason">Begründung</FieldLabel>
                    <Textarea
                      id="legacy-status-reason"
                      value={legacyReason}
                      onChange={(event) => setLegacyReason(event.target.value)}
                      placeholder="Warum wurde dieser Status gesetzt?"
                      required
                    />
                  </Field>
                ) : null}
              </>
            )}
            {showOfferFields && (
              <>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="offer-period-from">Abholdatum im Angebot</FieldLabel>
                    <Input
                      id="offer-period-from"
                      type="date"
                      value={offerPeriodFrom}
                      onChange={(event) => {
                        setOfferPeriodFrom(event.target.value);
                        setPreview(null);
                        setPreviewError(null);
                      }}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="offer-pickup-time">Abholzeit im Angebot</FieldLabel>
                    <Input
                      id="offer-pickup-time"
                      type="time"
                      value={offerPickupTime}
                      onChange={(event) => {
                        setOfferPickupTime(event.target.value);
                        setPreview(null);
                      }}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="offer-period-to">Rückgabedatum im Angebot</FieldLabel>
                    <Input
                      id="offer-period-to"
                      type="date"
                      value={offerPeriodTo}
                      onChange={(event) => {
                        setOfferPeriodTo(event.target.value);
                        setPreview(null);
                        setPreviewError(null);
                      }}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="offer-dropoff-time">Rückgabezeit im Angebot</FieldLabel>
                    <Input
                      id="offer-dropoff-time"
                      type="time"
                      value={offerDropoffTime}
                      onChange={(event) => {
                        setOfferDropoffTime(event.target.value);
                        setPreview(null);
                      }}
                      required
                    />
                  </Field>
                </FieldGroup>
                <div className="space-y-4">
                  <label className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
                    <Checkbox
                      checked={isStudent}
                      onCheckedChange={(checked) => {
                        setIsStudent(Boolean(checked));
                        setPreview(null);
                        setPreviewError(null);
                        setPreviewLoading(false);
                      }}
                    />
                    <span>
                      <span className="font-medium">Studentenrabatt anwenden</span>
                      <span className="mt-1 block text-muted-foreground">
                        Der konfigurierte Studentenrabatt wird auf die Fahrradmiete angewendet.
                      </span>
                    </span>
                  </label>
                  {requestedItems.map((item) => {
                    const accessories = offerAccessories[String(item.id)] ?? item.accessories;
                    const selectedAsset = availableAssets.find(
                      (asset) => String(asset.id) === assetsByRequestedItem[String(item.id)],
                    );
                    const sizeWarning = getBikeSizeWarning(
                      selectedAsset?.modelLabel ?? item.requestedLabel,
                      item.heightCm,
                    );
                    return (
                      <div className="rounded-xl border p-4" key={item.id}>
                        <Field>
                          <FieldLabel htmlFor={`asset-${item.id}`}>{item.label}</FieldLabel>
                          <Select
                            value={assetsByRequestedItem[String(item.id)] ?? ""}
                            onValueChange={(value) => {
                              setAssetsByRequestedItem((current) => ({ ...current, [String(item.id)]: value ?? "" }));
                              setPreview(null);
                              setPreviewLoading(false);
                            }}
                          >
                            <SelectTrigger id={`asset-${item.id}`} className="w-full">
                              <SelectValue className="text-sm font-normal">
                                {(() => {
                                  const asset = availableAssets.find(
                                    (candidate) => String(candidate.id) === assetsByRequestedItem[String(item.id)],
                                  );
                                  return asset ? <BikeOptionLabel asset={asset} /> : "Konkretes Fahrrad auswählen";
                                })()}
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
                                    <BikeOptionLabel
                                      asset={asset}
                                      suffix={unavailableAssetIdSet.has(asset.id) ? " · im Zeitraum belegt" : ""}
                                    />
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
                <label className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
                  <Checkbox checked={sendMail} onCheckedChange={(checked) => setSendMail(Boolean(checked))} />
                  <span>
                    <span className="font-medium">Angebotsmail mitsenden</span>
                    <span className="block text-muted-foreground">
                      Deaktivieren, wenn nur das Angebot gespeichert werden soll.
                    </span>
                  </span>
                </label>
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
                <label className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
                  <Checkbox checked={sendMail} onCheckedChange={(checked) => setSendMail(Boolean(checked))} />
                  <span>
                    <span className="font-medium">Stornomail mitsenden</span>
                    <span className="block text-muted-foreground">
                      Deaktivieren, wenn keine Kund:innen-Mail versendet werden soll.
                    </span>
                  </span>
                </label>
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
            {activeAction === "refund" && (
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
                    Wenn du hier etwas einträgst, ersetzt es den Standardtext der Absage vollständig.
                  </FieldDescription>
                </div>
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="font-medium">Vorschau der Absage-Mail</p>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">
                    {rejectionMailPreview}
                  </pre>
                </div>
                <label className="mt-4 flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
                  <Checkbox checked={sendMail} onCheckedChange={(checked) => setSendMail(Boolean(checked))} />
                  <span>
                    <span className="font-medium">Absagemail mitsenden</span>
                    <span className="block text-muted-foreground">
                      Deaktivieren, wenn die Absage nur intern gespeichert werden soll.
                    </span>
                  </span>
                </label>
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
                  ? sendMail
                    ? "Angebot versenden"
                    : "Angebot speichern"
                  : activeAction === "revoke_offer"
                    ? "Angebot zurückziehen"
                    : activeAction === "stripe_payment"
                      ? "Zahlung zuordnen"
                      : activeAction === "manual_confirm"
                        ? "Verbindlich buchen"
                        : activeAction === "reject"
                          ? sendMail
                            ? "Ablehnung schicken"
                            : "Ablehnung speichern"
                          : "Aktion speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "check_out"
                ? "Ausgabe wirklich erfassen?"
                : confirmAction === "delete_permanently"
                  ? "Buchung endgültig löschen?"
                  : "Buchung wirklich abschließen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "check_out"
                ? "Das Fahrrad wird als ausgegeben markiert."
                : confirmAction === "delete_permanently"
                  ? "Der Vorgang wird vollständig aus der Datenbank entfernt. Diese Aktion kann nicht rückgängig gemacht werden. Finanz-, Rechnungs- und Ausgabedaten verhindern die Löschung automatisch."
                  : "Nach dem Abschluss sind keine weiteren Statuswechsel möglich."}
            </AlertDialogDescription>
            {confirmAction === "check_out" ? (
              <label className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
                <Checkbox checked={sendMail} onCheckedChange={(checked) => setSendMail(Boolean(checked))} />
                <span>
                  <span className="font-medium">Feedback-Mail mitsenden</span>
                  <span className="block text-muted-foreground">
                    Deaktivieren, wenn keine Mail zur Bewertung versendet werden soll.
                  </span>
                </span>
              </label>
            ) : null}
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
              {busy ? "Wird verarbeitet…" : confirmAction === "delete_permanently" ? "Endgültig löschen" : "Bestätigen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
