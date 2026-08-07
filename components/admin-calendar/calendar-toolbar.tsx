import Link from "next/link";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CalendarFilters, type CalendarFilterOption } from "@/components/admin-calendar/calendar-filters";

export function CalendarToolbar({
  previousMonthHref,
  nextMonthHref,
  locationItems,
  statusItems,
  locationValue,
  statusValue,
  todayHref,
  totalBookings,
  monthName,
  yearLabel,
}: {
  previousMonthHref: string;
  nextMonthHref: string;
  locationItems: CalendarFilterOption[];
  statusItems: CalendarFilterOption[];
  locationValue: string;
  statusValue: string;
  todayHref: string;
  totalBookings: number;
  monthName: string;
  yearLabel: string;
}) {
  return (
    <div className="calendar-toolbar">
      <div className="calendar-toolbar-side calendar-toolbar-side-left">
        <span className="calendar-count">
          {totalBookings} {totalBookings === 1 ? "Buchung" : "Buchungen"}
        </span>
      </div>

      <div className="calendar-header-center">
        <div className="calendar-heading-row">
          <h1 className="calendar-title">{monthName}</h1>
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
        </div>
        <p className="calendar-year">{yearLabel}</p>
      </div>

      <div className="calendar-toolbar-side calendar-toolbar-side-right">
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          render={<Link href={todayHref} />}
          className="calendar-today-button"
        >
          <CalendarDaysIcon className="size-3.5" />
          Heute
        </Button>
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
