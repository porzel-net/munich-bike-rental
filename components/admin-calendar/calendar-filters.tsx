"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CalendarFilterOption = {
  value: string;
  label: string;
};

const calendarStatusStorageKey = "munich-bike-rental.calendar.status-filter";

export function CalendarFilters({
  locationItems,
  statusItems,
  locationValue,
  statusValue,
}: {
  locationItems: CalendarFilterOption[];
  statusItems: CalendarFilterOption[];
  locationValue: string;
  statusValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: "location" | "status", nextValue: string | string[] | null) {
    const params = new URLSearchParams(searchParams.toString());
    const value = Array.isArray(nextValue) ? nextValue.join(",") : nextValue;
    if (key === "status") window.localStorage.setItem(calendarStatusStorageKey, value && value !== "all" ? value : "");
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const selectedLocationLabel = locationItems.find((item) => item.value === locationValue)?.label ?? "Alle Standorte";
  const statusValues = statusItems.map((item) => item.value);
  const selectedStatusValues = statusValue.split(",").filter((value) => statusValues.includes(value));
  const hasRestoredStatus = useRef(false);

  useEffect(() => {
    if (hasRestoredStatus.current) return;
    hasRestoredStatus.current = true;

    const storedValue = window.localStorage.getItem(calendarStatusStorageKey) ?? "";
    if (statusValue) {
      window.localStorage.setItem(calendarStatusStorageKey, selectedStatusValues.join(","));
      return;
    }

    const storedStatuses = storedValue.split(",").filter((value) => statusValues.includes(value));
    if (!storedStatuses.length) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("status", storedStatuses.join(","));
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams, selectedStatusValues, statusValue, statusValues]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={locationItems}
        value={locationValue}
        onValueChange={(nextValue) => updateParam("location", nextValue)}
      >
        <SelectTrigger size="sm" className="min-w-44" aria-label="Standort auswählen">
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

      <Combobox
        items={statusValues}
        multiple
        value={selectedStatusValues}
        onValueChange={(nextValue) => updateParam("status", nextValue)}
      >
        <ComboboxChips className="min-h-8 min-w-56 max-w-96">
          {selectedStatusValues.map((value) => {
            const item = statusItems.find((option) => option.value === value);
            return item ? <ComboboxChip key={value}>{item.label}</ComboboxChip> : null;
          })}
          <ComboboxChipsInput placeholder={selectedStatusValues.length ? "" : "Alle Status"} />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>Kein Status gefunden.</ComboboxEmpty>
          <ComboboxList>
            {(value) => {
              const item = statusItems.find((option) => option.value === value);
              return item ? (
                <ComboboxItem key={value} value={value}>
                  {item.label}
                </ComboboxItem>
              ) : null;
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
