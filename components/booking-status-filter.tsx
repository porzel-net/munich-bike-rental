"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { bookingPresentation } from "@/lib/bookings/presentation";
import type { BookingStatus } from "@/lib/db/schema";

const statuses = Object.keys(bookingPresentation) as BookingStatus[];
const periods = [
  ["all", "Alle Zeiträume"],
  ["week", "Letzte Woche"],
  ["month", "Letzter Monat"],
  ["six_months", "Letzte 6 Monate"],
  ["year", "Letztes Jahr"],
] as const;

export function BookingStatusFilter({
  value,
  search,
  period,
}: {
  value: BookingStatus | null;
  search: string;
  period: (typeof periods)[number][0];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(search);
  const selectedLabel = value ? bookingPresentation[value].label : "Alle Status";
  const selectedPeriodLabel = periods.find(([key]) => key === period)?.[1] ?? "Alle Zeiträume";

  function updateParam(key: string, nextValue: string | null, emptyValue?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextValue || nextValue === emptyValue) params.delete(key);
    else params.set(key, nextValue);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    const nextSearch = searchValue.trim();
    if ((searchParams.get("q") ?? "") === nextSearch) return;
    const timeout = window.setTimeout(() => {
      updateParam("q", nextSearch || null);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchValue, searchParams]);

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:flex-nowrap lg:w-auto">
      <InputGroup className="w-full sm:w-80">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
        name="search"
          placeholder="Buchungen suchen …"
        aria-label="Buchungen suchen"
        />
      </InputGroup>
      <Select value={period} onValueChange={(nextValue) => updateParam("period", nextValue, "all")}>
        <SelectTrigger size="sm" className="w-full sm:w-40" aria-label="Zeitraum auswählen">
          <SelectValue>{selectedPeriodLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {periods.map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value ?? "all"} onValueChange={(nextValue) => updateParam("status", nextValue, "all")}>
        <SelectTrigger size="sm" className="w-full sm:w-40" aria-label="Nach Status filtern">
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Status</SelectItem>
          {statuses.map((status) => (
            <SelectItem key={status} value={status}>
              {bookingPresentation[status].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
