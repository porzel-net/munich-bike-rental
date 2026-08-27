export const cancellationPeriods = ["more_than_7_days", "between_7_days_and_24_hours", "less_than_24_hours"] as const;

export type CancellationPeriod = (typeof cancellationPeriods)[number];

const cancellationFeePercentages: Record<CancellationPeriod, number> = {
  more_than_7_days: 25,
  between_7_days_and_24_hours: 50,
  less_than_24_hours: 100,
};

export function getCancellationFeePercentage(period: CancellationPeriod) {
  return cancellationFeePercentages[period];
}

export function calculateCancellationFeeCents(totalCents: number, period: CancellationPeriod) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new Error("Der Gesamtbetrag ist ungültig.");
  return Math.round((totalCents * getCancellationFeePercentage(period)) / 100);
}

export function isCancellationPeriod(value: string | undefined): value is CancellationPeriod {
  return value !== undefined && cancellationPeriods.includes(value as CancellationPeriod);
}
