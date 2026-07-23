import type { BookingStatus } from "../db/schema";

export const bookingPresentation: Record<
  BookingStatus,
  {
    label: string;
    badge: "default" | "secondary" | "success" | "outline" | "destructive";
    primaryAction?: "offer" | "check_out" | "complete";
  }
> = {
  inquiry_received: { label: "Anfrage eingegangen", badge: "secondary", primaryAction: "offer" },
  offer_sent: { label: "Angebot versendet", badge: "outline" },
  confirmed: { label: "Verbindlich gebucht", badge: "default", primaryAction: "check_out" },
  checked_out: { label: "Fahrrad ausgegeben", badge: "default", primaryAction: "complete" },
  completed: { label: "Abgeschlossen", badge: "success" },
  rejected: { label: "Abgelehnt", badge: "destructive" },
  cancelled: { label: "Storniert", badge: "destructive" },
  expired: { label: "Angebot abgelaufen", badge: "outline" },
};

export function paymentPresentation(status: "open" | "refund_due" | "settled", openCents: number) {
  if (status === "open")
    return {
      label: `${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(openCents / 100)} offen`,
      badge: "outline" as const,
    };
  if (status === "refund_due")
    return {
      label: `${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(-openCents / 100)} Erstattung offen`,
      badge: "destructive" as const,
    };
  return { label: "Ausgeglichen", badge: "secondary" as const };
}
