import { inArray, sql } from "drizzle-orm";

import type { AppDatabase } from "./db/client";
import { bookingRequestedItems, bookings } from "./db/schema";
import { getRentalDays } from "./inventory/pricing";
import { rentalLocationLabels, rentalLocations, type RentalLocation } from "./inquiries/catalog";
import { receivedAtFromOrderNumber } from "./bookings/order-number";
import { berlinDateKey, BUSINESS_TIME_ZONE } from "./datetime";

const weekdayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export type FinancialAnalyticsData = {
  weekly: Array<{
    week: string;
    location: RentalLocation;
    revenue: number;
    inquiries: number;
    rentalDays: number;
    overlap: number;
    conflicts: number;
  }>;
  addons: Array<{ option: string; yes: number; no: number; rate: number }>;
  models: Array<{ model: string; bikes: number }>;
  leadTime: Array<{ bucket: string; inquiries: number }>;
  incomingWeekdays: Array<{ day: string; inquiries: number }>;
  sizes: Array<{ size: string; bikes: number }>;
  rentalWeekdays: Array<{ day: string; rentalDays: number }>;
  locations: Array<{ location: RentalLocation; label: string; revenue: number; inquiries: number }>;
  inquiryCount: number;
  bikeCount: number;
  revenue: number;
  firstSubmittedAt: string | null;
  lastSubmittedAt: string | null;
  openingDateSource: "legacy" | "first-inquiry";
};

type InquiryRow = {
  id: number;
  location: string;
  periodFrom: string;
  periodTo: string;
  bikeTitle: string | null;
  totalPriceCents: number;
  status:
    | "inquiry_received"
    | "offer_sent"
    | "confirmed"
    | "checked_out"
    | "completed"
    | "rejected"
    | "cancelled"
    | "expired";
  submittedAt: Date;
  source: string;
  orderNumber: string;
};

type BikeRow = {
  inquiryId: number;
  bikeSize: string;
  needsPedals: boolean;
  needsComputerMount: boolean;
  needsHelmet: boolean;
  needsClothing: boolean;
  needsBikepackingBag: boolean;
  needsGlasses: boolean;
  bottleHolderIncluded: boolean;
  repairKitIncluded: boolean;
};

function normalizeLocation(value: string): RentalLocation | null {
  const normalized = value
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  const aliases: Record<string, RentalLocation> = {
    munich: "munich",
    munchen: "munich",
    regensburg: "regensburg",
    lindau: "lindau",
    friedrichshafen: "friedrichshafen",
    konstanz: "konstanz",
  };

  return aliases[normalized] ?? null;
}

function parseCalendarDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function daysBetween(start: string, end: string) {
  return getRentalDays(start, end);
}

function weekdayIndex(value: string) {
  const day = parseCalendarDate(value).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function countMap<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function roundEuros(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeBikeModel(value: string | null) {
  const model = value?.trim().replace(/\s*-\s*(XS|S|M|L|XL|XXL)$/i, "");
  if (!model) return "Nicht angegeben";

  const canonicalModels: Array<[RegExp, string]> = [
    [/^Endurace CF SL 8(?: Di2)?$/i, "Endurace CF SL 8"],
    [/^Aeroad CF SL 8(?: Disc)?$/i, "Aeroad CF SL 8"],
    [/^(?:Canyon )?Grail CF SL 7$/i, "Grail CF SL 7"],
    [/^Ultimate CF SL 7(?: eTap AXS)?$/i, "Ultimate CF SL 7"],
  ];

  return canonicalModels.find(([pattern]) => pattern.test(model))?.[1] ?? model;
}

function normalizeBikeSize(value: string) {
  const normalized = value.trim().toUpperCase();
  if (/^(XS|S|M|L|XL|XXL)$/.test(normalized)) return normalized;
  const suffix = normalized.match(/-\s*(XS|S|M|L|XL|XXL)$/);
  return suffix?.[1] ?? "Nicht angegeben";
}

function weekSinceOpening(submittedAt: Date, openingDate: string) {
  const difference = parseCalendarDate(berlinDateKey(submittedAt)).getTime() - parseCalendarDate(openingDate).getTime();
  return Math.max(1, Math.floor(difference / (7 * 86_400_000)) + 1);
}

function weekdayIndexFromDate(value: Date) {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, weekday: "short" }).format(value);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(day);
}

