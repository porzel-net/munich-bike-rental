import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CalendarFilters, type CalendarFilterOption } from "@/components/admin-calendar/calendar-filters";

export function CalendarToolbar({
  previousMonthHref,
  nextMonthHref,
  locationItems,
  statusItems,
  locationValue,
  statusValue,
  monthName,
  yearLabel,
}: {
  previousMonthHref: string;
  nextMonthHref: string;
  locationItems: CalendarFilterOption[];
  statusItems: CalendarFilterOption[];
  locationValue: string;
  statusValue: string;
  monthName: string;
  yearLabel: string;
}) {
  return (
    <div className="calendar-toolbar">
      <div className="calendar-header-center">
        <div className="calendar-heading-row">
          <div className="calendar-month-nav" aria-label="Monat wechseln">
            <Button
              nativeButton={false}
              variant="ghost"
              render={<Link href={previousMonthHref} />}
              size="icon"
              aria-label="Vorheriger Monat"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              nativeButton={false}
              variant="ghost"
              render={<Link href={nextMonthHref} />}
              size="icon"
              aria-label="Nächster Monat"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
          <h1 className="calendar-title">
            {monthName}, {yearLabel}
          </h1>
        </div>
      </div>

      <div className="calendar-toolbar-side calendar-toolbar-side-right">
        <CalendarFilters
          locationItems={locationItems}
          locationValue={locationValue}
          statusItems={statusItems}
          statusValue={statusValue}
        />
      </div>
    </div>
  );
}
