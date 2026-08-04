import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CalendarFilters, type CalendarFilterOption } from "@/components/admin-calendar/calendar-filters";

export function CalendarToolbar({
  monthLabel,
  previousMonthHref,
  nextMonthHref,
  locationItems,
  statusItems,
  locationValue,
  statusValue,
}: {
  monthLabel: string;
  previousMonthHref: string;
  nextMonthHref: string;
  locationItems: CalendarFilterOption[];
  statusItems: CalendarFilterOption[];
  locationValue: string;
  statusValue: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold leading-8 text-gray-900">{monthLabel}</h1>
        <div className="flex items-center gap-2">
          <Button
            nativeButton={false}
            variant="ghost"
            render={<Link href={previousMonthHref} />}
            size="icon"
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            nativeButton={false}
            variant="ghost"
            render={<Link href={nextMonthHref} />}
            size="icon"
            aria-label="Next month"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>

      <CalendarFilters
        locationItems={locationItems}
        locationValue={locationValue}
        statusItems={statusItems}
        statusValue={statusValue}
      />
    </div>
  );
}
