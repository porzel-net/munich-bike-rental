import Link from "next/link";

import type { CalendarBookingEvent, CalendarStatusTone } from "@/lib/calendar/admin-calendar";

const toneClasses: Record<CalendarStatusTone, string> = {
  amber: "is-amber",
  violet: "is-violet",
  blue: "is-blue",
  emerald: "is-emerald",
  indigo: "is-indigo",
  rose: "is-rose",
  slate: "is-slate",
};

export function CalendarBookingBar({
  event,
  isSegmentStart,
  isSegmentEnd,
}: {
  event: CalendarBookingEvent;
  isSegmentStart: boolean;
  isSegmentEnd: boolean;
}) {
  const tone = toneClasses[event.tone];

  return (
    <Link
      className={`calendar-event-bar ${tone} ${isSegmentStart ? "is-segment-start" : ""} ${isSegmentEnd ? "is-segment-end" : ""}`}
      href={`/admin/bookings/${event.id}`}
      title={event.tooltip}
      aria-label={`Buchung ${event.customerName}, ${event.orderNumber}, ${event.statusLabel}`}
    >
      <span className="calendar-event-dot" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-[11px] font-medium leading-4">{event.displayLabel}</p>
      <span className="calendar-event-status">{event.statusLabel}</span>
      <span className="calendar-event-detail" aria-hidden="true">
        <strong>{event.customerName}</strong>
        <span>
          {event.locationLabel} · {event.statusLabel}
        </span>
      </span>
    </Link>
  );
}
