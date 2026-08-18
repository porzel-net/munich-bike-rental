"use client";

import { useState } from "react";
import { Archive, CheckCircle2, Landmark, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type FinancialAccount = {
  id: number;
  code: string;
  name: string;
  type: "bank" | "stripe_clearing" | "cash" | "card" | "other";
  status: "active" | "archived";
  iban: string | null;
  currency: string;
  provider: string | null;
  notes: string;
};

const accountTypes = [
  { value: "bank", label: "Bankkonto" },
  { value: "stripe_clearing", label: "Stripe-Verrechnung" },
  { value: "cash", label: "Kasse / Bargeld" },
  { value: "card", label: "Kartenkonto" },
  { value: "other", label: "Sonstiges" },
] as const;

function accountTypeLabel(type: FinancialAccount["type"]) {
  return accountTypes.find((item) => item.value === type)?.label ?? type;
}

function emptyForm() {
  return {
    code: "",
    name: "",
    type: "bank" as FinancialAccount["type"],
    currency: "EUR",
    iban: "",
    provider: "",
    notes: "",
  };
}

export function GlobalSettingsPanel({ initialAccounts }: { initialAccounts: FinancialAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [accountToChange, setAccountToChange] = useState<FinancialAccount | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  function closeDialog(open: boolean) {
    if (saving) return;
    setDialogOpen(open);
    if (!open) setForm(emptyForm());
  }

  async function createAccount() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/financial/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => null)) as {
        account?: FinancialAccount;
        message?: string;
      } | null;
      if (!response.ok || !result?.account)
        throw new Error(
          result?.message ??
            "Das Finanzkonto konnte nicht angelegt werden. Prüfe Kontokennung, Kontoname, Währung und Kontotyp.",
        );
      setAccounts((current) =>
        [...current, result.account!].sort((left, right) => left.name.localeCompare(right.name, "de")),
      );
      setDialogOpen(false);
      setForm(emptyForm());
      toast.success("Buchhaltungskonto angelegt.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Das Finanzkonto konnte nicht angelegt werden. Prüfe Kontokennung, Kontoname, Währung und Kontotyp.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus() {
    if (!accountToChange) return;
    const nextStatus = accountToChange.status === "active" ? "archived" : "active";
    setStatusBusy(true);
    try {
      const response = await fetch(`/api/admin/financial/accounts/${accountToChange.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok)
        throw new Error(
          result?.message ??
            "Der Status des Finanzkontos konnte nicht geändert werden. Prüfe, ob das Konto noch vorhanden ist.",
        );
      setAccounts((current) =>
        current.map((account) => (account.id === accountToChange.id ? { ...account, status: nextStatus } : account)),
      );
      toast.success(nextStatus === "active" ? "Konto reaktiviert." : "Konto archiviert.");
      setAccountToChange(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Der Status des Finanzkontos konnte nicht geändert werden. Prüfe, ob das Konto noch vorhanden ist.",
      );
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-5xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="size-4 text-primary" />
          Interne Buchhaltungskonten
        </CardTitle>
        <CardDescription>
          Verwalte Bank-, Kassen- und Verrechnungskonten, die im Finanzbereich für manuelle Zuordnungen zur Verfügung
          stehen.
        </CardDescription>
        <CardAction>
          <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus /> Konto hinzufügen
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-5 rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Neue Konten werden automatisch auch im internen Kontenplan angelegt. Bestehende Buchungen bleiben beim
          Archivieren vollständig erhalten.
        </div>
        <Table className="[&_td]:px-3 [&_td]:py-4 [&_th]:px-3">
          <TableHeader>
            <TableRow>
              <TableHead>Konto</TableHead>
              <TableHead>Art</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{account.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{account.code}</span>
                  </div>
                </TableCell>
                <TableCell>{accountTypeLabel(account.type)}</TableCell>
                <TableCell>
                  <div className="flex flex-col text-sm text-muted-foreground">
                    <span>
                      {account.currency}
                      {account.iban ? ` · ${account.iban}` : ""}
                    </span>
                    {account.provider ? <span>{account.provider}</span> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={account.status === "active" ? "success" : "secondary"}>
                    {account.status === "active" ? <CheckCircle2 /> : <Archive />}
                    {account.status === "active" ? "Aktiv" : "Archiviert"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAccountToChange(account)}
                    aria-label={`${account.status === "active" ? "Konto archivieren" : "Konto reaktivieren"}: ${account.name}`}
                  >
                    {account.status === "active" ? <Archive /> : <RotateCcw />}
                    <span className="sr-only">{account.status === "active" ? "Archivieren" : "Reaktivieren"}</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Neues Buchhaltungskonto</DialogTitle>
            <DialogDescription>
              Lege ein internes Konto an, das anschließend in manuellen Finanzzuordnungen ausgewählt werden kann.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="financial-account-code">Kontokennung</FieldLabel>
                <Input
                  id="financial-account-code"
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="z. B. paypal_main"
                  autoComplete="off"
                />
                <FieldDescription>Einmalig, ohne Leerzeichen; z. B. paypal_main.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="financial-account-name">Kontoname</FieldLabel>
                <Input
                  id="financial-account-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="PayPal-Verrechnungskonto"
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="financial-account-type">Kontoart</FieldLabel>
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    value && setForm((current) => ({ ...current, type: value as FinancialAccount["type"] }))
                  }
                >
                  <SelectTrigger id="financial-account-type" className="w-full">
                    <SelectValue>{accountTypeLabel(form.type)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {accountTypes.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="financial-account-currency">Währung</FieldLabel>
                <Input
                  id="financial-account-currency"
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                  }
                  placeholder="EUR"
                  maxLength={3}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="financial-account-iban">
                IBAN <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="financial-account-iban"
                value={form.iban}
                onChange={(event) => setForm((current) => ({ ...current, iban: event.target.value }))}
                placeholder="DE…"
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="financial-account-provider">
                Anbieter <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="financial-account-provider"
                value={form.provider}
                onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
                placeholder="intern, PayPal, Bank …"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="financial-account-notes">
                Notiz <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Textarea
                id="financial-account-notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Wofür wird dieses Konto verwendet?"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={saving} />}>Abbrechen</DialogClose>
            <Button type="button" onClick={() => void createAccount()} disabled={saving}>
              {saving ? "Wird angelegt …" : "Konto anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={accountToChange !== null}
        onOpenChange={(open) => !open && !statusBusy && setAccountToChange(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {accountToChange?.status === "active" ? "Konto archivieren?" : "Konto reaktivieren?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {accountToChange?.status === "active"
                ? `${accountToChange.name} wird nicht gelöscht, steht aber nicht mehr für neue Zuordnungen zur Verfügung.`
                : `${accountToChange?.name ?? "Das Konto"} wird wieder für neue Zuordnungen freigeschaltet.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusBusy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => void changeStatus()} disabled={statusBusy}>
              {statusBusy ? "Speichert …" : accountToChange?.status === "active" ? "Archivieren" : "Reaktivieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
