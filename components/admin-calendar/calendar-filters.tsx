"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
}: {
  locationItems: CalendarFilterOption[];
  statusItems: CalendarFilterOption[];
  locationValue: string;
  statusValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: "location" | "status", nextValue: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextValue || nextValue === "all") params.delete(key);
    else params.set(key, nextValue);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const selectedLocationLabel = locationItems.find((item) => item.value === locationValue)?.label ?? "Alle Standorte";
  const selectedStatusLabel = statusItems.find((item) => item.value === statusValue)?.label ?? "Alle Status";

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

      <Select items={statusItems} value={statusValue} onValueChange={(nextValue) => updateParam("status", nextValue)}>
        <SelectTrigger size="sm" className="min-w-44" aria-label="Status auswählen">
          <SelectValue className="text-sm font-normal">{selectedStatusLabel}</SelectValue>
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
  );
}
