"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CalendarFilterOption = {
  value: string;
  label: string;
};

export function CalendarFilters({
  locationItems,
  statusItems,
  locationValue,
  statusValue,
  calendarFilterPreferenceSaved,
}: {
  locationItems: CalendarFilterOption[];
  statusItems: CalendarFilterOption[];
  locationValue: string;
  statusValue: string;
  calendarFilterPreferenceSaved: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    void fetch("/api/admin/calendar/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: locationValue, status: statusValue }),
    });
  }, [calendarFilterPreferenceSaved, locationValue, statusValue]);

  function updateParam(key: "location" | "status", nextValue: string | string[] | null) {
    const params = new URLSearchParams(searchParams.toString());
    const value = Array.isArray(nextValue) ? nextValue.join(",") : nextValue;
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const selectedLocationLabel = locationItems.find((item) => item.value === locationValue)?.label ?? "Alle Standorte";
  const statusValues = statusItems.map((item) => item.value);
  const selectedStatusValues = statusValue.split(",").filter((value) => statusValues.includes(value));
  const selectedStatusLabel = selectedStatusValues.length ? "Ausgewählt" : "Alle Status";

  function toggleStatus(value: string, checked: boolean) {
    const nextValues = checked
      ? [...new Set([...selectedStatusValues, value])]
      : selectedStatusValues.filter((selectedValue) => selectedValue !== value);
    updateParam("status", nextValues);
  }

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

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="outline" size="sm" className="min-w-44 justify-between" />}
        >
          {selectedStatusLabel}
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuCheckboxItem
            checked={selectedStatusValues.length === 0}
            onCheckedChange={(checked) => {
              if (checked) updateParam("status", null);
            }}
          >
            Alle Status
          </DropdownMenuCheckboxItem>
          {statusItems.map((item) => (
            <DropdownMenuCheckboxItem
              key={item.value}
              checked={selectedStatusValues.includes(item.value)}
              onCheckedChange={(checked) => toggleStatus(item.value, !!checked)}
            >
              {item.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
