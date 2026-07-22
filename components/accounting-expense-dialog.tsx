"use client";

import { useState } from "react";

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

type AccountingExpense = {
  id: number;
  description: string;
  payeeName: string;
  paymentDate: string | null;
  depreciationDurationMonths: number | null;
  sumCents: number;
  createdBy: string;
  createdAt: Date;
};

type ExpenseValues = {
  description: string;
  payeeName: string;
  paymentDate: string;
  depreciationDurationMonths: string;
  sum: string;
};

const initialValues: ExpenseValues = {
  description: "",
  payeeName: "",
  paymentDate: "",
  depreciationDurationMonths: "",
  sum: "",
};

export function AccountingExpenseDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (expense: AccountingExpense) => void;
}) {
  const [values, setValues] = useState<ExpenseValues>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateValue<Key extends keyof ExpenseValues>(key: Key, value: ExpenseValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setValues(initialValues);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const sumCents = Math.round(Number(values.sum.replace(",", ".")) * 100);
    const depreciationDurationMonths = values.depreciationDurationMonths
      ? Number(values.depreciationDurationMonths)
      : null;

    if (!Number.isSafeInteger(sumCents) || sumCents < 0) {
      setError("Bitte gib eine gültige Summe ein.");
      setSaving(false);
      return;
    }
    if (
      depreciationDurationMonths !== null &&
      (!Number.isSafeInteger(depreciationDurationMonths) || depreciationDurationMonths < 1)
    ) {
      setError("Die Abschreibungsdauer muss eine ganze Zahl größer als 0 sein.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/admin/accounting/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: values.description,
        payeeName: values.payeeName,
        paymentDate: values.paymentDate,
        depreciationDurationMonths,
        sumCents,
      }),
    });
    const result = (await response.json().catch(() => null)) as
      | { expense?: Omit<AccountingExpense, "createdAt"> & { createdAt: string }; message?: string }
      | null;

    if (!response.ok || !result?.expense) {
      setError(result?.message || "Der Aufwand konnte nicht gespeichert werden.");
      setSaving(false);
      return;
    }

    onSaved({ ...result.expense, createdAt: new Date(result.expense.createdAt) });
    setSaving(false);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl p-0">
        <form onSubmit={saveExpense}>
          <Card className="rounded-4xl shadow-none ring-0">
            <CardHeader>
              <DialogHeader>
                <DialogTitle>Neuen Aufwand hinzufügen</DialogTitle>
                <DialogDescription>Erfasse einen neuen betrieblichen Aufwand.</DialogDescription>
              </DialogHeader>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="expense-description">Beschreibung</FieldLabel>
                  <Textarea
                    id="expense-description"
                    required
                    maxLength={2_000}
                    value={values.description}
                    onChange={(event) => updateValue("description", event.target.value)}
                    rows={3}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="expense-payee">Zahlungsempfänger</FieldLabel>
                  <Input
                    id="expense-payee"
                    required
                    maxLength={200}
                    value={values.payeeName}
                    onChange={(event) => updateValue("payeeName", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="expense-payment-date">Zahlungstag</FieldLabel>
                  <Input
                    id="expense-payment-date"
                    required
                    type="date"
                    value={values.paymentDate}
                    onChange={(event) => updateValue("paymentDate", event.target.value)}
                  />
                </Field>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="expense-sum">Summe in Euro</FieldLabel>
                    <Input
                      id="expense-sum"
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={values.sum}
                      onChange={(event) => updateValue("sum", event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="expense-depreciation">Abschreibungsdauer in Monaten</FieldLabel>
                    <Input
                      id="expense-depreciation"
                      type="number"
                      min="1"
                      step="1"
                      value={values.depreciationDurationMonths}
                      onChange={(event) => updateValue("depreciationDurationMonths", event.target.value)}
                    />
                  </Field>
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <DialogFooter className="w-full">
                <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
                <Button type="submit" disabled={saving}>
                  {saving ? "Speichern..." : "Aufwand speichern"}
                </Button>
              </DialogFooter>
            </CardFooter>
          </Card>
        </form>
      </DialogContent>
    </Dialog>
  );
}
