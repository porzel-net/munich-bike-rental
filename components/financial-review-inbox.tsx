"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NevloSyncButton } from "@/components/nevlo-sync-button";
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export type FinancialReviewCategory = {
  id: number;
  code: string;
  name: string;
  categoryType: string;
  euerTreatment: string;
  euerLine: string;
};

export type FinancialReviewAccount = {
  id: number;
  code: string;
  name: string;
  currency: string;
};

export type FinancialReviewTransaction = {
  id: number;
  financialAccountId: number;
  accountName: string;
  accountCode: string;
  source: string;
  kind: string;
  status: string;
  euerTreatment: string | null;
  categoryId: number | null;
  destinationAccountId: number | null;
  amountCents: number;
  currency: string;
  bookedAt: string;
  valueDate: string | null;
  counterpartyName: string | null;
  reference: string;
  description: string;
  notes: string;
  documentCount: number;
  documents: Array<{ id: number; originalFileName: string }>;
};

function formatBookedDate(value: string) {
  const normalized = value.trim();
  if (!normalized) return "Datum unbekannt";
  const dateOnly = normalized.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly) {
    const [year, month, day] = dateOnly.split("-");
    return `${day}.${month}.${year}`;
  }
  const date = new Date(normalized);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date)
    : "Datum unbekannt";
}

function formatAmount(amountCents: number, currency = "EUR") {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amountCents / 100);
}

function statusLabel(status: string, euerTreatment: string | null) {
  if (status === "posted" && euerTreatment === "needs_review") return "Gebucht · EÜR offen";
  if (status === "posted") return "Gebucht & abgestimmt";
  if (status === "ignored") return "Ignoriert";
  return "Prüfung offen";
}

function categoryDescription(category: FinancialReviewCategory) {
  if (category.euerTreatment === "transfer") return "interne Umbuchung · nicht EÜR-relevant";
  if (category.euerTreatment === "excluded") return "nicht in EÜR";
  if (category.euerTreatment === "asset_acquisition") return "Anlagegut · AfA/GWG prüfen";
  if (category.euerTreatment === "input_vat") return "Vorsteuer separat";
  if (category.euerTreatment === "output_vat") return "Umsatzsteuer separat";
  if (category.euerTreatment === "tax_payment") return "USt-Zahlung separat";
  if (category.euerTreatment === "needs_review") return "EÜR-Zuordnung offen";
  return `${euerTreatmentLabel(category.euerTreatment)} · ${euerLineLabel(category.euerLine)}`;
}

function euerTreatmentLabel(value: string) {
  if (value === "income") return "Einnahme";
  if (value === "expense") return "Betriebsausgabe";
  if (value === "tax_payment") return "USt-Zahlung";
  if (value === "input_vat") return "Vorsteuer";
  if (value === "output_vat") return "Umsatzsteuer";
  if (value === "asset_acquisition") return "Anlagegut / Abschreibung prüfen";
  if (value === "transfer") return "Interne Umbuchung";
  if (value === "excluded") return "Nicht EÜR-relevant";
  return "EÜR-Zuordnung offen";
}

function euerLineLabel(value: string) {
  if (value === "rental_income") return "Vermietung";
  if (value === "other_operating_income") return "Sonstige Einnahmen";
  if (value === "services") return "Fremdleistungen";
  if (value === "wages") return "Löhne und Gehälter";
  if (value === "depreciation") return "Abschreibungen";
  if (value === "rent") return "Miete und Lager";
  if (value === "repairs") return "Reparaturen und Verbrauchsmaterial";
  if (value === "insurance") return "Versicherungen";
  if (value === "travel") return "Fahrt- und Reisekosten";
  if (value === "advertising") return "Werbung und Marketing";
  if (value === "office") return "Büro und Verwaltung";
  if (value === "other_operating_expense") return "Sonstige Betriebsausgaben";
  if (value === "vat") return "Umsatzsteuer";
  if (value === "asset_acquisition") return "Anschaffung eines Anlageguts";
  return "Noch nicht festgelegt";
}

function isLikelyStripePayout(row: FinancialReviewTransaction) {
  if (row.amountCents <= 0) return false;
  return [row.counterpartyName, row.reference, row.description]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("de-DE")
    .includes("stripe");
}

