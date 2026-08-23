import { CalendarMonthGrid } from "@/components/admin-calendar/calendar-month-grid";
import { CalendarSubscription, type CalendarAccountState } from "@/components/admin-calendar/calendar-subscription";
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
  monthName,
  yearLabel,
  calendarAccount,
  calendarAllLocations,
  calendarUrl,
  calendarScopeLabel,
  calendarFilterPreferenceSaved,
}: {
  previousMonthHref: string;
  nextMonthHref: string;
  locationItems: CalendarFilterOption[];
  statusItems: CalendarFilterOption[];
  locationValue: string;
  statusValue: string;
  weeks: CalendarWeek[];
  hasBookings: boolean;
  monthName: string;
  yearLabel: string;
  calendarAccount: CalendarAccountState;
  calendarAllLocations: boolean;
  calendarUrl: string;
  calendarScopeLabel: string;
  calendarFilterPreferenceSaved: boolean;
}) {
  return (
    <section className="calendar-shell">
      <div className="w-full">
        <CalendarToolbar
          locationItems={locationItems}
          locationValue={locationValue}
          monthName={monthName}
          nextMonthHref={nextMonthHref}
          previousMonthHref={previousMonthHref}
          statusItems={statusItems}
          statusValue={statusValue}
          calendarFilterPreferenceSaved={calendarFilterPreferenceSaved}
          yearLabel={yearLabel}
        />

        <CalendarSubscription
          account={calendarAccount}
          allLocations={calendarAllLocations}
          calendarUrl={calendarUrl}
          scopeLabel={calendarScopeLabel}
        />

        {!hasBookings ? (
          <div className="calendar-empty mb-4">Keine Buchungen für die aktuelle Auswahl gefunden.</div>
        ) : null}

        <CalendarMonthGrid weeks={weeks} />
      </div>
    </section>
  );
}
