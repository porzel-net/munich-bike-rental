"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Euro,
  Inbox,
  MapPin,
  PackagePlus,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FinancialAnalyticsData } from "@/lib/financial-analytics";

type Period = "1m" | "2m" | "3m" | "6m" | "12m" | "3y" | "all";
const locationItems = [
  { value: "all", label: "Alle Standorte" },
  { value: "munich", label: "München" },
  { value: "regensburg", label: "Regensburg" },
  { value: "konstanz", label: "Konstanz" },
  { value: "lindau", label: "Lindau" },
  { value: "friedrichshafen", label: "Friedrichshafen" },
] as const;
const periodItems = [
  { value: "1m", label: "1 Monat" },
  { value: "2m", label: "2 Monate" },
  { value: "3m", label: "3 Monate" },
  { value: "6m", label: "6 Monate" },
  { value: "12m", label: "12 Monate" },
  { value: "3y", label: "3 Jahre" },
  { value: "all", label: "Gesamt" },
] as const;

const colors = {
  primary: "var(--chart-2)",
  secondary: "var(--chart-1)",
  accent: "var(--chart-3)",
  positive: "#22a06b",
  negative: "#e36b6b",
};

const revenueConfig = {
  revenue: { label: "Umsatzpotenzial", color: colors.primary },
} satisfies ChartConfig;

const inquiriesConfig = {
  inquiries: { label: "Reservierungsanfragen", color: colors.accent },
} satisfies ChartConfig;

const rentalDaysConfig = {
  rentalDays: { label: "Angefragte Miettage", color: colors.secondary },
} satisfies ChartConfig;

const addonConfig = {
  yes: { label: "Ja", color: colors.primary },
  no: { label: "Nein", color: "var(--muted)" },
} satisfies ChartConfig;

const genericConfig = {
  inquiries: { label: "Anfragen", color: colors.primary },
  bikes: { label: "Angefragte Bikes", color: colors.primary },
} satisfies ChartConfig;

const weekdayConfig = {
  inquiries: { label: "Anfragen", color: colors.primary },
  rentalDays: { label: "Miettage", color: colors.secondary },
} satisfies ChartConfig;

const overlapConfig = {
  overlap: { label: "Annehmbare Bikes", color: colors.positive },
  conflicts: { label: "Konflikte", color: colors.negative },
} satisfies ChartConfig;

const locationRevenueConfig = {
  revenue: { label: "Umsatzpotenzial", color: colors.primary },
} satisfies ChartConfig;

const locationInquiriesConfig = {
  inquiries: { label: "Anfragen", color: colors.accent },
} satisfies ChartConfig;

const euroFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat("de-DE");

function formatEuro(value: number) {
  return euroFormatter.format(value);
}

