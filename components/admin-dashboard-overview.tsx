"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PasskeyPrompt } from "@/components/passkey-prompt";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
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
import { Item, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const activityChartConfig = {
  amount: {
    label: "Activity",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const enduraceRevenueChartConfig = {
  amount: {
    label: "Endurace Umsatz",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const powerUsageChartConfig = {
  utilization: {
    label: "Auslastung",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const bookingDaysChartConfig = {
  days: {
    label: "Buchungstage",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const potentialRevenueChartConfig = {
  amount: {
    label: "Umsatzpotential",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const weekdayBookingDaysChartConfig = {
  days: {
    label: "Angefragte Miettage",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const trafficChartConfig = {
  munich: { label: "München", color: "var(--chart-1)" },
  regensburg: { label: "Regensburg", color: "var(--chart-2)" },
  lindau: { label: "Lindau", color: "var(--chart-3)" },
  friedrichshafen: { label: "Friedrichshafen", color: "var(--chart-4)" },
  konstanz: { label: "Konstanz", color: "var(--chart-5)" },
} satisfies ChartConfig;

const bookingFunnelChartConfig = {
  count: { label: "Buchungen", color: "var(--chart-1)" },
} satisfies ChartConfig;

function WeekdayBookingDays({ weekdayBookingDays }: { weekdayBookingDays: Array<{ day: string; days: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Miettage nach Wochentag</CardTitle>
        <CardDescription>Welche Wochentage am häufigsten angefragt werden.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={weekdayBookingDaysChartConfig} className="h-[200px] w-full">
          <BarChart accessibilityLayer data={weekdayBookingDays} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <XAxis dataKey="day" tickLine={false} tickMargin={8} axisLine={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel className="min-w-40" />} />
            <Bar dataKey="days" fill="var(--color-days)" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function TrafficChannels({
  rentalDaysByLocation,
}: {
  rentalDaysByLocation: Array<{
    key: string;
    label: string;
    data: Array<{ month: string; days: number }>;
  }>;
}) {
  const chartData = rentalDaysByLocation[0]?.data.map((point, monthIndex) => ({
    month: point.month,
    ...Object.fromEntries(rentalDaysByLocation.map((location) => [location.key, location.data[monthIndex]?.days ?? 0])),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Angefragte Miettage</CardTitle>
        <CardDescription className="line-clamp-2 text-sm leading-snug">
          Summierte Buchungstage pro Standort und Monat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <ChartContainer config={trafficChartConfig} className="max-h-[180px] w-full">
          <BarChart accessibilityLayer data={chartData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} tickMargin={8} axisLine={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
            <ChartLegend
              content={<ChartLegendContent className="!grid !w-full !grid-cols-3 !pt-5 gap-x-4 gap-y-2 px-1" />}
            />
            {rentalDaysByLocation.map((location) => (
              <Bar
                key={location.key}
                dataKey={location.key}
                fill={`var(--color-${location.key})`}
                radius={[6, 6, 0, 0]}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function BookingFunnel({
  data,
  summary,
}: {
  data: Array<{ stage: string; count: number }>;
  summary: {
    averageRentalDays: number;
    averageOrderValueCents: number;
    acceptanceRate: number;
    open: number;
  };
}) {
  const currencyFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buchungs-Funnel</CardTitle>
        <CardDescription>Von der Anfrage bis zum abgeschlossenen Verleih</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ChartContainer config={bookingFunnelChartConfig} className="h-32 w-full">
          <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }} barSize={28}>
            <XAxis dataKey="stage" tickLine={false} tickMargin={8} axisLine={false} className="text-xs" />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Ø Mietdauer", value: `${summary.averageRentalDays} Tage` },
            { label: "Ø Buchungswert", value: currencyFormatter.format(summary.averageOrderValueCents / 100) },
            { label: "Annahmequote", value: `${summary.acceptanceRate}%` },
            { label: "Offen", value: String(summary.open) },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-sm font-medium tabular-nums">{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MunichRequestCapacity({
  requestCapacity,
}: {
  requestCapacity: { accepted: number; total: number; open: number };
}) {
  const acceptedPercent = requestCapacity.total
    ? Math.round((requestCapacity.accepted / requestCapacity.total) * 100)
    : 0;
  const remaining = Math.max(0, requestCapacity.total - requestCapacity.accepted);
  const chartData = [
    { name: "accepted", value: requestCapacity.accepted, fill: "var(--color-accepted)" },
    { name: "remaining", value: remaining, fill: "var(--color-remaining)" },
  ];
  const chartConfig = {
    accepted: { label: "Angenommen", color: "var(--chart-2)" },
    remaining: { label: "Noch nicht angenommen", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[220px]">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={70}
              outerRadius={95}
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 12} className="fill-foreground text-2xl font-bold">
                          {requestCapacity.accepted}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 12} className="fill-muted-foreground text-xs">
                          {acceptedPercent}% angenommen
                        </tspan>
                      </text>
                    );
                  }
                  return null;
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-0">
        <div className="flex w-full items-center justify-between py-3">
          <span className="text-sm text-muted-foreground">München · Anfragen gesamt</span>
          <span className="text-sm font-semibold tabular-nums">{requestCapacity.total}</span>
        </div>
        <Separator />
        <div className="flex w-full items-center justify-between py-3">
          <span className="text-sm text-muted-foreground">Noch offen</span>
          <span className="text-sm font-semibold tabular-nums">{requestCapacity.open}</span>
        </div>
        <Separator />
        <div className="flex w-full items-center justify-between py-3">
          <span className="text-sm text-muted-foreground">Angenommen</span>
          <span className="text-sm font-semibold tabular-nums">{requestCapacity.accepted}</span>
        </div>
      </CardFooter>
    </Card>
  );
}

function SavingsTargets({
  activityData,
  currency,
  currentMonthIndex,
  initialRevenueGoals,
}: {
  activityData: Array<{ month: string; amount: number }>;
  currency: string;
  currentMonthIndex: number;
  initialRevenueGoals: { annualGoalCents: number; monthlyGoalCents: number };
}) {
  const revenueFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency });
  const annualRevenue = activityData.reduce((total, point) => total + point.amount, 0);
  const currentMonthRevenue = activityData[currentMonthIndex]?.amount ?? 0;
  const [goals, setGoals] = React.useState(initialRevenueGoals);
  const [draft, setDraft] = React.useState({ annual: "", monthly: "" });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    async function refreshGoals() {
      const response = await fetch("/api/admin/dashboard/revenue-goals", { cache: "no-store" }).catch(() => null);
      if (!active || !response?.ok) return;
      const result = (await response.json().catch(() => null)) as {
        annualGoalCents?: unknown;
        monthlyGoalCents?: unknown;
      } | null;
      if (typeof result?.annualGoalCents === "number" && typeof result.monthlyGoalCents === "number" && active) {
        setGoals({ annualGoalCents: result.annualGoalCents, monthlyGoalCents: result.monthlyGoalCents });
      }
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshGoals();
    };
    void refreshGoals();
    const intervalId = window.setInterval(refreshGoals, 30_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const annualGoal = goals.annualGoalCents / 100;
  const monthlyGoal = goals.monthlyGoalCents / 100;
  const annualProgress = annualGoal > 0 ? Math.min(100, Math.round((annualRevenue / annualGoal) * 100)) : 0;
  const monthlyProgress = monthlyGoal > 0 ? Math.min(100, Math.round((currentMonthRevenue / monthlyGoal) * 100)) : 0;

  function openGoalDialog() {
    setDraft({
      annual: annualGoal > 0 ? annualGoal.toFixed(2).replace(".", ",") : "",
      monthly: monthlyGoal > 0 ? monthlyGoal.toFixed(2).replace(".", ",") : "",
    });
    setError(null);
    setDialogOpen(true);
  }

  async function saveGoals(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const annualCents = Math.round(Number(draft.annual.trim().replace(/\./g, "").replace(",", ".")) * 100);
    const monthlyCents = Math.round(Number(draft.monthly.trim().replace(/\./g, "").replace(",", ".")) * 100);
    if (
      !Number.isSafeInteger(annualCents) ||
      annualCents <= 0 ||
      !Number.isSafeInteger(monthlyCents) ||
      monthlyCents <= 0
    ) {
      setError("Bitte gib für beide Zeiträume ein gültiges Ziel größer als 0 € ein.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/dashboard/revenue-goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annualGoalCents: annualCents, monthlyGoalCents: monthlyCents }),
      });
      const result = (await response.json().catch(() => null)) as {
        annualGoalCents?: number;
        monthlyGoalCents?: number;
        message?: string;
      } | null;
      if (!response.ok || typeof result?.annualGoalCents !== "number" || typeof result.monthlyGoalCents !== "number") {
        throw new Error(result?.message ?? "Umsatzziele konnten nicht gespeichert werden.");
      }
      setGoals({ annualGoalCents: result.annualGoalCents, monthlyGoalCents: result.monthlyGoalCents });
      setDialogOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Umsatzziele konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Umsatzziele</CardTitle>
          <CardDescription>Gemeinsame Ziele für diese Dashboard-Ansicht</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={openGoalDialog}>
              Ziele bearbeiten
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ItemGroup className="gap-3">
            <Item variant="muted" className="flex-col items-stretch">
              <ItemContent className="gap-3">
                <ItemDescription className="cn-font-heading text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Jahr
                </ItemDescription>
                <span className="text-3xl font-semibold tabular-nums">{revenueFormatter.format(annualRevenue)}</span>
                <Progress value={annualProgress} />
              </ItemContent>
              <ItemFooter>
                <span className="text-sm text-muted-foreground">
                  {annualGoal > 0 ? `${annualProgress}% vom Ziel` : "Kein Ziel hinterlegt"}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {annualGoal > 0 ? `Ziel ${revenueFormatter.format(annualGoal)}` : "Ziel festlegen"}
                </span>
              </ItemFooter>
            </Item>
            <Item variant="muted" className="flex-col items-stretch">
              <ItemContent className="gap-3">
                <ItemDescription className="cn-font-heading text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Aktueller Monat
                </ItemDescription>
                <span className="text-3xl font-semibold tabular-nums">
                  {revenueFormatter.format(currentMonthRevenue)}
                </span>
                <Progress value={monthlyProgress} />
              </ItemContent>
              <ItemFooter>
                <span className="text-sm text-muted-foreground">
                  {monthlyGoal > 0 ? `${monthlyProgress}% vom Ziel` : "Kein Ziel hinterlegt"}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {monthlyGoal > 0 ? `Ziel ${revenueFormatter.format(monthlyGoal)}` : "Ziel festlegen"}
                </span>
              </ItemFooter>
            </Item>
          </ItemGroup>
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Umsatzziele festlegen</DialogTitle>
            <DialogDescription>Lege ein Ziel für das laufende Jahr und für den aktuellen Monat fest.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={saveGoals}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="annual-revenue-goal">Jahresziel in Euro</FieldLabel>
                <Input
                  id="annual-revenue-goal"
                  value={draft.annual}
                  placeholder="z. B. 50.000,00"
                  inputMode="decimal"
                  onChange={(event) => setDraft((current) => ({ ...current, annual: event.target.value }))}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="monthly-revenue-goal">Monatsziel in Euro</FieldLabel>
                <Input
                  id="monthly-revenue-goal"
                  value={draft.monthly}
                  placeholder="z. B. 5.000,00"
                  inputMode="decimal"
                  onChange={(event) => setDraft((current) => ({ ...current, monthly: event.target.value }))}
                  required
                />
              </Field>
            </FieldGroup>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? "Speichern …" : "Ziele speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PowerUsage({ utilizationData }: { utilizationData: Array<{ month: string; utilization: number }> }) {
  const currentUtilization = utilizationData.at(-1)?.utilization ?? 0;
  const averageUtilization = utilizationData.length
    ? Math.round(utilizationData.reduce((total, point) => total + point.utilization, 0) / utilizationData.length)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fahrrad-Auslastung</CardTitle>
        <CardDescription>München · nach Monat</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={powerUsageChartConfig} className="h-[140px] w-full">
          <BarChart data={utilizationData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
            <XAxis dataKey="month" tickLine={false} tickMargin={6} axisLine={false} className="text-xs" />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel formatter={(value) => <span>{Number(value)}%</span>} />}
            />
            <Bar dataKey="utilization" fill="var(--color-utilization)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
        <Separator />
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">Aktueller Monat</span>
            <span className="text-lg font-semibold tabular-nums">{currentUtilization}%</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">Jahresdurchschnitt</span>
            <span className="text-lg font-semibold tabular-nums">{averageUtilization}%</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1">
        <span className="text-sm text-muted-foreground">
          Gebuchte Fahrradtage im Verhältnis zum verfügbaren Münchner Bestand.
        </span>
      </CardFooter>
    </Card>
  );
}

function BookingDevelopment({
  bookingDaysByLocation,
}: {
  bookingDaysByLocation: Record<string, Array<{ month: string; days: number }>>;
}) {
  const locations = Object.keys(bookingDaysByLocation);
  const [location, setLocation] = React.useState(locations[0] ?? "Alle Standorte");
  const data = bookingDaysByLocation[location] ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buchungsentwicklung</CardTitle>
        <CardDescription>Angefragte Buchungstage der letzten 6 Monate.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="booking-location-select">Standort</FieldLabel>
            <Combobox
              items={locations}
              value={location}
              onValueChange={(value) => {
                if (value !== null) setLocation(value);
              }}
            >
              <ComboboxInput id="booking-location-select" placeholder="Standort auswählen..." />
              <ComboboxContent>
                <ComboboxEmpty>Kein Standort gefunden.</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
        </FieldGroup>
        <Separator />
        <ChartContainer config={bookingDaysChartConfig} className="h-[200px] w-full">
          <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={6} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent indicator="line" formatter={(value) => <span>{Number(value)} Tage</span>} />
              }
            />
            <Area
              dataKey="days"
              type="natural"
              fill="var(--color-days)"
              fillOpacity={0.15}
              stroke="var(--color-days)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function CardOverview({
  balanceCents,
  currency,
  activityData,
  potentialRevenueData,
}: {
  balanceCents: number;
  currency: string;
  activityData: Array<{ month: string; amount: number }>;
  potentialRevenueData: Array<{ month: string; amount: number }>;
}) {
  const balanceFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency });
  const formattedBalance = balanceFormatter.format(balanceCents / 100);
  const totalPotential = potentialRevenueData.reduce((total, point) => total + point.amount, 0);
  const formattedTotalPotential = balanceFormatter.format(totalPotential);
  const annualRevenue = activityData.reduce((total, point) => total + point.amount, 0);
  const formattedAnnualRevenue = balanceFormatter.format(annualRevenue);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardContent>
          <CardDescription>Kartenguthaben</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{formattedBalance}</CardTitle>
          <CardDescription className="tabular-nums">{formattedBalance} verfügbar</CardDescription>
        </CardContent>
      </Card>
      <Card className="flex flex-col justify-between">
        <CardContent>
          <div className="flex flex-col gap-1">
            <CardDescription>Gesamtes Umsatzpotential</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formattedTotalPotential}</CardTitle>
            <CardDescription>Letzte 12 Monate</CardDescription>
          </div>
        </CardContent>
      </Card>
      <Card className="col-span-2">
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardDescription>Jahresaktivität</CardDescription>
            <Badge variant="secondary">Buchungsumsatz {formattedAnnualRevenue}</Badge>
          </div>
          <ChartContainer config={activityChartConfig} className="h-20 w-full">
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
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value) => <span>{balanceFormatter.format(Number(value))}</span>}
                  />
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

function EnduraceRevenue({
  revenueBySize,
  currency,
}: {
  revenueBySize: Array<{
    size: string;
    amountCents: number;
    monthlyRevenue: Array<{ month: string; amount: number }>;
  }>;
  currency: string;
}) {
  const revenueFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Endurace Umsatz</CardTitle>
        <CardDescription>Absolute Buchungserlöse in München nach Fahrradgröße.</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {revenueBySize.map(({ size, monthlyRevenue }) => (
            <Item key={size} variant="muted">
              <ItemContent>
                <ItemTitle>Endurace CF SL 8 · {size}</ItemTitle>
                <ItemDescription>München · bestätigte Buchungserlöse</ItemDescription>
              </ItemContent>
              <ChartContainer config={enduraceRevenueChartConfig} className="hidden h-8 w-24 md:block">
                <BarChart data={monthlyRevenue} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value) => <span>{revenueFormatter.format(Number(value))}</span>}
                      />
                    }
                  />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function PotentialRevenue({ data, currency }: { data: Array<{ month: string; amount: number }>; currency: string }) {
  const revenueFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency });
  const latestAmount = data.at(-1)?.amount ?? 0;
  const previousAmount = data.at(-2)?.amount ?? latestAmount;
  const trendPercent = previousAmount === 0 ? 0 : Math.round(((latestAmount - previousAmount) / previousAmount) * 100);
  const trendPrefix = trendPercent > 0 ? "+" : "";
  const firstMonth = data[0]?.month;

  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>Umsatzpotential</CardTitle>
        <CardDescription>{firstMonth ? `Seit ${firstMonth}` : "Noch keine Anfragen"}</CardDescription>
        {data.length > 1 ? (
          <CardAction>
            <Badge variant={trendPercent >= 0 ? "secondary" : "destructive"}>
              {trendPrefix}
              {trendPercent}% vs. Vormonat
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="px-0">
        {data.length ? (
          <ChartContainer config={potentialRevenueChartConfig} className="h-48 w-full">
            <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 0, top: 6, bottom: 0 }}>
              <XAxis dataKey="month" tickLine={false} hide axisLine={false} tickMargin={6} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={(value) => <span>{revenueFormatter.format(Number(value))}</span>}
                  />
                }
              />
              <Area
                dataKey="amount"
                type="natural"
                fill="var(--color-amount)"
                fillOpacity={0.15}
                stroke="var(--color-amount)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Noch keine Anfragen</div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminDashboardOverview({
  userId,
  bankBalanceCents,
  bankCurrency,
  activityData,
  currentMonthIndex,
  initialRevenueGoals,
  revenueBySize,
  utilizationData,
  bookingDaysByLocation,
  weekdayBookingDays,
  munichRequestCapacity,
  rentalDaysByLocation,
  bookingFunnelData,
  bookingFunnelSummary,
  potentialRevenueData,
}: {
  userId: string;
  bankBalanceCents: number;
  bankCurrency: string;
  activityData: Array<{ month: string; amount: number }>;
  currentMonthIndex: number;
  initialRevenueGoals: { annualGoalCents: number; monthlyGoalCents: number };
  revenueBySize: Array<{
    size: string;
    amountCents: number;
    monthlyRevenue: Array<{ month: string; amount: number }>;
  }>;
  utilizationData: Array<{ month: string; utilization: number }>;
  bookingDaysByLocation: Record<string, Array<{ month: string; days: number }>>;
  weekdayBookingDays: Array<{ day: string; days: number }>;
  munichRequestCapacity: { accepted: number; total: number; open: number };
  rentalDaysByLocation: Array<{
    key: string;
    label: string;
    data: Array<{ month: string; days: number }>;
  }>;
  bookingFunnelData: Array<{ stage: string; count: number }>;
  bookingFunnelSummary: {
    averageRentalDays: number;
    averageOrderValueCents: number;
    acceptanceRate: number;
    open: number;
  };
  potentialRevenueData: Array<{ month: string; amount: number }>;
}) {
  return (
    <div
      data-slot="demo"
      className="theme-neutral relative isolate flex min-w-0 max-w-full flex-col gap-(--gap) overflow-hidden bg-muted p-6 pb-48 [--gap:--spacing(6)] dark:bg-background min-[1900px]:p-12 min-[1900px]:[--gap:--spacing(8)]"
    >
      <div className="relative z-10 mx-auto grid min-w-0 max-w-full grid-cols-1 gap-(--gap) md:grid-cols-2 lg:grid-cols-3 xl:max-w-[1600px] 2xl:max-w-[1900px]">
        <div className="flex min-w-0 flex-col gap-(--gap) **:data-[slot=card]:w-full **:data-[slot=card]:min-w-0">
          <PasskeyPrompt userId={userId} />
          <CardOverview
            balanceCents={bankBalanceCents}
            currency={bankCurrency}
            activityData={activityData}
            potentialRevenueData={potentialRevenueData}
          />
          <PotentialRevenue data={potentialRevenueData} currency={bankCurrency} />
          <WeekdayBookingDays weekdayBookingDays={weekdayBookingDays} />
          <MunichRequestCapacity requestCapacity={munichRequestCapacity} />
        </div>
        <div className="flex min-w-0 flex-col gap-(--gap) **:data-[slot=card]:w-full **:data-[slot=card]:min-w-0">
          <SavingsTargets
            activityData={activityData}
            currency={bankCurrency}
            currentMonthIndex={currentMonthIndex}
            initialRevenueGoals={initialRevenueGoals}
          />
          <PowerUsage utilizationData={utilizationData} />
          <TrafficChannels rentalDaysByLocation={rentalDaysByLocation} />
        </div>
        <div className="flex min-w-0 flex-col gap-(--gap) **:data-[slot=card]:w-full **:data-[slot=card]:min-w-0">
          <BookingDevelopment bookingDaysByLocation={bookingDaysByLocation} />
          <EnduraceRevenue revenueBySize={revenueBySize} currency={bankCurrency} />
          <BookingFunnel data={bookingFunnelData} summary={bookingFunnelSummary} />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-1 h-48 bg-linear-to-b from-background via-muted to-transparent dark:hidden" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-48 bg-linear-to-t from-background via-muted/80 to-transparent dark:via-background/80" />
    </div>
  );
}
