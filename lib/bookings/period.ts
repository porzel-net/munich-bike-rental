import { addDateOnlyDays, addDateOnlyMonths, berlinDateKey } from "@/lib/datetime";

type BookingPeriod = "all" | "week" | "month" | "six_months" | "year";

export function getBookingPeriod(period: string | undefined) {
  const validPeriods: BookingPeriod[] = ["all", "week", "month", "six_months", "year"];
  const selected = validPeriods.includes(period as BookingPeriod) ? (period as BookingPeriod) : "all";
  if (selected === "all") return { selected, from: "", to: "" };

  const today = berlinDateKey();
  const from =
    selected === "week"
      ? addDateOnlyDays(today, -7)
      : addDateOnlyMonths(today, selected === "month" ? -1 : selected === "six_months" ? -6 : -12);
  return { selected, from, to: today };
}
