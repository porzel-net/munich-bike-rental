"use client";

import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import type { AccountingRevenue, AccountingRevenuePayment } from "@/components/accounting-revenues-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

type PaymentValues = {
  amount: string;
  receivedAt: string;
};

export type AccountingRevenuePatch = Pick<
  AccountingRevenue,
  "id" | "paidAmountCents" | "paymentReceivedAt" | "notes" | "payments"
>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function paymentValues(payments: AccountingRevenuePayment[]) {
  return payments.map((payment) => ({
    amount: (payment.amountCents / 100).toFixed(2),
    receivedAt: payment.receivedAt,
  }));
}

export function AccountingRevenueDialog({
  revenue,
  open,
  onOpenChange,
  onSaved,
}: {
  revenue: AccountingRevenue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (patch: AccountingRevenuePatch) => void;
}) {
  const [payments, setPayments] = useState<PaymentValues[]>(() => paymentValues(revenue.payments));
  const [notes, setNotes] = useState(revenue.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePayment(index: number, change: Partial<PaymentValues>) {
    setPayments((current) =>
      current.map((payment, paymentIndex) => (paymentIndex === index ? { ...payment, ...change } : payment)),
    );
  }

  function addPayment() {
    setPayments((current) => [...current, { amount: "", receivedAt: today() }]);
  }

  function removePayment(index: number) {
    setPayments((current) => current.filter((_, paymentIndex) => paymentIndex !== index));
  }

  async function saveRevenue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const parsedPayments = payments.map((payment) => ({
      amountCents: Math.round(Number(payment.amount.replace(",", ".")) * 100),
      receivedAt: payment.receivedAt,
    }));
    if (parsedPayments.some((payment) => !Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0)) {
      setError("Jede Teilüberweisung braucht einen gültigen Betrag.");
      setSaving(false);
      return;
    }
    if (parsedPayments.some((payment) => !/^\d{4}-\d{2}-\d{2}$/.test(payment.receivedAt))) {
      setError("Jede Teilüberweisung braucht ein gültiges Datum.");
      setSaving(false);
      return;
    }
    const paidAmountCents = parsedPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
    if (paidAmountCents > revenue.amountCents) {
      setError("Die Teilüberweisungen dürfen den Gesamtbetrag nicht überschreiten.");
      setSaving(false);
      return;
    }

    const response = await fetch(`/api/admin/accounting/revenues/${revenue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payments: parsedPayments, notes }),
    });
    const result = (await response.json().catch(() => null)) as {
      revenue?: AccountingRevenuePatch;
      message?: string;
    } | null;
    if (!response.ok || !result?.revenue) {
      setError(
        result?.message ??
          "Der Ertrag konnte nicht gespeichert werden. Prüfe Teilbeträge, Zahlungstage und den Gesamtbetrag.",
      );
      setSaving(false);
      return;
    }

    onSaved(result.revenue);
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto p-0">
        <form onSubmit={saveRevenue}>
          <Card className="rounded-4xl shadow-none ring-0">
            <CardHeader>
              <DialogHeader>
                <DialogTitle>Zahlungseingänge bearbeiten</DialogTitle>
                <DialogDescription>
                  {revenue.orderNumber} · Gesamtbetrag{" "}
                  {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
                    revenue.amountCents / 100,
                  )}
                </DialogDescription>
              </DialogHeader>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Teilüberweisungen</p>
                    <Button type="button" variant="outline" size="sm" onClick={addPayment}>
                      <PlusIcon /> Teilüberweisung hinzufügen
                    </Button>
                  </div>
                  {payments.length === 0 ? (
                    <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      Noch kein Zahlungseingang erfasst.
                    </p>
                  ) : (
                    payments.map((payment, index) => (
                      <div key={index} className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_1fr_auto]">
                        <Field>
                          <FieldLabel htmlFor={`revenue-payment-amount-${index}`}>Betrag in Euro</FieldLabel>
                          <Input
                            id={`revenue-payment-amount-${index}`}
                            required
                            type="number"
                            min="0.01"
                            step="0.01"
                            inputMode="decimal"
                            value={payment.amount}
                            onChange={(event) => updatePayment(index, { amount: event.target.value })}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`revenue-payment-date-${index}`}>Zahlungstag</FieldLabel>
                          <Input
                            id={`revenue-payment-date-${index}`}
                            required
                            type="date"
                            value={payment.receivedAt}
                            onChange={(event) => updatePayment(index, { receivedAt: event.target.value })}
                          />
                        </Field>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="self-end"
                          aria-label={`Teilüberweisung ${index + 1} entfernen`}
                          title="Teilüberweisung entfernen"
                          onClick={() => removePayment(index)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <Field>
                  <FieldLabel htmlFor="revenue-notes">Notizen</FieldLabel>
                  <Textarea
                    id="revenue-notes"
                    maxLength={5_000}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                  />
                </Field>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <DialogFooter className="w-full">
                <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
                <Button type="submit" disabled={saving}>
                  {saving ? "Speichern..." : "Zahlungen speichern"}
                </Button>
              </DialogFooter>
            </CardFooter>
          </Card>
        </form>
      </DialogContent>
    </Dialog>
  );
}