function ChartCard({
  title,
  description,
  children,
  className,
  action,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
      {footer ? <CardFooter className="border-t pt-4 text-xs text-muted-foreground">{footer}</CardFooter> : null}
    </Card>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
  trendUp = true,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-3">
          <CardDescription className="font-medium">{label}</CardDescription>
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
          </div>
          {trend ? (
            <Badge
              variant="outline"
              className={
                trendUp
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }
            >
              {trendUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {trend}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartShell({ children, className = "h-[240px]" }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function weekNumber(week: string) {
  return Number(week.replace(/\D/g, "")) || 0;
}

function aggregateWeekly(
  points: FinancialAnalyticsData["weekly"],
  selectedLocation: string,
): FinancialAnalyticsData["weekly"] {
  const grouped = new Map<string, FinancialAnalyticsData["weekly"][number]>();
  for (const point of points) {
    if (selectedLocation !== "all" && point.location !== selectedLocation) continue;
    const current = grouped.get(point.week) ?? {
      week: point.week,
      location: point.location,
      revenue: 0,
      inquiries: 0,
      rentalDays: 0,
      overlap: 0,
      conflicts: 0,
    };
    current.revenue += point.revenue;
    current.inquiries += point.inquiries;
    current.rentalDays += point.rentalDays;
    current.overlap += point.overlap;
    current.conflicts += point.conflicts;
    grouped.set(point.week, current);
  }
  return [...grouped.values()].sort((left, right) => weekNumber(left.week) - weekNumber(right.week));
}

export function FinancialAnalyticsDashboard({ data }: { data: FinancialAnalyticsData }) {
  const [period, setPeriod] = React.useState<Period>("3m");
  const [location, setLocation] = React.useState("all");
  const maxWeek = data.weekly.reduce((max, point) => Math.max(max, weekNumber(point.week)), 0);
  const periodWeekLimits: Record<Exclude<Period, "all">, number> = {
    "1m": 4,
    "2m": 8,
    "3m": 13,
    "6m": 26,
    "12m": 52,
    "3y": 156,
  };
  const firstWeek = period === "all" ? 1 : Math.max(1, maxWeek - periodWeekLimits[period] + 1);
  const periodWeeks = data.weekly.filter((point) => weekNumber(point.week) >= firstWeek);
  const visibleWeeks = aggregateWeekly(periodWeeks, location);
  const latestWeek = visibleWeeks.at(-1);
  const totalRevenue = visibleWeeks.reduce((sum, item) => sum + item.revenue, 0);
  const totalInquiries = visibleWeeks.reduce((sum, item) => sum + item.inquiries, 0);
  const totalRentalDays = visibleWeeks.reduce((sum, item) => sum + item.rentalDays, 0);
  const selectedLocationLabel =
    location === "all"
      ? "Alle Standorte"
      : (data.locations.find((item) => item.location === location)?.label ?? location);
  const selectedPeriodLabel = periodItems.find((item) => item.value === period)?.label ?? "Zeitraum";
  const weekdayData = data.incomingWeekdays.map((item) => ({
    ...item,
    rentalDays: data.rentalWeekdays.find((rentalDay) => rentalDay.day === item.day)?.rentalDays ?? 0,
  }));
  const locationData = data.locations.map((item) => ({
    location: item.label,
    revenue: item.revenue,
    inquiries: item.inquiries,
  }));

  return (
    <div className="flex flex-1 flex-col bg-muted/20">
      <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col gap-6 p-8 md:p-10 lg:p-12">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <TrendingUp className="size-4" /> Finanzielle Nachfrageanalyse
            </div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Potenzial im Blick behalten.</h2>
            <p className="mt-2 text-muted-foreground">
              Reservierungsanfragen, Miettage und Umsatzpotenzial über alle Standorte hinweg.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-background/80 p-1.5 shadow-sm">
            <Select items={locationItems} value={location} onValueChange={(value) => value && setLocation(value)}>
              <SelectTrigger
                size="sm"
                className="w-[170px] rounded-xl border-0 bg-transparent shadow-none"
                aria-label="Standort auswählen"
              >
                <MapPin className="size-4 text-muted-foreground" />
                <SelectValue className="text-sm font-normal">{selectedLocationLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {locationItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select items={periodItems} value={period} onValueChange={(value) => value && setPeriod(value as Period)}>
              <SelectTrigger
                size="sm"
                className="w-[160px] rounded-xl border-0 bg-transparent shadow-none"
                aria-label="Zeitraum auswählen"
              >
                <CalendarDays className="size-4 text-muted-foreground" />
                <SelectValue className="text-sm font-normal">{selectedPeriodLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {periodItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Umsatzpotenzial"
            value={formatEuro(totalRevenue)}
            detail="im ausgewählten Zeitraum"
            icon={Euro}
          />
          <MetricCard
            label="Reservierungsanfragen"
            value={numberFormatter.format(totalInquiries)}
            detail="Anfragen im Zeitraum"
            icon={Inbox}
          />
          <MetricCard
            label="Angefragte Miettage"
            value={numberFormatter.format(totalRentalDays)}
            detail="über alle Fahrradmodelle"
            icon={CalendarDays}
          />
          <MetricCard
            label="Ø Umsatz / Anfrage"
            value={formatEuro(totalInquiries ? Math.round(totalRevenue / totalInquiries) : 0)}
            detail={`Stand ${latestWeek?.week ?? "—"}`}
            icon={PackagePlus}
          />
        </div>

        <section className="grid gap-4 xl:grid-cols-12">
          <ChartCard
            title="Umsatzpotenzial pro Woche"
            description="Summe der angefragten Preise je Standortwoche nach Eröffnung"
            className="xl:col-span-7"
          >
            <ChartShell className="h-[300px]">
              <ChartContainer config={revenueConfig} className="h-full w-full">
                <AreaChart accessibilityLayer data={visibleWeeks} margin={{ left: 4, right: 10, top: 8 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Area
                    dataKey="revenue"
                    type="monotone"
                    fill="url(#revenueFill)"
                    stroke="var(--color-revenue)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>

          <ChartCard
            title="Reservierungsanfragen pro Woche"
            description="Eingegangene E-Mail-Anfragen je Standortwoche"
            className="xl:col-span-5"
          >
            <ChartShell className="h-[300px]">
              <ChartContainer config={inquiriesConfig} className="h-full w-full">
                <LineChart accessibilityLayer data={visibleWeeks} margin={{ left: 4, right: 10, top: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Line
                    dataKey="inquiries"
                    type="monotone"
                    stroke="var(--color-inquiries)"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "var(--color-inquiries)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>

          <ChartCard
            title="Angefragte Miettage pro Woche"
            description="Summe der angefragten Bike-Miettage je Standortwoche"
            className="xl:col-span-5"
          >
            <ChartShell>
              <ChartContainer config={rentalDaysConfig} className="h-full w-full">
                <BarChart accessibilityLayer data={visibleWeeks} margin={{ left: 4, right: 10, top: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Bar dataKey="rentalDays" fill="var(--color-rentalDays)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>

          <ChartCard
            title="Zusatzoptionen"
            description="Anteil der Bikes mit gewählter Zusatzoption"
            className="xl:col-span-7"
          >
            <ChartShell>
              <ChartContainer config={addonConfig} className="h-full w-full">
                <BarChart accessibilityLayer data={data.addons} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="option"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    width={78}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="yes" stackId="addon" fill="var(--color-yes)" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="no" stackId="addon" fill="var(--color-no)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>

          <ChartCard
            title="Fahrradmodelle"
            description="Anzahl angefragter Bikes je vereinheitlichter Modellfamilie"
            className="xl:col-span-6"
          >
            <ChartShell>
              <ChartContainer config={genericConfig} className="h-full w-full">
                <BarChart accessibilityLayer data={data.models} layout="vertical" margin={{ left: 8, right: 14 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis dataKey="model" type="category" tickLine={false} axisLine={false} tickMargin={8} width={92} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="line" />} />
                  <Bar dataKey="bikes" fill="var(--color-bikes)" radius={4} />
                </BarChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>

          <ChartCard
            title="Vorlaufzeit"
            description="Tage zwischen Anfrageeingang und Mietbeginn"
            className="xl:col-span-6"
          >
            <ChartShell>
              <ChartContainer config={genericConfig} className="h-full w-full">
                <BarChart accessibilityLayer data={data.leadTime} margin={{ left: 4, right: 10 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="line" />} />
                  <Bar dataKey="inquiries" fill="var(--color-inquiries)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>

          <ChartCard
            title="Anfragen nach Eingangstag"
            description="Anzahl der Anfragen nach Wochentag des E-Mail-Eingangs"
            className="xl:col-span-6"
          >
            <ChartShell>
              <ChartContainer config={inquiriesConfig} className="h-full w-full">
                <BarChart accessibilityLayer data={weekdayData} margin={{ left: 4, right: 10 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="line" />} />
                  <Bar dataKey="inquiries" fill="var(--color-inquiries)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>

          <ChartCard
            title="Angefragte Fahrradgrößen"
            description="Verteilung der angefragten Bikes auf die verfügbaren Größen"
            className="xl:col-span-6"
          >
            <ChartShell>
              <ChartContainer config={genericConfig} className="h-full w-full">
                <BarChart accessibilityLayer data={data.sizes} margin={{ left: 4, right: 10 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="size" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="line" />} />
                  <Bar dataKey="bikes" fill="var(--color-bikes)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>

          <ChartCard
            title="Überschneidungen"
            description="Nicht abgelehnte Bikes positiv, abgelehnte Bikes als Konflikt negativ"
            className="xl:col-span-7"
          >
            <ChartShell>
              <ChartContainer config={overlapConfig} className="h-full w-full">
                <BarChart accessibilityLayer data={visibleWeeks} margin={{ left: 4, right: 10, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ReferenceLine y={0} stroke="var(--border)" />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Bar dataKey="overlap" fill="var(--color-overlap)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conflicts" fill="var(--color-conflicts)" radius={[0, 0, 4, 4]} />
                </BarChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>

          <ChartCard
            title="Miettage nach Wochentag"
            description="Anzahl der angefragten Bike-Miettage nach Miet-Wochentag"
            className="xl:col-span-5"
          >
            <ChartShell>
              <ChartContainer config={weekdayConfig} className="h-full w-full">
                <BarChart accessibilityLayer data={weekdayData} margin={{ left: 4, right: 10 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="line" />} />
                  <Bar dataKey="rentalDays" fill="var(--color-rentalDays)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>

          <ChartCard
            title="Standortvergleich: Umsatz"
            description="Summe des angefragten Preises je Standort"
            className="xl:col-span-6"
          >
            <ChartShell className="h-[280px]">
              <ChartContainer config={locationRevenueConfig} className="h-full w-full">
                <BarChart accessibilityLayer data={locationData} layout="vertical" margin={{ left: 10, right: 18 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <YAxis
                    dataKey="location"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={108}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="line" />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                </BarChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>

          <ChartCard
            title="Standortvergleich: Nachfrage"
            description="Eingegangene Reservierungsanfragen je Standort"
            className="xl:col-span-6"
          >
            <ChartShell className="h-[280px]">
              <ChartContainer config={locationInquiriesConfig} className="h-full w-full">
                <BarChart accessibilityLayer data={locationData} layout="vertical" margin={{ left: 10, right: 18 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="location"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={108}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="line" />} />
                  <Bar dataKey="inquiries" fill="var(--color-inquiries)" radius={4} />
                </BarChart>
              </ChartContainer>
            </ChartShell>
          </ChartCard>
        </section>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-emerald-600" /> Datenquelle: SQL-Datenbank ·{" "}
          {numberFormatter.format(data.inquiryCount)} Anfragen / {numberFormatter.format(data.bikeCount)} Bikes ·
          Filter: {selectedLocationLabel} ·{" "}
          {data.openingDateSource === "legacy" ? "Eröffnungsdaten aus Import" : "Standortwoche ab erster Anfrage"}
        </div>
      </div>
    </div>
  );
}
