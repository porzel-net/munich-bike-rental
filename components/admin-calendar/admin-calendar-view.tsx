import { CalendarMonthGrid } from "@/components/admin-calendar/calendar-month-grid";
import { CalendarToolbar } from "@/components/admin-calendar/calendar-toolbar";
import type { CalendarFilterOption } from "@/components/admin-calendar/calendar-filters";
import type { CalendarWeek } from "@/lib/calendar/admin-calendar";

export function AdminCalendarView({
  monthLabel,
  previousMonthHref,
  nextMonthHref,
  locationItems,
  statusItems,
  locationValue,
  statusValue,
  weeks,
  hasBookings,
}: {
  monthLabel: string;
  previousMonthHref: string;
  nextMonthHref: string;
  locationItems: CalendarFilterOption[];
  statusItems: CalendarFilterOption[];
  locationValue: string;
  statusValue: string;
  weeks: CalendarWeek[];
  hasBookings: boolean;
}) {
  return (
    <section className="rounded-3xl bg-stone-50 px-8 py-12 sm:p-12">
      <div className="mx-auto w-full max-w-7xl">
        <CalendarToolbar
          locationItems={locationItems}
          locationValue={locationValue}
          monthLabel={monthLabel}
          nextMonthHref={nextMonthHref}
          previousMonthHref={previousMonthHref}
          statusItems={statusItems}
          statusValue={statusValue}
        />

        {!hasBookings ? (
          <div className="mb-4 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
            Keine Buchungen für die aktuelle Auswahl gefunden.
          </div>
        ) : null}

        <CalendarMonthGrid weeks={weeks} />
      </div>
    </section>
  );
}
