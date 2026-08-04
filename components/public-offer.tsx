"use client";

import { useEffect, useState } from "react";

import type { PublicOffer } from "@/lib/bookings/public";
import { formatEuro } from "@/lib/bookings/money";
import { rentalLocationLabels, type RentalLocation } from "@/lib/inquiries/catalog";

function formatDate(value: string, locale: "de" | "en") {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function accessoryLabels(item: PublicOffer["items"][number], locale: "de" | "en") {
  const accessories = item.accessories;
  return [
    accessories.needsPedals &&
      `${locale === "de" ? "Pedale" : "Pedals"}${accessories.pedalType ? `: ${accessories.pedalType}` : ""}`,
    accessories.needsComputerMount &&
      `${locale === "de" ? "Halterung" : "Computer mount"}${accessories.computerMountType ? `: ${accessories.computerMountType}` : ""}`,
    accessories.needsHelmet && (locale === "de" ? "Helm" : "Helmet"),
    accessories.needsClothing && (locale === "de" ? "Kleidung" : "Clothing"),
  ].filter((value): value is string => Boolean(value));
}

export function PublicOffer({ offer, token }: { offer: PublicOffer; token: string }) {
  const [currentOffer, setCurrentOffer] = useState(offer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentState] = useState<"success" | "cancelled" | null>(() => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("payment");
    return value === "success" || value === "cancelled" ? value : null;
  });
  const de = currentOffer.booking.locale === "de";
  const bookingStatus = currentOffer.booking.status;
  const confirmed =
    currentOffer.status === "accepted" && ["confirmed", "checked_out", "completed"].includes(bookingStatus);
  const expired =
    currentOffer.status === "expired" ||
    currentOffer.status === "revoked" ||
    (currentOffer.status === "sent" &&
      currentOffer.expiresAt !== null &&
      new Date(currentOffer.expiresAt) <= new Date());
  const canConfirm = currentOffer.status === "sent" && bookingStatus === "offer_sent" && !expired;
  const statusLabels: Record<string, string> = de
    ? {
        inquiry_received: "Anfrage eingegangen",
        offer_sent: "Angebot versendet – Bestätigung ausstehend",
        confirmed: "Buchung bestätigt",
        checked_out: "Fahrrad ausgegeben",
        completed: "Buchung abgeschlossen",
        rejected: "Anfrage abgelehnt",
        cancelled: "Buchung storniert",
        expired: "Angebot abgelaufen",
      }
    : {
        inquiry_received: "Inquiry received",
        offer_sent: "Offer sent – confirmation pending",
        confirmed: "Booking confirmed",
        checked_out: "Bike handed over",
        completed: "Booking completed",
        rejected: "Inquiry rejected",
        cancelled: "Booking cancelled",
        expired: "Offer expired",
      };
  const statusLabel = statusLabels[bookingStatus] ?? bookingStatus;

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const response = await fetch(`/api/booking-confirmation-v2?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as { offer?: PublicOffer } | null;
      if (active && response.ok && result?.offer) setCurrentOffer(result.offer);
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [token]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/booking-confirmation-v2/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string; url?: string } | null;
      if (!response.ok) {
        throw new Error(
          result?.message ?? (de ? "Die Zahlung konnte nicht gestartet werden." : "The payment could not be started."),
        );
      }
      if (!result?.url)
        throw new Error(de ? "Stripe hat keine Checkout-URL geliefert." : "Stripe did not return a checkout URL.");
      window.location.assign(result.url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : de
            ? "Die Buchung konnte nicht bestätigt werden."
            : "The booking could not be confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 900, paddingBlock: "5rem" }}>
      <div className="section-heading">
        <span className="section-heading__eyebrow">{de ? "Dein Buchungslink" : "Your booking link"}</span>
        <h1 className="section-heading__title">
          {confirmed
            ? statusLabel
            : bookingStatus === "inquiry_received"
              ? de
                ? "Anfrage erhalten"
                : "Inquiry received"
              : expired
                ? de
                  ? "Angebot nicht mehr gültig"
                  : "Offer no longer valid"
                : de
                  ? "Angebot prüfen"
                  : "Review your offer"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {de ? "Aktueller Buchungsstatus:" : "Current booking status:"} {statusLabel}
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            {de ? `Hallo ${currentOffer.booking.name}` : `Hello ${currentOffer.booking.name}`}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {de
              ? "Hier findest du alle Daten deiner Anfrage und des konkreten Angebots."
              : "Here are all details of your inquiry and concrete offer."}
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-muted-foreground">{de ? "Auftragsnummer" : "Order number"}</dt>
              <dd>{currentOffer.booking.orderNumber}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">{de ? "Standort" : "Location"}</dt>
              <dd>
                {rentalLocationLabels[currentOffer.booking.locale][currentOffer.booking.location as RentalLocation] ??
                  currentOffer.booking.location}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">{de ? "Abholung" : "Pickup"}</dt>
              <dd>
                {formatDate(currentOffer.booking.periodFrom, currentOffer.booking.locale)} ·{" "}
                {currentOffer.booking.pickupTime}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">{de ? "Rückgabe" : "Drop-off"}</dt>
              <dd>
                {formatDate(currentOffer.booking.periodTo, currentOffer.booking.locale)} ·{" "}
                {currentOffer.booking.dropoffTime}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">E-Mail</dt>
              <dd>{currentOffer.booking.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">{de ? "Telefon" : "Phone"}</dt>
              <dd>{currentOffer.booking.phone}</dd>
            </div>
          </dl>
          <h3 className="mt-8 text-lg font-semibold">{de ? "Fahrräder und Ausstattung" : "Bikes and equipment"}</h3>
          <div className="mt-3 space-y-3">
            {currentOffer.items.map((item) => {
              const accessories = accessoryLabels(item, currentOffer.booking.locale);
              return (
                <div className="rounded-xl border p-4" key={item.position}>
                  <div className="flex justify-between gap-4">
                    <strong>
                      {item.position}. {item.offeredLabel}
                    </strong>
                    <span>
                      {item.dailyPriceCents > 0 ? formatEuro(item.dailyPriceCents, currentOffer.booking.locale) : "—"}
                    </span>
                  </div>
                  {item.offeredLabel !== item.requestedLabel ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {de ? "Angefragt" : "Requested"}: {item.requestedLabel}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {de ? "Körpergröße" : "Height"}: {item.heightCm} cm
                  </p>
                  {accessories.length ? (
                    <p className="mt-1 text-sm text-muted-foreground">{accessories.join(" · ")}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
          {currentOffer.booking.message ? (
            <div className="mt-5 rounded-xl bg-muted/60 p-4">
              <strong>{de ? "Deine Nachricht" : "Your message"}</strong>
              <p className="mt-1 whitespace-pre-wrap text-sm">{currentOffer.booking.message}</p>
            </div>
          ) : null}
        </section>
        <aside className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            {currentOffer.offerNumber === null
              ? de
                ? "Anfrage – noch kein konkretes Angebot"
                : "Inquiry – no concrete offer yet"
              : de
                ? `Angebot Nr. ${currentOffer.offerNumber}`
                : `Offer no. ${currentOffer.offerNumber}`}
          </p>
          {currentOffer.offerId === null ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between gap-4 text-lg font-semibold">
                <span>{de ? "Vorläufige Preisschätzung" : "Initial price estimate"}</span>
                <span>{formatEuro(currentOffer.totalCents, currentOffer.booking.locale)}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {de
                  ? "Wir prüfen zuerst die Verfügbarkeit. Sobald ein konkretes Angebot vorliegt, erscheint es hier automatisch."
                  : "We are checking availability first. As soon as a concrete offer is ready, it will appear here automatically."}
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <span>{de ? "Miettage" : "Rental days"}</span>
                <span>{currentOffer.quote.rentalDays}</span>
              </div>
              <div className="flex justify-between">
                <span>{de ? "Fahrräder" : "Bikes"}</span>
                <span>{formatEuro(currentOffer.quote.bikeSubtotalCents, currentOffer.booking.locale)}</span>
              </div>
              <div className="flex justify-between">
                <span>{de ? "Zubehör" : "Equipment"}</span>
                <span>{formatEuro(currentOffer.quote.equipmentSubtotalCents, currentOffer.booking.locale)}</span>
              </div>
              {currentOffer.quote.discountCents ? (
                <div className="flex justify-between">
                  <span>{de ? "Rabatt" : "Discount"}</span>
                  <span>-{formatEuro(currentOffer.quote.discountCents, currentOffer.booking.locale)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t pt-3 text-lg font-semibold">
                <span>{de ? "Gesamt" : "Total"}</span>
                <span>{formatEuro(currentOffer.totalCents, currentOffer.booking.locale)}</span>
              </div>
            </div>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            {de ? "Zuletzt aktualisiert:" : "Last updated:"}{" "}
            {new Date(currentOffer.booking.updatedAt).toLocaleString(de ? "de-DE" : "en-GB")}
          </p>
          {confirmed ? (
            <div className="mt-8 rounded-xl bg-emerald-50 p-4 text-emerald-800">
              {de
                ? "Diese Buchung ist verbindlich bestätigt. Eine Bestätigungsmail ist unterwegs."
                : "This booking is bindingly confirmed. A confirmation email is on its way."}
            </div>
          ) : bookingStatus === "cancelled" ? (
            <div className="mt-8 rounded-xl bg-rose-50 p-4 text-rose-800">
              {de ? "Diese Buchung wurde storniert." : "This booking has been cancelled."}
            </div>
          ) : bookingStatus === "rejected" ? (
            <div className="mt-8 rounded-xl bg-rose-50 p-4 text-rose-800">
              {de ? "Diese Anfrage wurde abgelehnt." : "This inquiry has been rejected."}
            </div>
          ) : expired ? (
            <div className="mt-8 rounded-xl bg-amber-50 p-4 text-amber-800">
              {de
                ? "Dieses Angebot ist abgelaufen oder wurde ersetzt. Bitte melde dich für ein neues Angebot."
                : "This offer has expired or been replaced. Please contact us for a new offer."}
            </div>
          ) : bookingStatus === "inquiry_received" ? (
            <div className="mt-8 rounded-xl bg-sky-50 p-4 text-sky-800">
              {de
                ? "Deine Anfrage ist eingegangen. Wir prüfen die Verfügbarkeit und melden uns mit einem konkreten Angebot."
                : "Your inquiry has been received. We are checking availability and will get back to you with a concrete offer."}
            </div>
          ) : canConfirm ? (
            <>
              {paymentState === "success" ? (
                <div className="mt-8 rounded-xl bg-amber-50 p-4 text-amber-800">
                  {de
                    ? "Die Zahlung wurde zurückgemeldet. Wir prüfen sie gerade und bestätigen die Buchung anschließend automatisch."
                    : "The payment was reported back. We are checking it and will confirm the booking automatically."}
                </div>
              ) : paymentState === "cancelled" ? (
                <div className="mt-8 rounded-xl bg-amber-50 p-4 text-amber-800">
                  {de
                    ? "Die Zahlung wurde abgebrochen. Es wurde noch keine verbindliche Buchung angelegt."
                    : "The payment was cancelled. No binding booking has been created yet."}
                </div>
              ) : null}
              <p className="mt-8 text-sm text-muted-foreground">
                {de
                  ? "Mit dem Button öffnest du Stripe und zahlst 100 % des Gesamtbetrags. Erst nach erfolgreicher Zahlung wird die Buchung verbindlich bestätigt."
                  : "The button opens Stripe where you pay 100% of the total. The booking is confirmed bindingly only after successful payment."}
              </p>
              <button
                className="mt-4 w-full rounded-full bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
                disabled={busy}
                onClick={confirm}
              >
                {busy
                  ? de
                    ? "Stripe wird geöffnet …"
                    : "Opening Stripe …"
                  : de
                    ? "100 % bezahlen & verbindlich buchen"
                    : "Pay 100% & book bindingly"}
              </button>
              {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            </>
          ) : (
            <div className="mt-8 rounded-xl bg-slate-50 p-4 text-slate-700">
              {de
                ? "Der aktuelle Buchungsstatus lässt momentan keine weitere Aktion zu."
                : "The current booking status does not allow another action right now."}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
