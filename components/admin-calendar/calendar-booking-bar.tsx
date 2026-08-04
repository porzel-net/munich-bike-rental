import type { CalendarBookingEvent, CalendarStatusTone } from "@/lib/calendar/admin-calendar";

const toneClasses: Record<CalendarStatusTone, { border: string; bg: string; text: string }> = {
  amber: {
    border: "border-amber-600",
    bg: "bg-amber-50",
    text: "text-amber-600",
  },
  violet: {
    border: "border-violet-600",
    bg: "bg-violet-50",
    text: "text-violet-600",
  },
  blue: {
    border: "border-blue-600",
    bg: "bg-blue-50",
    text: "text-blue-600",
  },
  emerald: {
    border: "border-emerald-600",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
  },
  indigo: {
    border: "border-indigo-600",
    bg: "bg-indigo-50",
    text: "text-indigo-600",
  },
  rose: {
    border: "border-rose-600",
    bg: "bg-rose-50",
    text: "text-rose-600",
  },
  slate: {
    border: "border-slate-500",
    bg: "bg-slate-50",
    text: "text-slate-500",
  },
};

export function CalendarBookingBar({ event }: { event: CalendarBookingEvent }) {
  const tone = toneClasses[event.tone];

  return (
    <div
      className={`flex items-center gap-2 rounded-md border-l-2 px-2 py-0.5 shadow-sm ring-1 ring-black/5 ${tone.border} ${tone.bg}`}
      title={event.tooltip}
    >
      <p className="min-w-0 flex-1 truncate text-[11px] font-medium leading-4 text-gray-900">{event.displayLabel}</p>
      <span
        className={`shrink-0 max-w-[45%] truncate rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${tone.text}`}
      >
        {event.statusLabel}
      </span>
    </div>
  );
}
