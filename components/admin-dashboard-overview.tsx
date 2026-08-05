"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { Bar, BarChart, XAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
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
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemFooter, ItemGroup } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AdminBankAccount = {
  id: number;
  name: string;
  currency: string;
  balanceCents: number;
  balanceSource: "provider" | "calculated";
};

export type AdminActivityPoint = {
  month: string;
  amount: number;
};

type GoalScope = "all" | "munich";

type IncomeGoal = {
  scope: GoalScope;
  targetCents: number;
  currentCents: number;
};

type GoalDraft = Record<GoalScope, string>;

type AdminDashboardOverviewProps = {
  bankAccounts: AdminBankAccount[];
  activityData: AdminActivityPoint[];
  currentMonthKey: string;
  currentMonthLabel: string;
  latestBankSyncLabel: string | null;
};

const euroFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

const chartConfig = {
  amount: {
    label: "Kontobewegungen",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const goalScopes: Array<{ scope: GoalScope; label: string; description: string }> = [
  {
    scope: "all",
    label: "Alle Standorte",
    description: "Einnahmen aus dem Buchungsportal insgesamt",
  },
  {
    scope: "munich",
    label: "München",
    description: "Einnahmen aus dem Buchungsportal am Standort München",
  },
];

function formatEuro(cents: number) {
  return euroFormatter.format(cents / 100);
}

function formatInputAmount(cents: number) {
  return cents > 0 ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

function parseInputAmount(value: string) {
  const amount = Number(value.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function defaultGoals(): IncomeGoal[] {
  return goalScopes.map(({ scope }) => ({
    scope,
    targetCents: 0,
    // Portal revenue is not available yet and remains a visible placeholder.
    currentCents: 0,
  }));
}

function draftFromGoals(goals: IncomeGoal[]): GoalDraft {
  return {
    all: formatInputAmount(goals.find((goal) => goal.scope === "all")?.targetCents ?? 0),
    munich: formatInputAmount(goals.find((goal) => goal.scope === "munich")?.targetCents ?? 0),
  };
}

function readGoals(storageKey: string) {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return null;
    const value = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(value)) return null;
    const goals = value.filter(
      (goal): goal is IncomeGoal =>
        typeof goal === "object" &&
        goal !== null &&
        "scope" in goal &&
        (goal.scope === "all" || goal.scope === "munich") &&
        "targetCents" in goal &&
        typeof goal.targetCents === "number" &&
        "currentCents" in goal &&
        typeof goal.currentCents === "number",
    );
    return goals.length === goalScopes.length ? goals : null;
  } catch {
    return null;
  }
}

export function CardOverview({
  bankAccounts,
  activityData,
  latestBankSyncLabel,
}: Pick<AdminDashboardOverviewProps, "bankAccounts" | "activityData" | "latestBankSyncLabel">) {
  const totalBalanceCents = bankAccounts.reduce((sum, account) => sum + account.balanceCents, 0);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardContent>
          <CardDescription>Kontostand gesamt</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{formatEuro(totalBalanceCents)}</CardTitle>
          <CardDescription className="tabular-nums">
            {bankAccounts.length === 0
              ? "Noch kein Bankkonto importiert"
              : `${bankAccounts.length} ${bankAccounts.length === 1 ? "Bankkonto" : "Bankkonten"} verfügbar`}
          </CardDescription>
        </CardContent>
      </Card>
      <Card className="flex flex-col justify-between">
        <CardContent className="flex flex-1 flex-col justify-between">
          <div className="flex flex-col gap-1">
            <CardDescription>Letzte Synchronisierung</CardDescription>
            <CardTitle className="text-2xl">{latestBankSyncLabel ?? "—"}</CardTitle>
          </div>
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            render={<Link href="/admin/accounting" />}
          >
            Buchhaltung öffnen
          </Button>
        </CardContent>
      </Card>
      <Card className="col-span-2">
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardDescription>Jahresaktivität</CardDescription>
            <Badge variant="secondary">Bankdaten</Badge>
          </div>
          <ChartContainer config={chartConfig} className="h-20 w-full">
            <BarChart data={activityData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={4}
                axisLine={false}
                tickFormatter={(value) => String(value).slice(0, 1)}
                className="text-[10px]"
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent hideLabel formatter={(value) => <span>{formatEuro(Number(value))}</span>} />
                }
              />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function GoalProgress({ goal }: { goal: IncomeGoal }) {
  const progress = goal.targetCents > 0 ? Math.min(100, Math.round((goal.currentCents / goal.targetCents) * 100)) : 0;

  return (
    <>
      <span className="text-3xl font-semibold tabular-nums">
        {goal.targetCents > 0 ? formatEuro(goal.targetCents) : "Noch offen"}
      </span>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label={`${progress}% erreicht`}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
      </div>
    </>
  );
}

function SavingsTargets({
  currentMonthKey,
  currentMonthLabel,
  buyingPowerCents,
}: Pick<AdminDashboardOverviewProps, "currentMonthKey" | "currentMonthLabel"> & { buyingPowerCents: number }) {
  const storageKey = `munich-bike-rental:income-goals:${currentMonthKey}`;
  const [goals, setGoals] = useState<IncomeGoal[]>(defaultGoals);
  const [draft, setDraft] = useState<GoalDraft>(() => draftFromGoals(defaultGoals()));
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [hasLoadedGoals, setHasLoadedGoals] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedGoals = readGoals(storageKey);
      if (storedGoals) {
        setGoals(storedGoals);
        setDraft(draftFromGoals(storedGoals));
      }
      setHasLoadedGoals(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [storageKey]);

  useEffect(() => {
    if (hasLoadedGoals) window.localStorage.setItem(storageKey, JSON.stringify(goals));
  }, [goals, hasLoadedGoals, storageKey]);

  function openGoalDialog() {
    setDraft(draftFromGoals(goals));
    setErrorMessage(null);
    setGoalDialogOpen(true);
  }

  function saveGoals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const allCents = parseInputAmount(draft.all);
    const munichCents = parseInputAmount(draft.munich);
    if (allCents === null || munichCents === null) {
      setErrorMessage("Bitte gib für beide Bereiche einen gültigen Zielbetrag größer als 0 € ein.");
      return;
    }
    setGoals([
      { scope: "all", targetCents: allCents, currentCents: 0 },
      { scope: "munich", targetCents: munichCents, currentCents: 0 },
    ]);
    setSavedMessage(`Ziele für ${currentMonthLabel} gespeichert.`);
    setGoalDialogOpen(false);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle>Einnahmenziele</CardTitle>
            <CardDescription>Aktive Ziele für {currentMonthLabel}</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" onClick={openGoalDialog}>
                Neues Ziel
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-3">
              {goalScopes.map(({ scope, label, description }) => {
                const goal = goals.find((item) => item.scope === scope) ?? {
                  scope,
                  targetCents: 0,
                  currentCents: 0,
                };
                return (
                  <Item variant="muted" className="flex-col items-stretch" key={scope}>
                    <ItemContent className="gap-3">
                      <ItemDescription className="cn-font-heading text-xs font-medium tracking-wider text-muted-foreground uppercase">
                        {label}
                      </ItemDescription>
                      <ItemDescription>{description}</ItemDescription>
                      <GoalProgress goal={goal} />
                    </ItemContent>
                    <ItemFooter>
                      <span className="text-sm text-muted-foreground">
                        {goal.targetCents > 0
                          ? `${Math.min(100, Math.round((goal.currentCents / goal.targetCents) * 100))}% erreicht`
                          : "Noch kein Ziel"}
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {goal.currentCents > 0 ? formatEuro(goal.currentCents) : "Platzhalter: 0,00 €"}
                      </span>
                    </ItemFooter>
                  </Item>
                );
              })}
            </ItemGroup>
          </CardContent>
          <CardFooter>
            <CardDescription className="text-center">
              {savedMessage ?? "Die Einnahmen aus dem Buchungsportal werden vorerst als Platzhalter angezeigt."}
            </CardDescription>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Investition kaufen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <FieldGroup className="flex-1">
              <Field>
                <FieldLabel htmlFor="invest-amount">Zu investierender Betrag</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>€</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput id="invest-amount" defaultValue="1.000,00" />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="invest-type">Ordertyp</FieldLabel>
                <Select defaultValue="market">
                  <SelectTrigger id="invest-type" className="w-full">
                    <SelectValue>Market-Order</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market-Order</SelectItem>
                    <SelectItem value="limit">Limit-Order</SelectItem>
                    <SelectItem value="stop">Stop-Order</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>Market-Orders werden zum aktuellen Kurs ausgeführt.</FieldDescription>
              </Field>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Geschätzte Anteile</span>
                  <span className="text-sm font-semibold tabular-nums">Platzhalter</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Verfügbares Guthaben</span>
                  <span className="text-sm font-semibold tabular-nums">{formatEuro(buyingPowerCents)}</span>
                </div>
              </div>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button className="w-full">Order prüfen</Button>
            <CardDescription className="text-center">
              Transaktionen werden während der Handelszeiten üblicherweise innerhalb weniger Minuten ausgeführt.
            </CardDescription>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Ziel für {currentMonthLabel}</DialogTitle>
            <DialogDescription>
              ChatGPT-Zielassistent: Lege ein Einnahmenziel für alle Standorte und eines für München fest. Die aktuellen
              Einnahmen aus dem Buchungsportal sind noch Platzhalter.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
            Wie viel Umsatz möchtest du im aktuellen Monat insgesamt und in München erreichen?
          </div>
          <form className="grid gap-4" onSubmit={saveGoals}>
            {goalScopes.map(({ scope, label, description }) => (
              <Field key={scope}>
                <FieldLabel htmlFor={`goal-${scope}`}>{label}</FieldLabel>
                <FieldDescription>{description}</FieldDescription>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>€</InputGroupText>
                  </InputGroupAddon>
                  <Input
                    id={`goal-${scope}`}
                    value={draft[scope]}
                    placeholder="z. B. 25.000,00"
                    inputMode="decimal"
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, [scope]: event.target.value }));
                      setErrorMessage(null);
                    }}
                    className="rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                    required
                  />
                </InputGroup>
              </Field>
            ))}
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
              <Button type="submit">Ziele speichern</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AdminDashboardOverview({
  bankAccounts,
  activityData,
  currentMonthKey,
  currentMonthLabel,
  latestBankSyncLabel,
}: AdminDashboardOverviewProps) {
  const totalBalanceCents = bankAccounts.reduce((sum, account) => sum + account.balanceCents, 0);

  return (
    <div className="grid gap-6">
      <CardOverview bankAccounts={bankAccounts} activityData={activityData} latestBankSyncLabel={latestBankSyncLabel} />
      <SavingsTargets
        currentMonthKey={currentMonthKey}
        currentMonthLabel={currentMonthLabel}
        buyingPowerCents={totalBalanceCents}
      />
    </div>
  );
}
