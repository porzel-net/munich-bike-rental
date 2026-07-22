"use client";

import { useState } from "react";
import { CheckCircle2Icon, LoaderIcon } from "lucide-react";

import type { AdminBooking } from "@/components/admin-bookings-table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/admin-booking-mail-actions";

export function AdminBookingStatusActions({ booking, onExecuted }: { booking: AdminBooking; onExecuted: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function markAsExecuted() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/inquiries/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "executed" }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        window.alert(result?.message ?? "Der Status konnte nicht geändert werden.");
        return;
      }
      onExecuted();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex appearance-none border-0 bg-transparent p-0"
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <StatusBadge status={booking.status} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(21rem,calc(100vw-2rem))] p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-2.5">
          <div>
            <p className="text-sm font-medium">Schnellaktion</p>
            <p className="text-xs text-muted-foreground">Buchung manuell abschließen</p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 w-full justify-start bg-[#639754] px-3 text-xs text-white hover:bg-[#639754]/90 hover:text-white"
            disabled={saving}
            onClick={() => void markAsExecuted()}
          >
            {saving ? <LoaderIcon className="animate-spin" /> : <CheckCircle2Icon />}
            Als ausgeführt markieren
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
