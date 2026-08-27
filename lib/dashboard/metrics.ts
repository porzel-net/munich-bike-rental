import { getRentalDays } from "../inventory/pricing";

export function allocateAmountByMonthCents(amountCents: number, periodFrom: string, periodTo: string, year: number) {
  const allocations = Array.from({ length: 12 }, () => 0);
  const totalRentalDays = getRentalDays(periodFrom, periodTo);
  let allocatedCents = 0;
  const monthsWithRentalDays: number[] = [];

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const monthStart = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const monthEnd = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    if (periodTo < monthStart || periodFrom > monthEnd) continue;

    const overlapFrom = periodFrom > monthStart ? periodFrom : monthStart;
    const overlapTo = periodTo < monthEnd ? periodTo : monthEnd;
    const overlapDays = getRentalDays(overlapFrom, overlapTo);
    if (overlapDays <= 0) continue;
    monthsWithRentalDays.push(monthIndex);
    allocations[monthIndex] = Math.floor((amountCents * overlapDays) / totalRentalDays);
    allocatedCents += allocations[monthIndex];
  }

  const lastMonthIndex = monthsWithRentalDays.at(-1);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  if (lastMonthIndex !== undefined && periodFrom >= yearStart && periodTo <= yearEnd) {
    allocations[lastMonthIndex] += amountCents - allocatedCents;
  }
  return allocations;
}
