"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { bookingPresentation } from "@/lib/bookings/presentation";
import { rentalLocationLabels, rentalLocations } from "@/lib/inquiries/catalog";
import type { BookingStatus } from "@/lib/db/schema";

const statuses = Object.keys(bookingPresentation) as BookingStatus[];
const periods = [
  ["all", "Alle Zeiträume"],
  ["week", "Letzte Woche"],
  ["month", "Letzter Monat"],
  ["six_months", "Letzte 6 Monate"],
  ["year", "Letztes Jahr"],
] as const;
const periodItems = periods.map(([value, label]) => ({ value, label }));
const statusItems = [
  { value: "all", label: "Alle Status" },
  ...statuses.map((status) => ({ value: status, label: bookingPresentation[status].label })),
];
const locationItems = [
  { value: "all", label: "Alle Standorte" },
  ...rentalLocations.map((location) => ({
    value: location,
    label: rentalLocationLabels.de[location],
  })),
];
const unassignedValue = "unassigned";

export function BookingStatusFilter({
  location,
  value,
  assignee,
  assignees,
  search,
  period,
  canFilterLocations,
}: {
  location: string;
  value: BookingStatus | null;
  assignee: string;
  assignees: Array<{ id: string; name: string }>;
  search: string;
  period: (typeof periods)[number][0];
  canFilterLocations: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(search);
  const selectedLabel = value ? bookingPresentation[value].label : "Alle Status";
  const selectedPeriodLabel = periods.find(([key]) => key === period)?.[1] ?? "Alle Zeiträume";
  const selectedLocationLabel = locationItems.find((item) => item.value === location)?.label ?? "Alle Standorte";
  const assigneeItems = [
    { value: "all", label: "Alle Sachbearbeiter" },
    { value: unassignedValue, label: "Nicht zugewiesen" },
    ...assignees.map((user) => ({ value: user.id, label: user.name })),
  ];
  const selectedAssigneeLabel = assigneeItems.find((item) => item.value === assignee)?.label ?? "Alle Sachbearbeiter";

  const updateParam = useCallback(
    (key: string, nextValue: string | null, emptyValue?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!nextValue || nextValue === emptyValue) params.delete(key);
      else params.set(key, nextValue);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const nextSearch = searchValue.trim();
    if ((searchParams.get("q") ?? "") === nextSearch) return;
    const timeout = window.setTimeout(() => {
      updateParam("q", nextSearch || null);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchValue, searchParams, updateParam]);

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 sm:flex-nowrap">
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
      <div className="ml-auto flex w-full justify-end gap-1.5 sm:w-auto">
        {canFilterLocations ? (
          <Select
            items={locationItems}
            value={location}
            onValueChange={(nextValue) => updateParam("location", nextValue, "all")}
          >
            <SelectTrigger size="sm" className="min-w-0 flex-1 sm:w-40 sm:flex-none" aria-label="Standort auswählen">
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
        ) : null}
        <Select
          items={assigneeItems}
          value={assignee}
          onValueChange={(nextValue) => updateParam("assignee", nextValue, "all")}
        >
          <SelectTrigger
            size="sm"
            className="min-w-0 flex-1 sm:w-48 sm:flex-none"
            aria-label="Nach Sachbearbeiter filtern"
          >
            <SelectValue className="text-sm font-normal">{selectedAssigneeLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {assigneeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={periodItems}
          value={period}
          onValueChange={(nextValue) => updateParam("period", nextValue, "all")}
        >
          <SelectTrigger size="sm" className="min-w-0 flex-1 sm:w-40 sm:flex-none" aria-label="Zeitraum auswählen">
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
        <Select
          items={statusItems}
          value={value ?? "all"}
          onValueChange={(nextValue) => updateParam("status", nextValue, "all")}
        >
          <SelectTrigger size="sm" className="min-w-0 flex-1 sm:w-40 sm:flex-none" aria-label="Nach Status filtern">
            <SelectValue className="text-sm font-normal">{selectedLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
