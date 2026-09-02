"use client";

import { AlertTriangleIcon, CheckCircle2Icon, ListChecksIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BikeDispositionPlan, BikeDispositionSuggestion } from "@/lib/ai/bike-disposition";

type BookingOption = { id: number; label: string; detail: string };

type AnalysisResponse = {
  message?: string;
  plan?: BikeDispositionPlan;
};

const kindLabels: Record<BikeDispositionSuggestion["kind"], string> = {
  exact_alternative: "Passend",
  size_alternative: "Andere Größe",
  model_alternative: "Anderes Modell",
  category_alternative: "Kategorie-Wechsel",
  date_alternative: "Anderer Zeitraum",
  reallocation: "Umbelegung",
  priority_review: "Manuelle Prüfung",
  no_safe_option: "Keine sichere Lösung",
};

function SuggestionCard({ suggestion }: { suggestion: BikeDispositionSuggestion }) {
  const isWarning = isWarningSuggestion(suggestion);
  return (
    <article className="rounded-2xl border bg-background/70 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isWarning ? "outline" : "success"}>{kindLabels[suggestion.kind]}</Badge>
      </div>
      <h3 className="mt-3 font-medium">{suggestion.title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {suggestion.kind === "reallocation" && suggestion.affectedBookingId && suggestion.affectedBookingRef ? (
          <>
            <Link
              className="font-medium underline-offset-4 hover:underline"
              href={`/admin/bookings/${suggestion.affectedBookingId}`}
            >
              {suggestion.affectedBookingRef}
            </Link>{" "}
            könnte nach manueller Prüfung auf {suggestion.replacementAssetName ?? "ein Ersatzfahrrad"} wechseln. Dadurch
            würde {suggestion.targetAssetName ?? "das angefragte Fahrrad"} für die neue Anfrage frei.
          </>
        ) : (
          suggestion.summary
        )}
      </p>
      {suggestion.kind !== "reallocation" && suggestion.affectedBookingId ? (
        <div className="mt-3 rounded-xl bg-muted/60 p-3 text-sm">
          <span className="font-medium">Betroffene Buchung: </span>
          <Link className="underline-offset-4 hover:underline" href={`/admin/bookings/${suggestion.affectedBookingId}`}>
            {suggestion.affectedBookingRef ?? `Buchung ${suggestion.affectedBookingId}`}
          </Link>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">{suggestion.fitNote}</p>
    </article>
  );
}

function isWarningSuggestion(suggestion: BikeDispositionSuggestion) {
  return (
    suggestion.kind === "category_alternative" ||
    suggestion.kind === "priority_review" ||
    suggestion.kind === "no_safe_option" ||
    suggestion.kind === "reallocation"
  );
}

function planHasWarnings(plan: BikeDispositionPlan) {
  return plan.suggestions.length === 0 || plan.suggestions.some(isWarningSuggestion);
}

function orderedSuggestions(result: AnalysisResponse) {
  if (!result.plan) return [];
  return result.plan.suggestions;
}

function closedBookingMessage(status: string) {
  if (status === "rejected")
    return "Die Buchung ist abgelehnt; deshalb werden keine aktuellen Dispositionsvorschläge angezeigt.";
  if (status === "cancelled")
    return "Die Buchung ist storniert; deshalb werden keine aktuellen Dispositionsvorschläge angezeigt.";
  if (status === "completed")
    return "Die Buchung ist abgeschlossen; deshalb werden keine aktuellen Dispositionsvorschläge angezeigt.";
  return null;
}

export function BikeDispositionAssistant({
  bookingOptions = [],
  bookingId: fixedBookingId,
  initialPlan = null,
}: {
  bookingOptions?: BookingOption[];
  bookingId?: number;
  initialPlan?: BikeDispositionPlan | null;
}) {
  const singleBooking = fixedBookingId !== undefined;
  const [bookingId, setBookingId] = useState(fixedBookingId?.toString() ?? bookingOptions[0]?.id.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(initialPlan ? { plan: initialPlan } : null);
  const hasWarnings = result?.plan ? planHasWarnings(result.plan) : false;

  const analyze = useCallback(async () => {
    if (!bookingId) return;
    setError(null);
    try {
      const response = await fetch("/api/admin/calendar/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ bookingId: Number(bookingId) }),
      });
      const payload = (await response.json().catch(() => null)) as AnalysisResponse | null;
      if (!response.ok) throw new Error(payload?.message ?? "Die Dispositionsanalyse konnte nicht geladen werden.");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Dispositionsanalyse konnte nicht geladen werden.");
    }
  }, [bookingId]);

  useEffect(() => {
    const refreshId = window.setTimeout(() => void analyze(), 0);
    return () => window.clearTimeout(refreshId);
  }, [analyze]);

  return (
    <Card className="mb-4 border-primary/15 bg-card/95">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ListChecksIcon className="size-4 text-primary" /> Dispositions-Assistent
          </CardTitle>
        </div>
        {!singleBooking ? (
          <CardDescription className="mt-1 max-w-3xl">
            Prüft für eine Anfrage passende Größen, andere Modelle, Kategorie-Wechsel und mögliche Umbelegungen im
            selben Standort.
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        {!singleBooking && !bookingOptions.length ? (
          <p className="text-sm text-muted-foreground">
            Für die aktuelle Kalenderauswahl gibt es keine analysierbare Buchung.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {singleBooking ? (
                <span aria-hidden="true" className="flex-1" />
              ) : (
                <>
                  <label className="sr-only" htmlFor="bike-disposition-booking">
                    Anfrage auswählen
                  </label>
                  <select
                    className="h-9 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    id="bike-disposition-booking"
                    value={bookingId}
                    onChange={(event) => {
                      setBookingId(event.target.value);
                      setResult(null);
                    }}
                  >
                    {bookingOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} · {option.detail}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            {result?.plan ? (
              <div className="mt-5 space-y-4">
                <div
                  className={`flex items-start gap-2 rounded-2xl border p-3 text-sm ${
                    hasWarnings ? "border-amber-600/25 bg-amber-600/5" : "border-emerald-600/20 bg-emerald-600/5"
                  }`}
                >
                  {hasWarnings ? (
                    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  ) : (
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  )}
                  <div>
                    <p className="font-medium">
                      {result.plan.suggestions.length
                        ? `${result.plan.suggestions.length} regelbasierte Vorschläge für ${result.plan.targetCustomerName}`
                        : (closedBookingMessage(result.plan.targetStatus) ??
                          `Keine aktuellen Vorschläge für ${result.plan.targetCustomerName}`)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Quelle: Regelprüfung</p>
                  </div>
                </div>
                {result.plan.suggestions.length ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {orderedSuggestions(result).map((suggestion) => (
                      <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                    ))}
                  </div>
                ) : (
                  <p
                    className={`rounded-2xl border p-4 text-sm text-muted-foreground ${
                      hasWarnings ? "border-amber-600/25 bg-amber-600/5" : "border-emerald-600/20 bg-emerald-600/5"
                    }`}
                  >
                    {closedBookingMessage(result.plan.targetStatus) ??
                      "Für diese Anfrage wurde keine Abweichung nötig gefunden."}
                  </p>
                )}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
