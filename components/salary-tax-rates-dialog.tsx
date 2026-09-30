"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type SalaryTaxRate = {
  year: number;
  incomeTaxBasisPoints: number | null;
};

type TaxRateDraft = {
  year: number;
  incomeTaxRate: string;
};

function toDraft(rate: SalaryTaxRate): TaxRateDraft {
  const format = (basisPoints: number | null) => (basisPoints === null ? "" : (basisPoints / 100).toString());
  return {
    year: rate.year,
    incomeTaxRate: format(rate.incomeTaxBasisPoints),
  };
}

function parseRate(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return null;
  const percent = Number(normalized);
  if (percent < 0 || percent > 100) return null;
  return Math.round(percent * 100);
}

export function SalaryTaxRatesDialog({
  initialRates,
  salaryYears,
}: {
  initialRates: SalaryTaxRate[];
  salaryYears: number[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<TaxRateDraft[]>(() => {
    const byYear = new Map(initialRates.map((rate) => [rate.year, toDraft(rate)]));
    salaryYears.forEach((year) => {
      if (!byYear.has(year)) byYear.set(year, toDraft({ year, incomeTaxBasisPoints: null }));
    });
    return [...byYear.values()].sort((a, b) => a.year - b.year);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addYear() {
    setDrafts((current) => {
      const year = Math.max(...current.map((draft) => draft.year)) + 1;
      return [...current, { year, incomeTaxRate: "" }].sort((a, b) => a.year - b.year);
    });
    setError(null);
  }

  function updateDraft(year: number, field: keyof Omit<TaxRateDraft, "year">, value: string) {
    setDrafts((current) => current.map((draft) => (draft.year === year ? { ...draft, [field]: value } : draft)));
  }

  async function saveRates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const years = drafts.map((draft) => {
      const incomeTaxBasisPoints = parseRate(draft.incomeTaxRate);
      if (incomeTaxBasisPoints === null) return null;
      return { year: draft.year, incomeTaxBasisPoints };
    });

    if (years.some((year) => year === null)) {
      setError(
        "Bitte trage für jedes Jahr einen Einkommensteuersatz zwischen 0 und 100 % ein (maximal zwei Nachkommastellen).",
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/accounting/salary-tax-rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ years }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Die Steuersätze konnten nicht gespeichert werden.");
      toast.success("Steuersätze gespeichert.");
      setOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Die Steuersätze konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Steuersatz festlegen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Einkommensteuersatz festlegen</DialogTitle>
            <DialogDescription>Lege den Einkommensteuersatz für jedes Jahr fest.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-6" onSubmit={saveRates}>
            {drafts.map((draft) => (
              <section key={draft.year} className="grid gap-4">
                <h3 className="text-base font-semibold">{draft.year}</h3>
                <FieldGroup className="grid gap-4">
                  <Field>
                    <FieldLabel htmlFor={`income-tax-${draft.year}`}>Einkommensteuer</FieldLabel>
                    <div className="relative">
                      <Input
                        id={`income-tax-${draft.year}`}
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={draft.incomeTaxRate}
                        onChange={(event) => updateDraft(draft.year, "incomeTaxRate", event.target.value)}
                        disabled={saving}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                  </Field>
                </FieldGroup>
              </section>
            ))}
            <Button type="button" variant="outline" onClick={addYear} disabled={saving}>
              Weiteres Jahr hinzufügen
            </Button>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={saving} />}>Abbrechen</DialogClose>
              <Button type="submit" disabled={saving || drafts.length === 0}>
                {saving ? "Speichern …" : "Steuersätze speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
