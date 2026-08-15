"use client";

import { Fragment, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ExternalLinkIcon, FileTextIcon } from "lucide-react";
import { toast } from "sonner";

import type {
  FinancialReviewAccount,
  FinancialReviewBooking,
  FinancialReviewCategory,
  FinancialReviewTransaction,
} from "@/components/financial-review-inbox";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Mode = "bank" | "manual";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatAmount(amountCents: number, currency = "EUR") {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amountCents / 100);
}

function formatBookedDate(value: string) {
  const dateOnly = value.trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!dateOnly) return value || "Datum unbekannt";
  const [year, month, day] = dateOnly.split("-");
  return `${day}.${month}.${year}`;
}

function bookingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    inquiry_received: "Anfrage eingegangen",
    offer_sent: "Angebot versendet",
    confirmed: "Bestätigt",
    checked_out: "Ausgabe erfolgt",
    completed: "Abgeschlossen",
    rejected: "Abgelehnt",
    cancelled: "Storniert",
    expired: "Abgelaufen",
  };
  return labels[status] ?? status;
}

function categoryDescription(category: FinancialReviewCategory) {
  if (category.euerTreatment === "transfer") return "interne Umbuchung · nicht EÜR-relevant";
  if (category.euerTreatment === "excluded") return "nicht in EÜR";
  if (category.euerTreatment === "asset_acquisition") return "Anlagegut · AfA/GWG prüfen";
  if (category.euerTreatment === "input_vat") return "Vorsteuer separat";
  if (category.euerTreatment === "output_vat") return "Umsatzsteuer separat";
  if (category.euerTreatment === "tax_payment") return "USt-Zahlung separat";
  if (category.euerTreatment === "needs_review") return "EÜR-Zuordnung offen";
  const euerLineLabels: Record<string, string> = {
    rental_income: "Mietumsatz",
    other_operating_income: "Sonstige betriebliche Einnahmen",
    services: "Fremdleistungen und Beratung",
    wages: "Löhne und Gehälter",
    depreciation: "Abschreibungen",
    rent: "Miete und Lager",
    repairs: "Reparaturen und Instandhaltung",
    insurance: "Versicherungen",
    advertising: "Werbung",
    office: "Büro und Verwaltung",
    travel: "Fahrt- und Reisekosten",
    other_operating_expense: "Sonstige betriebliche Ausgaben",
    vat: "Umsatzsteuer und Vorsteuer",
    asset_acquisition: "Anschaffung von Anlagegütern",
    not_applicable: "Nicht zutreffend",
  };
  return `${category.euerTreatment === "income" ? "Einnahme" : "Betriebsausgabe"} · ${euerLineLabels[category.euerLine] ?? category.euerLine}`;
}

function categoryGroups(categories: FinancialReviewCategory[]) {
  const available = categories.filter(
    (category) => category.euerTreatment !== "needs_review" && category.euerTreatment !== "input_vat",
  );
  return [
    { label: "Einnahmen", categories: available.filter((category) => category.euerTreatment === "income") },
    {
      label: "Betriebsausgaben",
      categories: available.filter((category) => ["expense", "fee"].includes(category.euerTreatment)),
    },
    {
      label: "Steuern und Vorsteuer",
      categories: available.filter((category) => ["output_vat", "tax_payment"].includes(category.euerTreatment)),
    },
    {
      label: "Anlagegüter",
      categories: available.filter((category) => category.euerTreatment === "asset_acquisition"),
    },
    {
      label: "Umbuchungen und nicht EÜR-relevante Vorgänge",
      categories: available.filter((category) => ["transfer", "excluded"].includes(category.euerTreatment)),
    },
  ].filter((group) => group.categories.length > 0);
}

function isLikelyStripePayout(row: FinancialReviewTransaction) {
  if (row.amountCents <= 0) return false;
  return [row.counterpartyName, row.reference, row.description]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("de-DE")
    .includes("stripe");
}