export function getFinancialAnalyticsData(db: AppDatabase): FinancialAnalyticsData {
  const inquiryRows = db
    .select({
      id: bookings.id,
      location: bookings.location,
      periodFrom: bookings.periodFrom,
      periodTo: bookings.periodTo,
      bikeTitle: sql<string | null>`null`,
      totalPriceCents: bookings.quotedTotalCents,
      status: bookings.status,
      submittedAt: bookings.createdAt,
      source: bookings.source,
      orderNumber: bookings.orderNumber,
    })
    .from(bookings)
    .all()
    .map((row) => ({
      ...row,
      submittedAt:
        row.source === "legacy" ? (receivedAtFromOrderNumber(row.orderNumber) ?? row.submittedAt) : row.submittedAt,
    })) as InquiryRow[];

  const bikeRows = inquiryRows.length
    ? (db
        .select({
          inquiryId: bookingRequestedItems.bookingId,
          bikeSize: bookingRequestedItems.requestedLabel,
          needsPedals: bookingRequestedItems.needsPedals,
          needsComputerMount: bookingRequestedItems.needsComputerMount,
          needsHelmet: bookingRequestedItems.needsHelmet,
          needsClothing: bookingRequestedItems.needsClothing,
          needsBikepackingBag: bookingRequestedItems.needsBikepackingBag,
          needsGlasses: bookingRequestedItems.needsGlasses,
          bottleHolderIncluded: bookingRequestedItems.bottleHolderIncluded,
          repairKitIncluded: bookingRequestedItems.repairKitIncluded,
        })
        .from(bookingRequestedItems)
        .where(
          inArray(
            bookingRequestedItems.bookingId,
            inquiryRows.map((inquiry) => inquiry.id),
          ),
        )
        .all() as BikeRow[])
    : [];

  const bikesByInquiry = new Map<number, BikeRow[]>();
  for (const bike of bikeRows) {
    const current = bikesByInquiry.get(bike.inquiryId) ?? [];
    current.push(bike);
    bikesByInquiry.set(bike.inquiryId, current);
  }

  const normalizedInquiries = inquiryRows.flatMap((inquiry) => {
    const location = normalizeLocation(inquiry.location);
    if (!location) return [];
    const detailRows = bikesByInquiry.get(inquiry.id) ?? [];
    // Older imported bookings can be displayed in the bookings list via bikeTitle
    // even when their normalized bike detail rows are missing. Count those as one
    // unspecified bike so headline totals reconcile with the bookings view.
    const bikes = detailRows.length
      ? detailRows
      : [
          {
            inquiryId: inquiry.id,
            bikeSize: "Nicht angegeben",
            needsPedals: false,
            needsComputerMount: false,
            needsHelmet: false,
            needsClothing: false,
            needsBikepackingBag: false,
            needsGlasses: false,
            bottleHolderIncluded: true,
            repairKitIncluded: true,
          },
        ];
    return [{ ...inquiry, location, bikes }];
  });

  const firstInquiryDates = new Map<RentalLocation, string>();
  for (const inquiry of normalizedInquiries) {
    const submittedDate = berlinDateKey(inquiry.submittedAt);
    const current = firstInquiryDates.get(inquiry.location);
    if (!current || submittedDate < current) firstInquiryDates.set(inquiry.location, submittedDate);
  }

  const getOpeningDate = (location: RentalLocation) => firstInquiryDates.get(location) ?? berlinDateKey(new Date());
  const weeklyMap = new Map<string, FinancialAnalyticsData["weekly"][number]>();
  const locationMap = new Map<RentalLocation, { revenue: number; inquiries: number }>();
  const allBikeRows: Array<{ inquiry: (typeof normalizedInquiries)[number]; bike: BikeRow }> = [];
  const leadTimeBuckets = new Map([
    ["0 Tage", 0],
    ["1–3 Tage", 0],
    ["4–7 Tage", 0],
    ["8–14 Tage", 0],
    ["15+ Tage", 0],
  ]);
  const incomingWeekdayCounts = new Map(weekdayLabels.map((day) => [day, 0]));
  const rentalWeekdayCounts = new Map(weekdayLabels.map((day) => [day, 0]));

  for (const inquiry of normalizedInquiries) {
    const weekNumber = weekSinceOpening(inquiry.submittedAt, getOpeningDate(inquiry.location));
    const weekKey = `${inquiry.location}:${weekNumber}`;
    const bikeCount = inquiry.bikes.length;
    const rentalDays = daysBetween(inquiry.periodFrom, inquiry.periodTo) * bikeCount;
    const conflicts = inquiry.status === "rejected" ? bikeCount : 0;
    const currentWeek = weeklyMap.get(weekKey) ?? {
      week: `W ${String(weekNumber).padStart(2, "0")}`,
      location: inquiry.location,
      revenue: 0,
      inquiries: 0,
      rentalDays: 0,
      overlap: 0,
      conflicts: 0,
    };
    // Umsatzpotenzial follows the bookings list: every submitted inquiry contributes
    // its quoted value, independent of the current workflow status.
    currentWeek.revenue += inquiry.totalPriceCents / 100;
    currentWeek.inquiries += 1;
    currentWeek.rentalDays += rentalDays;
    currentWeek.overlap += Math.max(0, bikeCount - conflicts);
    currentWeek.conflicts -= conflicts;
    weeklyMap.set(weekKey, currentWeek);

    const locationTotals = locationMap.get(inquiry.location) ?? { revenue: 0, inquiries: 0 };
    locationTotals.revenue += inquiry.totalPriceCents / 100;
    locationTotals.inquiries += 1;
    locationMap.set(inquiry.location, locationTotals);

    const submittedDate = parseCalendarDate(berlinDateKey(inquiry.submittedAt));
    const rentalStart = parseCalendarDate(inquiry.periodFrom);
    const calculatedLeadTime = Math.max(0, Math.floor((rentalStart.getTime() - submittedDate.getTime()) / 86_400_000));
    const leadBucket =
      calculatedLeadTime === 0
        ? "0 Tage"
        : calculatedLeadTime <= 3
          ? "1–3 Tage"
          : calculatedLeadTime <= 7
            ? "4–7 Tage"
            : calculatedLeadTime <= 14
              ? "8–14 Tage"
              : "15+ Tage";
    leadTimeBuckets.set(leadBucket, (leadTimeBuckets.get(leadBucket) ?? 0) + 1);

    const incomingDay = weekdayLabels[weekdayIndexFromDate(inquiry.submittedAt)];
    incomingWeekdayCounts.set(incomingDay, (incomingWeekdayCounts.get(incomingDay) ?? 0) + 1);

    for (const bike of inquiry.bikes) {
      allBikeRows.push({ inquiry, bike });
      for (let offset = 0; offset < daysBetween(inquiry.periodFrom, inquiry.periodTo); offset += 1) {
        const rentalDate = new Date(rentalStart.getTime() + offset * 86_400_000);
        const rentalDay = weekdayLabels[weekdayIndex(berlinDateKey(rentalDate))];
        rentalWeekdayCounts.set(rentalDay, (rentalWeekdayCounts.get(rentalDay) ?? 0) + 1);
      }
    }
  }

  const addOnDefinitions = [
    ["Pedale", "needsPedals"],
    ["Computerhalterung", "needsComputerMount"],
    ["Helm", "needsHelmet"],
    ["Kleidung", "needsClothing"],
    ["Bikepackingtasche", "needsBikepackingBag"],
    ["Rennradbrille", "needsGlasses"],
    ["Flaschenhalter inklusive", "bottleHolderIncluded"],
    ["Reparaturset inklusive", "repairKitIncluded"],
  ] as const;
  const addons = addOnDefinitions.map(([option, key]) => {
    const yes = allBikeRows.filter(({ bike }) => bike[key]).length;
    const no = Math.max(0, allBikeRows.length - yes);
    return { option, yes, no, rate: allBikeRows.length ? Math.round((yes / allBikeRows.length) * 100) : 0 };
  });

  const modelCounts = countMap(
    allBikeRows.map(({ inquiry, bike }) => normalizeBikeModel(inquiry.bikeTitle?.trim() || bike.bikeSize)),
  );
  const sizeCounts = countMap(allBikeRows.map(({ bike }) => normalizeBikeSize(bike.bikeSize)));
  const firstSubmittedAt = normalizedInquiries.length
    ? new Date(Math.min(...normalizedInquiries.map((inquiry) => inquiry.submittedAt.getTime()))).toISOString()
    : null;
  const lastSubmittedAt = normalizedInquiries.length
    ? new Date(Math.max(...normalizedInquiries.map((inquiry) => inquiry.submittedAt.getTime()))).toISOString()
    : null;

  return {
    weekly: [...weeklyMap.values()]
      .map((point) => ({ ...point, revenue: roundEuros(point.revenue) }))
      .sort(
        (left, right) =>
          left.week.localeCompare(right.week, "de", { numeric: true }) || left.location.localeCompare(right.location),
      ),
    addons,
    models: [...modelCounts.entries()]
      .map(([model, bikes]) => ({ model, bikes }))
      .sort((left, right) => right.bikes - left.bikes),
    leadTime: [...leadTimeBuckets.entries()].map(([bucket, inquiries]) => ({ bucket, inquiries })),
    incomingWeekdays: weekdayLabels.map((day) => ({ day, inquiries: incomingWeekdayCounts.get(day) ?? 0 })),
    sizes: [...sizeCounts.entries()]
      .map(([size, bikes]) => ({ size, bikes }))
      .sort((left, right) => {
        const order = ["XS", "S", "M", "L", "XL", "XXL", "Nicht angegeben"];
        return (
          (order.indexOf(left.size) === -1 ? order.length : order.indexOf(left.size)) -
          (order.indexOf(right.size) === -1 ? order.length : order.indexOf(right.size))
        );
      }),
    rentalWeekdays: weekdayLabels.map((day) => ({ day, rentalDays: rentalWeekdayCounts.get(day) ?? 0 })),
    locations: rentalLocations.map((location) => ({
      location,
      label: rentalLocationLabels.de[location],
      revenue: roundEuros(locationMap.get(location)?.revenue ?? 0),
      inquiries: locationMap.get(location)?.inquiries ?? 0,
    })),
    inquiryCount: normalizedInquiries.length,
    bikeCount: allBikeRows.length,
    revenue: roundEuros(normalizedInquiries.reduce((sum, inquiry) => sum + inquiry.totalPriceCents / 100, 0)),
    firstSubmittedAt,
    lastSubmittedAt,
    openingDateSource: "first-inquiry",
  };
}
