import type { BookingStatus } from "../db/schema";

export const accountLabels: Record<string, string> = {
  accounts_receivable: "Forderungen",
  bank_or_cash: "Bank / Kasse",
  stripe_clearing: "Stripe-Verrechnung",
  rental_revenue: "Mietumsatz",
  cancellation_fee_revenue: "Stornogebühren",
  expense: "Aufwand",
  fixed_assets_bikes: "Anlagevermögen Fahrräder",
  accumulated_depreciation: "Kumulierte Abschreibungen",
  tax_input: "Vorsteuer",
  tax_output: "Umsatzsteuer",
  cash_main: "Kasse / Bargeld",
  equity: "Privateinlage / Eigenkapital",
};

export function formatAccountLabel(account: string) {
  return accountLabels[account] ?? account.replaceAll("_", " ");
}

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
      label: `Noch ausstehend: ${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(openCents / 100)}`,
      badge: "outline" as const,
    };
  if (status === "refund_due")
    return {
      label: `Noch zu erstatten: ${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(-openCents / 100)}`,
      badge: "destructive" as const,
    };
  return { label: "Ausgeglichen", badge: "success" as const };
}