export function FinancialTransactionDialog({
  mode,
  open,
  onOpenChange,
  categories,
  accounts,
  bookings,
  bankTransaction,
  onBankCompleted,
  onManualCompleted,
}: {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinancialReviewCategory[];
  accounts: FinancialReviewAccount[];
  bookings?: FinancialReviewBooking[];
  bankTransaction?: FinancialReviewTransaction | null;
  onBankCompleted?: (result: { transactionId: number; status: "posted" | "ignored"; euerTreatment?: string }) => void;
  onManualCompleted?: (result: { transactionId: number }) => void;
}) {
  const isBank = mode === "bank";
  const [source, setSource] = useState<"cash" | "manual">("cash");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [ignoreReason, setIgnoreReason] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<"bike" | "equipment" | "other">("bike");
  const [assetCost, setAssetCost] = useState("");
  const [assetInServiceDate, setAssetInServiceDate] = useState(today());
  const [assetUsefulLifeMonths, setAssetUsefulLifeMonths] = useState("84");
  const [assetSerialNumber, setAssetSerialNumber] = useState("");
  const [privateShare, setPrivateShare] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<Array<{ id: number; originalFileName: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = categories.find((category) => String(category.id) === categoryId);
  const selectedBooking = bookings?.find((booking) => String(booking.id) === bookingId);
  const selectedDestinationAccount = accounts.find((account) => String(account.id) === destinationAccountId);
  const isAsset = selectedCategory?.euerTreatment === "asset_acquisition";

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (isBank && bankTransaction) {
        const suggestedCategory = isLikelyStripePayout(bankTransaction)
          ? categories.find((category) => category.code === "internal_transfer")
          : undefined;
        const existingCategory = bankTransaction.categoryId
          ? categories.find(
              (category) => category.id === bankTransaction.categoryId && category.euerTreatment !== "needs_review",
            )
          : undefined;
        const stripeAccount = accounts.find((account) => account.code === "stripe_main");
        setDate(bankTransaction.bookedAt.slice(0, 10));
        setAmount((Math.abs(bankTransaction.amountCents) / 100).toFixed(2));
        setAccountId(String(bankTransaction.financialAccountId));
        setCategoryId(
          existingCategory ? String(existingCategory.id) : suggestedCategory ? String(suggestedCategory.id) : "",
        );
        setDestinationAccountId(
          bankTransaction.destinationAccountId
            ? String(bankTransaction.destinationAccountId)
            : suggestedCategory && stripeAccount
              ? String(stripeAccount.id)
              : "",
        );
        setCounterpartyName(bankTransaction.counterpartyName ?? "");
        setDescription(bankTransaction.description || bankTransaction.reference || "");
        setNote(bankTransaction.description || bankTransaction.counterpartyName || "");
        setIgnoreReason("");
        setAssetName(bankTransaction.description || bankTransaction.counterpartyName || "");
        setAssetCost((Math.abs(bankTransaction.amountCents) / 100).toFixed(2));
        setAssetInServiceDate(bankTransaction.bookedAt.slice(0, 10));
        setAssetUsefulLifeMonths("84");
        setAssetSerialNumber("");
        setPrivateShare("0");
        setFile(null);
        setDocuments(bankTransaction.documents);
      } else if (!isBank) {
        setSource("cash");
        setDate(today());
        setAmount("");
        setAccountId(accounts.find((account) => account.code === "cash_main")?.id.toString() ?? "");
        setBookingId("");
        setCategoryId("");
        setDestinationAccountId("");
        setCounterpartyName("");
        setDescription("");
        setNote("");
        setIgnoreReason("");
        setAssetName("");
        setAssetCost("");
        setAssetInServiceDate(today());
        setAssetUsefulLifeMonths("84");
        setAssetSerialNumber("");
        setPrivateShare("0");
        setFile(null);
        setDocuments([]);
      }
      setError(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accounts, bankTransaction, categories, isBank, open]);

  function close(openState: boolean) {
    if (!openState && !busy) onOpenChange(false);
  }

  async function uploadDocument(transactionId: number) {
    if (!file) return null;
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(`/api/admin/financial/transactions/${transactionId}/documents`, {
      method: "POST",
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as { documentId?: number; message?: string } | null;
    if (!response.ok) throw new Error(result?.message ?? "Beleg konnte nicht gespeichert werden.");
    const document = { id: result?.documentId ?? 0, originalFileName: file.name };
    setDocuments((current) => [...current, document]);
    return document;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isBank && (!selectedCategory || selectedCategory.euerTreatment === "needs_review")) {
      setError("Bitte wähle eine sachliche Zuordnung mit konkreter EÜR-Zuordnung.");
      return;
    }
    if (!isBank && selectedCategory?.code === "rental_revenue" && !selectedBooking) {
      setError("Für Mieterträge muss eine Buchung zugewiesen werden.");
      return;
    }
    if (!isBank && selectedBooking && selectedCategory?.code !== "rental_revenue") {
      setError("Eine Buchung kann nur der sachlichen Zuordnung „Mieterträge“ zugewiesen werden.");
      return;
    }
    if ((!isBank && !selectedBooking && !description.trim()) || !note.trim()) {
      setError(isBank ? "Bitte gib einen Buchungstext an." : "Bitte gib eine Beschreibung und einen Buchungstext an.");
      return;
    }
    if (selectedCategory?.categoryType === "transfer" && !destinationAccountId) {
      setError("Für eine Umbuchung musst du das Zielkonto auswählen.");
      return;
    }
    const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
    const assetCostCents = Math.round(Number(assetCost.replace(",", ".")) * 100);
    const assetInputVatCents = 0;
    const assetLife = Number(assetUsefulLifeMonths);
    const privateShareCents = Math.round(Number(privateShare.replace(",", ".")) * 100);
    const mealInputVatCents = 0;
    if (!isBank && (!Number.isSafeInteger(amountCents) || amountCents <= 0)) {
      setError("Bitte gib einen gültigen Betrag ein.");
      return;
    }
    if (
      selectedCategory?.code === "business_meal" &&
      (!Number.isSafeInteger(privateShareCents) ||
        privateShareCents < 0 ||
        !Number.isSafeInteger(mealInputVatCents) ||
        mealInputVatCents < 0 ||
        privateShareCents + mealInputVatCents > Math.abs(isBank ? (bankTransaction?.amountCents ?? 0) : amountCents))
    ) {
      setError("Privatanteil und Vorsteuer müssen zum Geschäftsessen-Betrag passen.");
      return;
    }
    if (
      isAsset &&
      (!assetName.trim() ||
        !Number.isSafeInteger(assetCostCents) ||
        !Number.isSafeInteger(assetInputVatCents) ||
        !Number.isSafeInteger(assetLife) ||
        assetLife < 1)
    ) {
      setError("Bitte erfasse Name, Netto-Anschaffungskosten und Nutzungsdauer des Anlageguts.");
      return;
    }
    if (
      isAsset &&
      assetCostCents + assetInputVatCents !== Math.abs(isBank ? (bankTransaction?.amountCents ?? 0) : amountCents)
    ) {
      setError("Die Netto-Anschaffungskosten müssen dem Transaktionsbetrag entsprechen.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (isBank) {
        if (!bankTransaction) throw new Error("Keine Banktransaktion ausgewählt.");
        await uploadDocument(bankTransaction.id);
        const response = await fetch(`/api/admin/financial/transactions/${bankTransaction.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "post",
            categoryId: selectedCategory ? Number(categoryId) : undefined,
            bookingId: selectedBooking ? Number(bookingId) : undefined,
            destinationAccountId: destinationAccountId ? Number(destinationAccountId) : undefined,
            note: note.trim(),
            businessMeal:
              selectedCategory?.code === "business_meal"
                ? { privateShareCents, inputVatCents: mealInputVatCents }
                : undefined,
            asset: isAsset
              ? {
                  name: assetName,
                  assetType,
                  serialNumber: assetSerialNumber,
                  acquisitionDate: date,
                  inServiceDate: assetInServiceDate,
                  acquisitionCostCents: assetCostCents,
                  inputVatCents: assetInputVatCents,
                  usefulLifeMonths: assetLife,
                }
              : undefined,
          }),
        });
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(result?.message ?? "Transaktion konnte nicht gebucht werden.");
        onBankCompleted?.({
          transactionId: bankTransaction.id,
          status: "posted",
          euerTreatment: selectedCategory?.euerTreatment,
        });
        toast.success("Buchung wurde gespeichert und abgestimmt.");
      } else {
        const response = await fetch("/api/admin/financial/transactions/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source,
            bookedAt: date,
            amountCents,
            categoryId: selectedCategory ? Number(categoryId) : undefined,
            bookingId: selectedBooking ? Number(bookingId) : undefined,
            accountId: accountId ? Number(accountId) : undefined,
            destinationAccountId: destinationAccountId ? Number(destinationAccountId) : undefined,
            counterpartyName,
            description,
            note,
            businessMeal:
              selectedCategory?.code === "business_meal"
                ? { privateShareCents, inputVatCents: mealInputVatCents }
                : undefined,
            asset: isAsset
              ? {
                  name: assetName,
                  assetType,
                  serialNumber: assetSerialNumber,
                  acquisitionDate: date,
                  inServiceDate: assetInServiceDate,
                  acquisitionCostCents: assetCostCents,
                  inputVatCents: assetInputVatCents,
                  usefulLifeMonths: assetLife,
                }
              : undefined,
          }),
        });
        const result = (await response.json().catch(() => null)) as { message?: string; transactionId?: number } | null;
        if (!response.ok || !result?.transactionId)
          throw new Error(result?.message ?? "Transaktion konnte nicht gespeichert werden.");
        await uploadDocument(result.transactionId);
        onManualCompleted?.({ transactionId: result.transactionId });
        toast.success("Transaktion wurde gespeichert.");
      }
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Transaktion konnte nicht verarbeitet werden.");
    } finally {
      setBusy(false);
    }
  }

  async function ignore() {
    if (!isBank || !bankTransaction || !ignoreReason.trim()) {
      setError("Bitte begründe, warum die Transaktion ignoriert wird.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/financial/transactions/${bankTransaction.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ignore", reason: ignoreReason.trim() }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Transaktion konnte nicht ignoriert werden.");
      onBankCompleted?.({ transactionId: bankTransaction.id, status: "ignored" });
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Transaktion konnte nicht ignoriert werden.");
    } finally {
      setBusy(false);
    }
  }

  const accountLabel = isBank
    ? (bankTransaction?.accountName ?? "Bankkonto")
    : (accounts.find((account) => String(account.id) === accountId)?.name ?? "Automatisch: Kasse");

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isBank ? "Kontobewegung prüfen" : "Manuelle Transaktion erfassen"}</DialogTitle>
          <DialogDescription>
            {isBank
              ? `${formatBookedDate(bankTransaction?.bookedAt ?? "")} · ${accountLabel} · ${formatAmount(Math.abs(bankTransaction?.amountCents ?? 0), bankTransaction?.currency)}`
              : "Historische Zahlungen, Buchungseingänge und sonstige manuelle Vorgänge auf dem richtigen Finanzkonto erfassen."}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <ScrollArea className="min-h-0 pr-2">
          <form id="financial-transaction-form" onSubmit={save}>
            <FieldGroup className="mt-2">
              {isBank ? (
                <div className="grid gap-3 rounded-2xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Quelle</p>
                    <p className="font-medium">
                      {bankTransaction?.source === "bank" ? "Bank" : "Manuell"} · {accountLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Betrag</p>
                    <p className="font-medium">
                      {formatAmount(Math.abs(bankTransaction?.amountCents ?? 0), bankTransaction?.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gegenpartei</p>
                    <p className="font-medium">{counterpartyName || "Nicht angegeben"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Buchungsdatum</p>
                    <p className="font-medium">{formatBookedDate(date)}</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="financial-source">Quelle</FieldLabel>
                    <Select value={source} onValueChange={(value) => setSource((value || "cash") as "cash" | "manual")}>
                      <SelectTrigger id="financial-source" className="w-full">
                        <SelectValue>
                          {(value) => (value === "manual" ? "Sonstige manuelle Zahlung" : "Bargeld / Kasse")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="cash">Bargeld / Kasse</SelectItem>
                          <SelectItem value="manual">Sonstige manuelle Zahlung</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="financial-date">Buchungsdatum</FieldLabel>
                    <Input
                      id="financial-date"
                      required
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="financial-amount">Betrag in Euro</FieldLabel>
                    <Input
                      id="financial-amount"
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="financial-account">Finanzkonto</FieldLabel>
                    <Select value={accountId} onValueChange={(value) => setAccountId(value || "")}>
                      <SelectTrigger id="financial-account" className="w-full">
                        <SelectValue>
                          {(value) =>
                            `${accounts.find((account) => String(account.id) === String(value))?.name ?? "Automatisch: Kasse"}${accounts.find((account) => String(account.id) === String(value))?.status === "archived" ? " · archiviert" : ""}`
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.name}
                              {account.status === "archived" ? " · archiviert" : ""}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}
              {!isBank && selectedCategory?.code === "rental_revenue" && bookings?.length ? (
                <Field>
                  <FieldLabel htmlFor="financial-booking">Buchung zuweisen</FieldLabel>
                  <Select
                    value={bookingId}
                    onValueChange={(value) => {
                      const nextBookingId = value === "none" ? "" : value || "";
                      const nextBooking = bookings.find((booking) => String(booking.id) === nextBookingId);
                      setBookingId(nextBookingId);
                      if (nextBooking) {
                        setDescription(`Zahlung zu ${nextBooking.orderNumber}`);
                        setNote(`Zahlung zu ${nextBooking.orderNumber}`);
                      }
                      setError(null);
                    }}
                  >
                    <SelectTrigger id="financial-booking" className="w-full">
                      <SelectValue>
                        {(value) =>
                          bookings.find((booking) => String(booking.id) === String(value))
                            ? `${bookings.find((booking) => String(booking.id) === String(value))?.orderNumber} · ${bookings.find((booking) => String(booking.id) === String(value))?.customerName}`
                            : "Keine Buchung / allgemeine Transaktion"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Keine Buchung / allgemeine Transaktion</SelectItem>
                        {bookings.map((booking) => (
                          <SelectItem key={booking.id} value={String(booking.id)}>
                            {booking.orderNumber} · {booking.customerName} · {bookingStatusLabel(booking.status)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Bei Mieterträgen ist die Buchung erforderlich. Der Zahlungseingang wird direkt gegen die offene
                    Forderung gebucht.
                  </FieldDescription>
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="financial-category">Sachliche Zuordnung</FieldLabel>
                <Select
                  value={categoryId}
                  onValueChange={(value) => {
                    setCategoryId(value || "");
                    setBookingId("");
                    setDestinationAccountId("");
                    setError(null);
                  }}
                >
                  <SelectTrigger id="financial-category" className="w-full">
                    <SelectValue>
                      {(value) =>
                        categories.find((category) => String(category.id) === String(value))?.name ??
                        "Kategorie auswählen"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categoryGroups(categories).map((group, index) => (
                      <Fragment key={group.label}>
                        {index > 0 ? <SelectSeparator /> : null}
                        <SelectGroup>
                          <SelectLabel>{group.label}</SelectLabel>
                          {group.categories.map((category) => (
                            <SelectItem key={category.id} value={String(category.id)}>
                              {category.name} · {categoryDescription(category)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </Fragment>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {selectedCategory ? categoryDescription(selectedCategory) : "Wähle den konkreten Anlass der Zahlung."}
                </FieldDescription>
              </Field>
              {selectedCategory?.categoryType === "transfer" ? (
                <Field>
                  <FieldLabel htmlFor="financial-destination-account">Zielkonto</FieldLabel>
                  <Select value={destinationAccountId} onValueChange={(value) => setDestinationAccountId(value || "")}>
                    <SelectTrigger id="financial-destination-account" className="w-full">
                      <SelectValue>{selectedDestinationAccount?.name ?? "Zielkonto auswählen"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {accounts
                          .filter(
                            (account) =>
                              account.id !== (isBank ? bankTransaction?.financialAccountId : Number(accountId)),
                          )
                          .map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.name}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="financial-counterparty">Zahlungsempfänger / Zahler</FieldLabel>
                  <Input
                    id="financial-counterparty"
                    required={!isBank && !selectedBooking}
                    readOnly={isBank}
                    value={counterpartyName}
                    onChange={(event) => setCounterpartyName(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="financial-description">Beschreibung</FieldLabel>
                  <Input
                    id="financial-description"
                    required={!isBank || Boolean(selectedBooking)}
                    value={description}
                    readOnly={isBank}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>
              </div>
              {isAsset ? (
                <div className="grid gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="font-medium">Anlagegut</p>
                    <p className="text-xs text-muted-foreground">
                      Als Kleinunternehmer wird keine Vorsteuer erfasst; der Transaktionsbetrag entspricht den
                      Anschaffungskosten.
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="financial-asset-name">Bezeichnung</FieldLabel>
                    <Input
                      id="financial-asset-name"
                      required
                      value={assetName}
                      onChange={(event) => setAssetName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="financial-asset-type">Anlageart</FieldLabel>
                    <Select
                      value={assetType}
                      onValueChange={(value) => setAssetType((value || "bike") as "bike" | "equipment" | "other")}
                    >
                      <SelectTrigger id="financial-asset-type" className="w-full">
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
                    <FieldLabel htmlFor="financial-asset-cost">Netto-Anschaffungskosten</FieldLabel>
                    <Input
                      id="financial-asset-cost"
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={assetCost}
                      onChange={(event) => setAssetCost(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <div title="Als Kleinunternehmer bist du nicht zum Vorsteuerabzug berechtigt. Deshalb kann hier keine Vorsteuer erfasst werden.">
                      <FieldLabel htmlFor="financial-asset-vat" className="text-muted-foreground">
                        Vorsteuer (nicht verfügbar)
                      </FieldLabel>
                      <Input id="financial-asset-vat" type="number" value="0" disabled />
                    </div>
                    <FieldDescription>
                      Kleinunternehmer: Vorsteuer ist nicht abziehbar und wird deshalb nicht erfasst.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="financial-asset-service-date">Inbetriebnahme</FieldLabel>
                    <Input
                      id="financial-asset-service-date"
                      required
                      type="date"
                      value={assetInServiceDate}
                      onChange={(event) => setAssetInServiceDate(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="financial-asset-life">Nutzungsdauer in Monaten</FieldLabel>
                    <Input
                      id="financial-asset-life"
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={assetUsefulLifeMonths}
                      onChange={(event) => setAssetUsefulLifeMonths(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="financial-asset-serial">Seriennummer</FieldLabel>
                    <Input
                      id="financial-asset-serial"
                      value={assetSerialNumber}
                      onChange={(event) => setAssetSerialNumber(event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}
              {selectedCategory?.code === "business_meal" ? (
                <div className="grid gap-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="font-medium">Geschäftsessen aufteilen</p>
                    <p className="text-xs text-muted-foreground">
                      Der geschäftliche Anteil wird automatisch zu 70 % als EÜR-Aufwand und zu 30 % als nicht
                      abzugsfähig erfasst.
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="financial-private-share">Privatanteil brutto</FieldLabel>
                    <Input
                      id="financial-private-share"
                      type="number"
                      min="0"
                      step="0.01"
                      value={privateShare}
                      onChange={(event) => setPrivateShare(event.target.value)}
                    />
                    <FieldDescription>
                      Wird als Privatentnahme dokumentiert und nicht in die EÜR übernommen.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <div title="Als Kleinunternehmer bist du nicht zum Vorsteuerabzug berechtigt. Deshalb kann hier keine Vorsteuer erfasst werden.">
                      <FieldLabel htmlFor="financial-meal-input-vat" className="text-muted-foreground">
                        Abziehbare Vorsteuer (nicht verfügbar)
                      </FieldLabel>
                      <Input id="financial-meal-input-vat" type="number" value="0" disabled />
                    </div>
                    <FieldDescription>
                      Kleinunternehmer: Vorsteuer ist nicht abziehbar und wird deshalb nicht erfasst.
                    </FieldDescription>
                  </Field>
                </div>
              ) : null}
              <Field>
                <FieldLabel htmlFor="financial-note">Buchungstext / Begründung</FieldLabel>
                <Textarea
                  id="financial-note"
                  required
                  value={note}
                  readOnly={isBank}
                  maxLength={1000}
                  rows={3}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="financial-document">Beleg anhängen</FieldLabel>
                {documents.length > 0 ? (
                  <div className="grid gap-2">
                    {documents.map((document) => (
                      <a
                        key={document.id}
                        href={`/api/admin/financial/documents/${document.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800 hover:underline dark:text-emerald-300"
                      >
                        <FileTextIcon className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{document.originalFileName}</span>
                        <ExternalLinkIcon className="size-4 shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : null}
                <Input
                  id="financial-document"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </Field>
              {isBank ? (
                <Field>
                  <FieldLabel htmlFor="financial-ignore-reason">Grund für „Ignorieren“</FieldLabel>
                  <Input
                    id="financial-ignore-reason"
                    value={ignoreReason}
                    onChange={(event) => setIgnoreReason(event.target.value)}
                    placeholder="z. B. doppelt importiert / privat"
                    maxLength={1000}
                  />
                </Field>
              ) : null}
            </FieldGroup>
          </form>
        </ScrollArea>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
          <div>
            {isBank ? (
              <Button type="button" variant="destructive" disabled={busy} onClick={ignore}>
                Ignorieren
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={busy}>
                  Abbrechen
                </Button>
              }
            />
            <Button type="submit" form="financial-transaction-form" disabled={busy}>
              {busy ? "Wird gespeichert…" : isBank ? "Buchen & abstimmen" : "Transaktion speichern"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
