"use client";

import { useState } from "react";

import type { JournalEntry } from "@/components/accounting-journal-table";
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

export function JournalExpenseDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (entry: JournalEntry) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !reason.trim()) {
      setError("Bitte gib einen gültigen Betrag und eine Bezeichnung ein.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/admin/journal/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents, reason: reason.trim() }),
    });
    const result = (await response.json().catch(() => null)) as { entry?: JournalEntry; message?: string } | null;
    if (!response.ok || !result?.entry) {
      setError(
        result?.message ??
          "Der Aufwand konnte nicht gespeichert werden. Prüfe Betrag, Datum, Kategorie und Bezeichnung.",
      );
      setSaving(false);
      return;
    }

    onSaved(result.entry);
    setAmount("");
    setReason("");
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        <form onSubmit={saveExpense}>
          <Card className="rounded-4xl shadow-none ring-0">
            <CardHeader>
              <DialogHeader>
                <DialogTitle>Neuen Aufwand hinzufügen</DialogTitle>
                <DialogDescription>Der Aufwand wird als unveränderliche Journalbuchung gespeichert.</DialogDescription>
              </DialogHeader>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="journal-expense-amount">Betrag in Euro</FieldLabel>
                  <Input
                    id="journal-expense-amount"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="journal-expense-reason">Beschreibung</FieldLabel>
                  <Textarea
                    id="journal-expense-reason"
                    required
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={4}
                  />
                </Field>
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