export function FinancialReviewInbox({
  transactions,
  categories,
  accounts,
  initialTransactionId,
  title = "Buchhaltung",
}: {
  transactions: FinancialReviewTransaction[];
  categories: FinancialReviewCategory[];
  accounts: FinancialReviewAccount[];
  initialTransactionId?: number;
  title?: string;
}) {
  const [rows, setRows] = useState(transactions);
  const [selected, setSelected] = useState<FinancialReviewTransaction | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [note, setNote] = useState("");
  const [ignoreReason, setIgnoreReason] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<"bike" | "equipment" | "other">("bike");
  const [assetCost, setAssetCost] = useState("");
  const [assetInputVat, setAssetInputVat] = useState("0");
  const [assetInServiceDate, setAssetInServiceDate] = useState("");
  const [assetUsefulLifeMonths, setAssetUsefulLifeMonths] = useState("84");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialReviewOpened = useRef(false);
  const openCount = rows.filter((row) => row.status !== "posted" && row.status !== "ignored").length;
  const visibleRows = useMemo(() => rows, [rows]);
  const selectedCategory = categories.find((category) => String(category.id) === categoryId);
  const selectedDestinationAccount = accounts.find((account) => String(account.id) === destinationAccountId);

  const openReview = useCallback(
    (row: FinancialReviewTransaction) => {
      setSelected(row);
      const suggestedCategory = isLikelyStripePayout(row)
        ? categories.find((category) => category.code === "internal_transfer")
        : undefined;
      const existingCategory = row.categoryId
        ? categories.find((category) => category.id === row.categoryId && category.euerTreatment !== "needs_review")
        : undefined;
      setCategoryId(
        existingCategory ? String(existingCategory.id) : suggestedCategory ? String(suggestedCategory.id) : "",
      );
      const stripeAccount = accounts.find((account) => account.code === "stripe_main");
      setDestinationAccountId(
        row.destinationAccountId
          ? String(row.destinationAccountId)
          : suggestedCategory && stripeAccount
            ? String(stripeAccount.id)
            : "",
      );
      setNote(row.description || row.counterpartyName || "");
      setIgnoreReason("");
      setAssetName(row.description || row.counterpartyName || "");
      setAssetType("bike");
      setAssetCost(row.amountCents < 0 ? (Math.abs(row.amountCents) / 100).toFixed(2) : "");
      setAssetInputVat("0");
      setAssetInServiceDate(row.bookedAt.slice(0, 10));
      setAssetUsefulLifeMonths("84");
      setFile(null);
      setError(null);
    },
    [accounts, categories],
  );

  useEffect(() => {
    if (!initialTransactionId || initialReviewOpened.current) return;
    const initialRow = rows.find((row) => row.id === initialTransactionId);
    if (!initialRow) return;
    initialReviewOpened.current = true;
    const timer = window.setTimeout(() => openReview(initialRow), 0);
    return () => window.clearTimeout(timer);
  }, [initialTransactionId, openReview, rows]);

  function closeReview(open: boolean) {
    if (!open && !busy) setSelected(null);
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
    return { id: result?.documentId ?? 0, originalFileName: file.name };
  }

  async function postTransaction() {
    if (
      !selected ||
      !categoryId ||
      !selectedCategory ||
      selectedCategory.euerTreatment === "needs_review" ||
      !note.trim()
    ) {
      setError("Bitte wähle eine sachliche Kategorie mit konkreter EÜR-Zuordnung.");
      return;
    }
    if (selectedCategory?.categoryType === "transfer" && !destinationAccountId) {
      setError("Für eine Umbuchung musst du das Zielkonto auswählen.");
      return;
    }
    const isAsset = selectedCategory.euerTreatment === "asset_acquisition";
    const assetCostCents = Math.round(Number(assetCost.replace(",", ".")) * 100);
    const assetInputVatCents = Math.round(Number(assetInputVat.replace(",", ".")) * 100);
    const assetLife = Number(assetUsefulLifeMonths);
    if (
      isAsset &&
      (!assetName.trim() ||
        !Number.isSafeInteger(assetCostCents) ||
        !Number.isSafeInteger(assetInputVatCents) ||
        !Number.isSafeInteger(assetLife))
    ) {
      setError("Bitte erfasse Name, Netto-Anschaffungskosten, Vorsteuer und Nutzungsdauer des Anlageguts.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const uploadedDocument = await uploadDocument(selected.id);
      if (uploadedDocument?.id) {
        setRows((current) =>
          current.map((row) => {
            if (row.id !== selected.id || row.documents.some((document) => document.id === uploadedDocument.id)) {
              return row;
            }
            const documents = [...row.documents, uploadedDocument];
            return { ...row, documents, documentCount: documents.length };
          }),
        );
      }
      const response = await fetch(`/api/admin/financial/transactions/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "post",
          categoryId: Number(categoryId),
          destinationAccountId: destinationAccountId ? Number(destinationAccountId) : undefined,
          note: note.trim(),
          asset: isAsset
            ? {
                name: assetName,
                assetType,
                acquisitionDate: selected.bookedAt.slice(0, 10),
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
      setRows((current) =>
        current.map((row) =>
          row.id === selected.id
            ? { ...row, status: "posted", euerTreatment: selectedCategory?.euerTreatment ?? row.euerTreatment }
            : row,
        ),
      );
      setSelected(null);
      toast.success("Buchung wurde gespeichert und abgestimmt.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Transaktion konnte nicht gebucht werden.");
    } finally {
      setBusy(false);
    }
  }

  async function ignoreTransaction() {
    if (!selected || !ignoreReason.trim()) {
      setError("Bitte begründe, warum die Transaktion ignoriert wird.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/financial/transactions/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ignore", reason: ignoreReason.trim() }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Transaktion konnte nicht ignoriert werden.");
      setRows((current) => current.map((row) => (row.id === selected.id ? { ...row, status: "ignored" } : row)));
      setSelected(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Transaktion konnte nicht ignoriert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <NevloSyncButton />
          <Badge variant={openCount ? "destructive" : "outline"}>{openCount} offen</Badge>
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl bg-card">
        <Table className="text-sm">
          <TableHeader className="[&_th]:h-9 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12" />
              <TableHead>Datum / Konto</TableHead>
              <TableHead>Gegenpartei / Verwendungszweck</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                  Noch keine Bankbewegungen importiert.
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50"
                  tabIndex={0}
                  onClick={() => openReview(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openReview(row);
                    }
                  }}
                >
                  <TableCell>
                    <div
                      className={`flex size-8 items-center justify-center rounded-md ${row.amountCents >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                    >
                      {row.amountCents >= 0 ? (
                        <ArrowDownLeftIcon className="size-4" />
                      ) : (
                        <ArrowUpRightIcon className="size-4" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{formatBookedDate(row.bookedAt)}</span>
                      <span className="text-xs text-muted-foreground">{row.accountName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-md flex-col">
                      <span className="truncate font-medium">{row.counterpartyName || "Unbekannte Gegenpartei"}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {row.description || row.reference || "Kein Verwendungszweck"}
                      </span>
                      {row.documentCount > 0 ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700">
                          <FileTextIcon className="size-3" /> Beleg hinterlegt
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "posted" && row.euerTreatment !== "needs_review"
                          ? "default"
                          : row.status === "ignored"
                            ? "outline"
                            : "destructive"
                      }
                    >
                      {statusLabel(row.status, row.euerTreatment)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums ${row.amountCents >= 0 ? "text-emerald-600" : "text-destructive"}`}
                  >
                    {row.amountCents >= 0 ? "+" : "−"}
                    {formatAmount(Math.abs(row.amountCents), row.currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {selected ? (
        <Dialog open onOpenChange={closeReview}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Kontobewegung prüfen</DialogTitle>
              <DialogDescription>
                {formatBookedDate(selected.bookedAt)} · {selected.accountName} ·{" "}
                {formatAmount(Math.abs(selected.amountCents), selected.currency)}
              </DialogDescription>
            </DialogHeader>
            <div
              className={
                error
                  ? "rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  : "hidden"
              }
            >
              {error}
            </div>
            <ScrollArea className="min-h-0 pr-2">
              <div className="grid gap-3 rounded-2xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Gegenpartei</p>
                  <p className="font-medium">{selected.counterpartyName || "Nicht angegeben"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Verwendungszweck</p>
                  <p className="font-medium">{selected.description || selected.reference || "Nicht angegeben"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bank-Referenz</p>
                  <p className="font-medium">{selected.reference || "Nicht angegeben"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Importstatus</p>
                  <p className="font-medium">{statusLabel(selected.status, selected.euerTreatment)}</p>
                </div>
              </div>
              {isLikelyStripePayout(selected) ? (
                <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  Diese Zahlung sieht nach einer Stripe-Auszahlung aus. Bitte als interne Umbuchung auf das
                  Stripe-Verrechnungskonto prüfen; sie darf dann nicht in die EÜR einfließen.
                </div>
              ) : null}
              <FieldGroup className="mt-6">
                <Field>
                  <FieldLabel htmlFor="financial-category">Sachliche Zuordnung</FieldLabel>
                  <Select
                    value={categoryId}
                    onValueChange={(value) => {
                      const nextCategoryId = value || "";
                      setCategoryId(nextCategoryId);
                      setDestinationAccountId("");
                      setError(null);
                    }}
                  >
                    <SelectTrigger id="financial-category" className="w-full">
                      <SelectValue>
                        {selectedCategory
                          ? `${selectedCategory.name} · ${categoryDescription(selectedCategory)}`
                          : "Kategorie auswählen"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {categories
                          .filter((category) => category.euerTreatment !== "needs_review")
                          .map((category) => (
                            <SelectItem key={category.id} value={String(category.id)}>
                              {category.name} · {categoryDescription(category)}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {selectedCategory?.euerTreatment === "needs_review"
                      ? "Die bisherige Kategorie ist noch ungeklärt. Wähle eine Kategorie mit konkreter EÜR-Zuordnung."
                      : selectedCategory
                        ? categoryDescription(selectedCategory)
                        : "Wähle den konkreten Anlass der Zahlung."}
                  </FieldDescription>
                </Field>
                {selectedCategory?.categoryType === "transfer" ? (
                  <Field>
                    <FieldLabel htmlFor="financial-destination-account">Zielkonto</FieldLabel>
                    <Select
                      value={destinationAccountId}
                      onValueChange={(value) => setDestinationAccountId(value || "")}
                    >
                      <SelectTrigger id="financial-destination-account" className="w-full">
                        <SelectValue>{selectedDestinationAccount?.name ?? "Zielkonto auswählen"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {accounts
                            .filter((account) => account.id !== selected.financialAccountId)
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
                {selectedCategory?.euerTreatment === "asset_acquisition" ? (
                  <div className="grid gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <p className="font-medium">Anlagegut erfassen</p>
                      <p className="text-xs text-muted-foreground">
                        Netto-Anschaffungskosten plus Vorsteuer müssen dem Bankbetrag entsprechen.
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
                          <SelectValue />
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
                      <FieldLabel htmlFor="financial-asset-vat">Vorsteuer</FieldLabel>
                      <Input
                        id="financial-asset-vat"
                        type="number"
                        min="0"
                        step="0.01"
                        value={assetInputVat}
                        onChange={(event) => setAssetInputVat(event.target.value)}
                      />
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
                  </div>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="financial-note">Buchungstext / Begründung</FieldLabel>
                  <Textarea id="financial-note" value={note} maxLength={1000} rows={3} readOnly />
                </Field>
                <Field>
                  <FieldLabel htmlFor="financial-document">Beleg anhängen</FieldLabel>
                  {selected.documents.length > 0 ? (
                    <div className="grid gap-2">
                      {selected.documents.map((document) => (
                        <a
                          key={document.id}
                          href={`/api/admin/financial/documents/${document.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800 transition-colors hover:bg-emerald-500/10 hover:underline dark:text-emerald-300"
                        >
                          <FileTextIcon className="size-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{document.originalFileName}</span>
                          <ExternalLinkIcon className="size-4 shrink-0" />
                        </a>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Vorhandenen Beleg anklicken, um ihn sicher herunterzuladen.
                      </p>
                    </div>
                  ) : null}
                  <Input
                    id="financial-document"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                  />
                  <FieldDescription>
                    {selected.documents.length > 0
                      ? "Optional einen weiteren Beleg auswählen. Der Upload erfolgt mit „Buchen & abstimmen“."
                      : "Datei auswählen und anschließend „Buchen & abstimmen“ drücken. PDF, JPG, PNG oder WebP, maximal 15 MB."}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="financial-ignore-reason">Grund für „Ignorieren“</FieldLabel>
                  <Input
                    id="financial-ignore-reason"
                    value={ignoreReason}
                    onChange={(event) => setIgnoreReason(event.target.value)}
                    placeholder="z. B. doppelt importiert / privat"
                    maxLength={1000}
                  />
                  <FieldDescription>
                    Auch ignorierte Bewegungen bleiben für die Bankabstimmung im Kontoauszug erhalten.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </ScrollArea>
            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
              <Button type="button" variant="destructive" disabled={busy} onClick={ignoreTransaction}>
                Ignorieren
              </Button>
              <div className="flex gap-2">
                <DialogClose render={<Button type="button" variant="outline" disabled={busy} />}>Abbrechen</DialogClose>
                <Button type="button" disabled={busy} onClick={postTransaction}>
                  {busy ? "Wird gespeichert…" : "Buchen & abstimmen"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
