import type { CSSProperties } from "react";

import type { CalendarDay, CalendarWeek } from "@/lib/calendar/admin-calendar";
import { calendarWeekdayLabels } from "@/lib/calendar/admin-calendar";

import { CalendarBookingBar } from "@/components/admin-calendar/calendar-booking-bar";

function CalendarDayCell({ day, isLastColumn }: { day: CalendarDay; isLastColumn: boolean }) {
  return (
    <div
      className={`calendar-day ${day.isCurrentMonth ? "is-current-month" : "is-outside-month"} ${isLastColumn ? "is-last-column" : ""}`}
    >
      <span className={`calendar-day-number ${day.isToday ? "is-today" : ""}`}>{day.date.getDate()}</span>
    </div>
  );
}

function CalendarWeekRow({ week }: { week: CalendarWeek }) {
  // The base day cell has enough room for three stacked event bars. Only add
  // height once a fourth lane would otherwise collide with the next row.
  const eventAreaHeight = Math.max(0, week.eventLaneCount - 3) * 1.75;

  return (
    <div className="calendar-week" style={{ "--calendar-event-space": `${eventAreaHeight}rem` } as CSSProperties}>
      {week.events.length ? (
        <div className="calendar-events">
          <div className="calendar-event-grid">
            {week.events.map(({ event, startIndex, span, lane }) => (
              <div
                className="calendar-event-slot"
                key={`${event.id}-${startIndex}-${lane}`}
                style={{
                  gridColumn: `${startIndex + 1} / span ${span}`,
                  gridRow: lane + 1,
                }}
              >
                <CalendarBookingBar
                  event={event}
                  isSegmentStart={event.startDate >= week.days[0].date}
                  isSegmentEnd={event.endDate <= week.days[6].date}
                  isRightEdge={startIndex + span >= week.days.length}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="calendar-days-grid">
        {week.days.map((day, index) => (
          <CalendarDayCell day={day} isLastColumn={index === 6} key={day.date.toISOString()} />
        ))}
      </div>
    </div>
  );
}

export function CalendarMonthGrid({ weeks }: { weeks: CalendarWeek[] }) {
  return (
    <div className="calendar-grid-wrap">
      <div className="calendar-grid">
        <div className="calendar-weekdays">
          {calendarWeekdayLabels.map((label, index) => (
            <div className={`calendar-weekday ${index === 6 ? "is-last-column" : ""}`} key={label}>
              {label}
            </div>
          ))}
        </div>

        <div className="calendar-weeks">
          {weeks.map((week) => (
            <CalendarWeekRow key={week.days[0].date.toISOString()} week={week} />
          ))}
        </div>
      </div>
    </div>
  );
}
