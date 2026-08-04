import type { CalendarDay, CalendarWeek } from "@/lib/calendar/admin-calendar";
import { calendarWeekdayLabels } from "@/lib/calendar/admin-calendar";

import { CalendarBookingBar } from "@/components/admin-calendar/calendar-booking-bar";

function CalendarDayCell({ day, isLastColumn }: { day: CalendarDay; isLastColumn: boolean }) {
  return (
    <div
      className={[
        "min-h-[8.75rem] border-b border-r border-gray-200 p-3.5 transition-colors duration-300 hover:bg-gray-100",
        day.isCurrentMonth ? "bg-white" : "bg-gray-50",
        isLastColumn ? "border-r-0" : "",
      ].join(" ")}
    >
      <span
        className={[
          "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
          day.isToday
            ? "bg-indigo-600 text-white"
            : day.isCurrentMonth
              ? "text-gray-900"
              : "text-gray-500",
        ].join(" ")}
      >
        {day.date.getDate()}
      </span>
    </div>
  );
}

function CalendarWeekRow({ week }: { week: CalendarWeek }) {
  const eventAreaHeight = week.eventLaneCount ? week.eventLaneCount * 26 + 10 : 0;

  return (
    <div
      className="relative border-x border-b border-gray-200 bg-white"
      style={eventAreaHeight ? { paddingTop: `${eventAreaHeight}px` } : undefined}
    >
      {week.events.length ? (
        <div className="absolute inset-x-2 top-2 z-10">
          <div className="grid grid-cols-7 gap-1.5" style={{ gridAutoRows: "1.5rem" }}>
            {week.events.map(({ event, startIndex, span, lane }) => (
              <div
                key={`${event.id}-${startIndex}-${lane}`}
                style={{
                  gridColumn: `${startIndex + 1} / span ${span}`,
                  gridRow: lane + 1,
                }}
              >
                <CalendarBookingBar event={event} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-7">
        {week.days.map((day, index) => (
          <CalendarDayCell day={day} isLastColumn={index === 6} key={day.date.toISOString()} />
        ))}
      </div>
    </div>
  );
}

export function CalendarMonthGrid({ weeks }: { weeks: CalendarWeek[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-7 border-y border-gray-200 bg-white">
          {calendarWeekdayLabels.map((label, index) => (
            <div
              className={`flex items-center border-r border-gray-200 px-4 py-3.5 text-sm font-medium text-gray-500 ${
                index === 6 ? "border-r-0" : ""
              }`}
              key={label}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid">
          {weeks.map((week) => (
            <CalendarWeekRow key={week.days[0].date.toISOString()} week={week} />
          ))}
        </div>
      </div>
    </div>
  );
}
