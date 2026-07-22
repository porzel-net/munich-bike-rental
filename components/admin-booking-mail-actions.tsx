"use client";

import { useState } from "react";
import { CircleCheckIcon, CircleHelpIcon, CircleXIcon, LoaderIcon, MailCheckIcon } from "lucide-react";

import type { AdminBooking } from "@/components/admin-bookings-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AdminBookingMailActions({
  booking,
  onSent,
}: {
  booking: AdminBooking;
  onSent: (action: "confirmation" | "rejection") => void;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<"confirmation" | "rejection" | null>(null);
  const [threadWarningAction, setThreadWarningAction] = useState<"confirmation" | "rejection" | null>(null);
  async function send(action: "confirmation" | "rejection", forceWithoutThread = false) {
    setSending(action);
    try {
      const response = await fetch(`/api/admin/inquiries/${booking.id}/mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, forceWithoutThread }),
      });
      const result = (await response.json().catch(() => null)) as {
        code?: string;
        message?: string;
        mailboxWarning?: string | null;
      } | null;

      if (response.status === 409 && result?.code === "thread_missing") {
        setThreadWarningAction(action);
        return;
      }

      if (!response.ok) {
        window.alert(result?.message ?? "Die Mail konnte nicht gesendet werden.");
        return;
      }

      onSent(action);
      if (result?.mailboxWarning) window.alert(result.mailboxWarning);
      setOpen(false);
    } finally {
      setSending(null);
    }
  }

  function sendWithoutThread() {
    const action = threadWarningAction;
    setThreadWarningAction(null);
    if (action) void send(action, true);
  }

  return (
    <>
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
              <p className="text-sm font-medium">Schnellaktionen</p>
              <p className="text-xs text-muted-foreground">Mail an {booking.email}</p>
            </div>
            <div className="grid gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-9 justify-start bg-[#639754] px-3 text-xs text-white hover:bg-[#639754]/90 hover:text-white"
                disabled={sending !== null}
                onClick={() => void send("confirmation")}
              >
                {sending === "confirmation" ? <LoaderIcon className="animate-spin" /> : <MailCheckIcon />}
                <span>
                  {booking.mailActions.confirmation
                    ? "Buchungsbestätigung nochmal schicken"
                    : "Buchungsbestätigung schicken"}
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 justify-start bg-[#D61F1F] px-3 text-xs text-white hover:bg-[#D61F1F]/90 hover:text-white"
                disabled={sending !== null}
                onClick={() => void send("rejection")}
              >
                {sending === "rejection" ? <LoaderIcon className="animate-spin" /> : <CircleXIcon />}
                <span>{booking.mailActions.rejection ? "Ablehnung nochmal schicken" : "Ablehnung schicken"}</span>
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <AlertDialog
        open={threadWarningAction !== null}
        onOpenChange={(dialogOpen) => !dialogOpen && setThreadWarningAction(null)}
      >
        <AlertDialogContent size="sm" onClick={(event) => event.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Kein Mailverlauf gefunden</AlertDialogTitle>
            <AlertDialogDescription>
              Für diese automatische Buchung wurde kein Mailverlauf gefunden. Soll die Mail trotzdem direkt an die
              E-Mail-Adresse geschickt werden?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setThreadWarningAction(null)}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={sendWithoutThread}>Trotzdem senden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const statusDetails = {
  pending: {
    label: "Buchung Ausstehend",
    className: "border-[#FFD301] bg-[#FFD301]/15 text-[#806900]",
    icon: LoaderIcon,
  },
  confirmed: {
    label: "Buchung Bestätigt",
    className: "border-[#639754] bg-[#639754]/25 text-[#426537]",
    icon: CircleCheckIcon,
  },
  executed: {
    label: "Ausgeführt",
    className: "border-[#639754] bg-[#639754]/15 text-[#426537]",
    icon: CircleCheckIcon,
  },
  cancelled: {
    label: "Buchung Storniert",
    className: "border-[#F59E0B] bg-[#F59E0B]/15 text-[#B45309]",
    icon: CircleXIcon,
  },
  rejected: { label: "Abgelehnt", className: "border-[#D61F1F] bg-[#D61F1F]/15 text-[#D61F1F]", icon: CircleXIcon },
  unanswered: {
    label: "Unbeantwortet",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: CircleHelpIcon,
  },
} as const;

export function StatusBadge({ status }: { status: AdminBooking["status"] }) {
  const details = statusDetails[status];
  const Icon = details.icon;
  const tooltipLabels = {
    executed: "Buchung Ausgeführt",
    confirmed: "Kunde Endgültig Bestätigt",
    pending: "Warten auf Kundenbestätigung",
    rejected: "Buchung Abgelehnt",
    cancelled: "Buchung Storniert – 50 % Ertrag",
    unanswered: "Keine Entscheidung",
  } as const;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex rounded-full" tabIndex={0} />}
      >
        <Badge variant="outline" className={`px-1.5 ${details.className}`}>
          <Icon className={status === "pending" ? "animate-spin" : undefined} />
          {details.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipLabels[status]}</TooltipContent>
    </Tooltip>
  );
}
