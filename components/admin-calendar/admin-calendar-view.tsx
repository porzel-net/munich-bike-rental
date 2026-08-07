import { CalendarMonthGrid } from "@/components/admin-calendar/calendar-month-grid";
import { CalendarToolbar } from "@/components/admin-calendar/calendar-toolbar";
import type { CalendarFilterOption } from "@/components/admin-calendar/calendar-filters";
import type { CalendarWeek } from "@/lib/calendar/admin-calendar";

export function AdminCalendarView({
  previousMonthHref,
  nextMonthHref,
  locationItems,
  statusItems,
  locationValue,
  statusValue,
  weeks,
  hasBookings,
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
  weeks: CalendarWeek[];
  hasBookings: boolean;
  todayHref: string;
  totalBookings: number;
  monthName: string;
  yearLabel: string;
}) {
  return (
    <section className="calendar-shell">
      <div className="mx-auto w-full max-w-7xl">
        <CalendarToolbar
          locationItems={locationItems}
          locationValue={locationValue}
          monthName={monthName}
          nextMonthHref={nextMonthHref}
          previousMonthHref={previousMonthHref}
          statusItems={statusItems}
          statusValue={statusValue}
          todayHref={todayHref}
          totalBookings={totalBookings}
          yearLabel={yearLabel}
        />

        {!hasBookings ? (
          <div className="calendar-empty mb-4">Keine Buchungen für die aktuelle Auswahl gefunden.</div>
        ) : null}

        <CalendarMonthGrid weeks={weeks} />
      </div>
    </section>
  );
}
