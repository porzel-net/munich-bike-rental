"use client";

import { useEffect, useRef, useState } from "react";
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
  isRightEdge,
}: {
  event: CalendarBookingEvent;
  isSegmentStart: boolean;
  isSegmentEnd: boolean;
  isRightEdge: boolean;
}) {
  const tone = toneClasses[event.tone];
  const barRef = useRef<HTMLAnchorElement>(null);
  const detailRef = useRef<HTMLSpanElement>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipAbove, setTooltipAbove] = useState(false);

  useEffect(() => {
    if (!tooltipOpen) return;

    const updateTooltipPlacement = () => {
      const detail = detailRef.current;
      if (!detail) return;

      const bar = barRef.current;
      const detailRect = detail.getBoundingClientRect();
      const viewportMargin = 12;
      const hasRoomBelow = detailRect.bottom <= window.innerHeight - viewportMargin;
      const hasRoomAbove = Boolean(bar && bar.getBoundingClientRect().top >= detailRect.height + viewportMargin);

      setTooltipAbove(!hasRoomBelow && hasRoomAbove);
    };

    const frame = window.requestAnimationFrame(updateTooltipPlacement);
    window.addEventListener("resize", updateTooltipPlacement);
    window.addEventListener("scroll", updateTooltipPlacement, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateTooltipPlacement);
      window.removeEventListener("scroll", updateTooltipPlacement, true);
    };
  }, [tooltipOpen]);

  return (
    <Link
      ref={barRef}
      className={`calendar-event-bar ${tone} ${isSegmentStart ? "is-segment-start" : ""} ${isSegmentEnd ? "is-segment-end" : ""} ${isRightEdge ? "is-right-edge" : ""} ${tooltipOpen ? "is-tooltip-open" : ""} ${tooltipAbove ? "is-tooltip-above" : ""}`}
      href={`/admin/bookings/${event.id}`}
      aria-label={`Buchung ${event.displayLabel}, ${event.customerName}, ${event.pickupTime} bis ${event.dropoffTime} Uhr, ${event.statusLabel}`}
      onPointerEnter={() => setTooltipOpen(true)}
      onPointerLeave={() => setTooltipOpen(false)}
      onFocus={() => setTooltipOpen(true)}
      onBlur={() => setTooltipOpen(false)}
    >
      <span className="calendar-event-dot" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-[11px] font-medium leading-4">{event.displayLabel}</p>
      <span className="calendar-event-time">
        {event.pickupTime}–{event.dropoffTime}
      </span>
      <span className="calendar-event-status">{event.statusLabel}</span>
      <span ref={detailRef} className="calendar-event-detail" aria-hidden="true">
        <strong>{event.customerName}</strong>
        <span>
          {event.orderNumber} · {event.locationLabel}
        </span>
        <span>Bike: {event.selectedItems.join(" / ") || "unbekannt"}</span>
        {event.selectedBikes.some((bike) => bike.nickname) ? (
          <span>
            Spitzname:{" "}
            {event.selectedBikes
              .map((bike) => bike.nickname)
              .filter(Boolean)
              .join(" / ")}
          </span>
        ) : null}
        <span>
          Zeiten: {event.pickupTime} – {event.dropoffTime} Uhr
        </span>
        <span>Telefon: {event.customerPhone || "nicht angegeben"}</span>
        <span>Ausrüstung: {event.requestedEquipment.join(" / ") || "keine angegeben"}</span>
      </span>
    </Link>
  );
}
