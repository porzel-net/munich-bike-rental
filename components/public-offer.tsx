"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Info,
  MapPin,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { PublicOffer } from "@/lib/bookings/public";
import { formatEuro } from "@/lib/bookings/money";
import {
  getComputerMountTypeLabel,
  getPedalTypeLabel,
  rentalLocationLabels,
  type RentalLocation,
} from "@/lib/inquiries/catalog";

function formatDate(value: string, locale: "de" | "en") {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatUpdatedAt(value: string, locale: "de" | "en") {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

function accessoryLabels(item: PublicOffer["items"][number], locale: "de" | "en") {
  const accessories = item.accessories;
  return [
    accessories.needsPedals &&
      `${locale === "de" ? "Pedale" : "Pedals"}${accessories.pedalType ? `: ${getPedalTypeLabel(accessories.pedalType, locale)}` : ""}`,
    accessories.needsComputerMount &&
      `${locale === "de" ? "Halterung" : "Computer mount"}${accessories.computerMountType ? `: ${getComputerMountTypeLabel(accessories.computerMountType, locale)}` : ""}`,
    accessories.needsHelmet && (locale === "de" ? "Helm" : "Helmet"),
    accessories.needsClothing && (locale === "de" ? "Kleidung" : "Clothing"),
    accessories.needsBikepackingBag && (locale === "de" ? "Bikepackingtasche" : "Bikepacking bag"),
    accessories.needsGlasses && (locale === "de" ? "Rennradbrille" : "Road cycling glasses"),
    accessories.bottleHolderIncluded !== false &&
      (locale === "de" ? "Flaschenhalter inklusive" : "Bottle holder included"),
    accessories.repairKitIncluded !== false && (locale === "de" ? "Reparaturset inklusive" : "Repair kit included"),
    accessories.insuranceProtectionSelected !== false &&
      (locale === "de" ? "Versicherungsschutz" : "Insurance protection"),
  ].filter((value): value is string => Boolean(value));
}

const OFFER_VALIDITY_MS = 36 * 60 * 60 * 1_000;

function formatRemaining(remainingMs: number, locale: "de" | "en") {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  if (days > 0) {
    return locale === "de" ? `${days} ${days === 1 ? "Tag" : "Tage"} ${clock}` : `${days}d ${clock}`;
  }

  return clock;
}

function OfferCountdown({
  expiresAt,
  locale,
  active,
}: {
  expiresAt: string | null;
  locale: "de" | "en";
  active: boolean;
}) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!active || !expiresAt) return;

    const update = () => setRemainingMs(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    const initialUpdate = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, [active, expiresAt]);

  if (!active || !expiresAt) return null;

  const progress = remainingMs === null ? 100 : Math.min(100, Math.max(0, (remainingMs / OFFER_VALIDITY_MS) * 100));

  return (
    <div className="public-offer-countdown" aria-live="polite">
      <div className="public-offer-countdown__header">
        <span className="public-offer-countdown__label">
          <Clock3 size={16} strokeWidth={1.9} aria-hidden="true" />
          {locale === "de" ? "Reservierung aufrechterhalten für" : "Reservation held for"}
        </span>
        <strong>{remainingMs === null ? "…" : formatRemaining(remainingMs, locale)}</strong>
      </div>
      <div className="public-offer-countdown__track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p>
        {locale === "de"
          ? "Bis dahin bleibt dieses Angebot für dich reserviert."
          : "This offer remains reserved for you until then."}
      </p>
    </div>
  );
}

function DetailItem({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="public-offer-detail">
      <span className="public-offer-detail__icon" aria-hidden="true">
        <Icon size={17} strokeWidth={1.8} />
      </span>
      <div className="public-offer-detail__copy">
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

export function PublicOffer({ offer, token }: { offer: PublicOffer; token: string }) {
  const [currentOffer, setCurrentOffer] = useState(offer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientNow, setClientNow] = useState<number | null>(null);
  const [paymentState, setPaymentState] = useState<"success" | "cancelled" | null>(null);
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);
  const de = currentOffer.booking.locale === "de";
  const bookingStatus = currentOffer.booking.status;
  const confirmed =
    currentOffer.status === "accepted" && ["confirmed", "checked_out", "completed"].includes(bookingStatus);
  const expiresAtMs = currentOffer.expiresAt ? new Date(currentOffer.expiresAt).getTime() : null;
  const expired =
    currentOffer.status === "expired" ||
    currentOffer.status === "revoked" ||
    (currentOffer.status === "sent" && expiresAtMs !== null && clientNow !== null && expiresAtMs <= clientNow);
  const canConfirm = currentOffer.status === "sent" && bookingStatus === "offer_sent" && !expired;
  const offerRevoked = currentOffer.status === "revoked";
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
  const statusLabel = offerRevoked
    ? de
      ? "Angebot zurückgezogen"
      : "Offer withdrawn"
    : (statusLabels[bookingStatus] ?? bookingStatus);
  const statusTone = confirmed
    ? "success"
    : expired || bookingStatus === "cancelled" || bookingStatus === "rejected"
      ? "danger"
      : canConfirm
        ? "pending"
        : "info";
  const StatusIcon = statusTone === "success" ? CheckCircle2 : statusTone === "danger" ? AlertTriangle : Clock3;

  useEffect(() => {
    const updatePaymentState = () => {
      const params = new URLSearchParams(window.location.search);
      const value = params.get("payment");
      setPaymentState(value === "success" || value === "cancelled" ? value : null);
      setPaymentSessionId(params.get("session_id"));
    };
    const timeout = window.setTimeout(updatePaymentState, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const updateNow = () => setClientNow(Date.now());
    const initialUpdate = window.setTimeout(updateNow, 0);
    const interval = window.setInterval(updateNow, 1_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

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

  useEffect(() => {
    if (paymentState !== "success" || !paymentSessionId) return;
    let active = true;
    let retryTimer: number | undefined;

    const refreshOffer = async () => {
      const response = await fetch(`/api/booking-confirmation-v2?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as { offer?: PublicOffer } | null;
      if (!active || !response.ok || !result?.offer) return null;
      setCurrentOffer(result.offer);
      return result.offer;
    };

    const completePayment = async (attempt = 0): Promise<void> => {
      const response = await fetch("/api/booking-confirmation-v2/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, sessionId: paymentSessionId }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string; offer?: PublicOffer } | null;
      if (!active) return;
      if (!response.ok) {
        // Stripe may still be finalizing the payment, or its webhook may be
        // confirming the booking at the same time as this success redirect.
        // Keep the customer on a neutral processing state while both paths
        // converge instead of exposing a transient 409/502 as a failure.
        const refreshedOffer = await refreshOffer();
        if (
          refreshedOffer?.booking.status === "confirmed" ||
          refreshedOffer?.booking.status === "checked_out" ||
          refreshedOffer?.booking.status === "completed"
        ) {
          window.history.replaceState(null, "", window.location.pathname);
          window.location.reload();
          return;
        }
        if ((response.status === 409 || response.status === 502 || response.status === 503) && attempt < 12) {
          retryTimer = window.setTimeout(() => void completePayment(attempt + 1), 1_500);
          return;
        }
        setError(
          result?.message ??
            (de
              ? "Die Stripe-Zahlung konnte noch nicht bestätigt werden."
              : "The Stripe payment is not confirmed yet."),
        );
        return;
      }
      if (result?.offer) {
        setCurrentOffer(result.offer);

        // Load the offer page again from the server so the confirmed booking
        // is reflected consistently after returning from Stripe. Remove the
        // callback parameters first to avoid repeating the completion flow on
        // the full reload.
        window.history.replaceState(null, "", window.location.pathname);
        window.location.reload();
      }
    };

    void completePayment();
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [de, paymentSessionId, paymentState, token]);

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
    <main className="public-offer-page">
      <div className="public-offer-page__glow public-offer-page__glow--top" aria-hidden="true" />
      <div className="public-offer-page__glow public-offer-page__glow--bottom" aria-hidden="true" />
      <div className="public-offer-container">
        <header className="public-offer-header">
          <Link className="public-offer-brand" href="/" aria-label="Your Bike Rental home">
            <span className="public-offer-brand__mark">Y</span>
            <span>Your Bike Rental</span>
          </Link>
          <span className="public-offer-header__reference">{currentOffer.booking.orderNumber}</span>
        </header>

        <section className="public-offer-hero" aria-labelledby="public-offer-title">
          <div className="public-offer-hero__copy">
            <div className="public-offer-kicker">
              <span>{de ? "Dein Buchungslink" : "Your booking link"}</span>
              <span className="public-offer-kicker__line" aria-hidden="true" />
              <span>{de ? "Mietanfrage" : "Rental inquiry"}</span>
            </div>
            <h1 id="public-offer-title">
              {offerRevoked
                ? de
                  ? "Angebot zurückgezogen"
                  : "Offer withdrawn"
                : confirmed
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
            <p>
              {de
                ? "Alle Details zu deiner Anfrage, deinem Fahrrad und dem aktuellen Angebot auf einen Blick."
                : "All details about your inquiry, your bike and the current offer at a glance."}
            </p>
          </div>
          <div className={`public-offer-status public-offer-status--${statusTone}`} aria-live="polite">
            <span className="public-offer-status__icon" aria-hidden="true">
              <StatusIcon size={19} strokeWidth={2} />
            </span>
            <span>
              <small>{de ? "Aktueller Status" : "Current status"}</small>
              <strong>{statusLabel}</strong>
            </span>
          </div>
        </section>

        <div className="public-offer-layout">
          <div className="public-offer-content">
            <section className="public-offer-panel" aria-labelledby="booking-details-title">
              <div className="public-offer-section-heading">
                <span className="public-offer-section-heading__icon" aria-hidden="true">
                  <MapPin size={20} strokeWidth={1.8} />
                </span>
                <div>
                  <span className="public-offer-section-heading__eyebrow">{de ? "Deine Anfrage" : "Your inquiry"}</span>
                  <h2 id="booking-details-title">
                    {de ? `Hallo ${currentOffer.booking.name}` : `Hello ${currentOffer.booking.name}`}
                  </h2>
                </div>
              </div>
              <p className="public-offer-panel__intro">
                {de
                  ? "Hier findest du alle Daten deiner Anfrage und des konkreten Angebots."
                  : "Here are all details of your inquiry and concrete offer."}
              </p>
              <dl className="public-offer-details-grid">
                <DetailItem icon={Info} label={de ? "Auftragsnummer" : "Order number"}>
                  {currentOffer.booking.orderNumber}
                </DetailItem>
                <DetailItem icon={MapPin} label={de ? "Standort" : "Location"}>
                  {rentalLocationLabels[currentOffer.booking.locale][currentOffer.booking.location as RentalLocation] ??
                    currentOffer.booking.location}
                </DetailItem>
                <DetailItem icon={CalendarDays} label={de ? "Abholung" : "Pickup"}>
                  {formatDate(currentOffer.booking.periodFrom, currentOffer.booking.locale)} ·{" "}
                  {currentOffer.booking.pickupTime}
                </DetailItem>
                <DetailItem icon={CalendarDays} label={de ? "Rückgabe" : "Drop-off"}>
                  {formatDate(currentOffer.booking.periodTo, currentOffer.booking.locale)} ·{" "}
                  {currentOffer.booking.dropoffTime}
                </DetailItem>
              </dl>
            </section>

            <section className="public-offer-panel" aria-labelledby="bike-details-title">
              <div className="public-offer-section-heading">
                <span className="public-offer-section-heading__icon" aria-hidden="true">
                  <Bike size={20} strokeWidth={1.8} />
                </span>
                <div>
                  <span className="public-offer-section-heading__eyebrow">
                    {de ? "Deine Auswahl" : "Your selection"}
                  </span>
                  <h2 id="bike-details-title">{de ? "Fahrräder und Ausstattung" : "Bikes and equipment"}</h2>
                </div>
              </div>
              <div className="public-offer-bikes">
                {currentOffer.items.map((item) => {
                  const accessories = accessoryLabels(item, currentOffer.booking.locale);
                  return (
                    <article className="public-offer-bike" key={item.position}>
                      <div className="public-offer-bike__topline">
                        <span className="public-offer-bike__number">{String(item.position).padStart(2, "0")}</span>
                        <div className="public-offer-bike__name">
                          <h3>{item.offeredLabel}</h3>
                          {item.offeredLabel !== item.requestedLabel ? (
                            <p>
                              {de ? "Angefragt" : "Requested"}: {item.requestedLabel}
                            </p>
                          ) : null}
                          {item.frameNumber ? (
                            <p>
                              {de ? "Rahmennummer" : "Frame number"}: {item.frameNumber}
                            </p>
                          ) : null}
                        </div>
                        <div className="public-offer-bike__price" aria-label={de ? "Tagespreise" : "Daily prices"}>
                          <div className="public-offer-bike__price-row">
                            <span>{de ? "Mo-Fr" : "Mon-Fri"}</span>
                            <strong>
                              {item.weekdayPriceCents > 0
                                ? formatEuro(item.weekdayPriceCents, currentOffer.booking.locale)
                                : "—"}
                            </strong>
                          </div>
                          <div className="public-offer-bike__price-row">
                            <span>{de ? "Sa-So" : "Sat-Sun"}</span>
                            <strong>
                              {item.weekendPriceCents > 0
                                ? formatEuro(item.weekendPriceCents, currentOffer.booking.locale)
                                : "—"}
                            </strong>
                          </div>
                        </div>
                      </div>
                      <div className="public-offer-bike__facts">
                        <span>
                          <Ruler size={16} strokeWidth={1.8} aria-hidden="true" />
                          {item.heightCm} cm
                        </span>
                        {accessories.map((accessory) => (
                          <span className="public-offer-chip" key={accessory}>
                            {accessory}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="public-offer-summary" aria-labelledby="offer-summary-title">
            <div className="public-offer-summary__card">
              <div className="public-offer-summary__header">
                <div>
                  <span className="public-offer-section-heading__eyebrow">{de ? "Dein Angebot" : "Your offer"}</span>
                  <h2 id="offer-summary-title">
                    {currentOffer.offerNumber === null
                      ? de
                        ? "Preisschätzung"
                        : "Price estimate"
                      : de
                        ? `Angebot Nr. ${currentOffer.offerNumber}`
                        : `Offer no. ${currentOffer.offerNumber}`}
                  </h2>
                </div>
                <span className="public-offer-summary__badge">{currentOffer.offerId === null ? "—" : "01"}</span>
              </div>

              {currentOffer.offerId === null ? (
                <div className="public-offer-estimate">
                  <span>{de ? "Vorläufiger Gesamtbetrag" : "Initial total"}</span>
                  <strong>{formatEuro(currentOffer.totalCents, currentOffer.booking.locale)}</strong>
                  <p>
                    {de
                      ? "Wir prüfen zuerst die Verfügbarkeit. Sobald ein konkretes Angebot vorliegt, erscheint es hier automatisch."
                      : "We are checking availability first. As soon as a concrete offer is ready, it will appear here automatically."}
                  </p>
                </div>
              ) : (
                <div className="public-offer-totals">
                  <div>
                    <span>{de ? "Miettage" : "Rental days"}</span>
                    <strong>{currentOffer.quote.rentalDays}</strong>
                  </div>
                  <div>
                    <span>{de ? "Fahrräder" : "Bikes"}</span>
                    <strong>{formatEuro(currentOffer.quote.bikeSubtotalCents, currentOffer.booking.locale)}</strong>
                  </div>
                  <div>
                    <span>{de ? "Zubehör" : "Equipment"}</span>
                    <strong>
                      {formatEuro(currentOffer.quote.equipmentSubtotalCents, currentOffer.booking.locale)}
                    </strong>
                  </div>
                  {currentOffer.quote.discountCents !== 0 ? (
                    <div className="public-offer-totals__discount">
                      <span>
                        {currentOffer.quote.discountCents > 0
                          ? de
                            ? "Rabatt"
                            : "Discount"
                          : de
                            ? "Aufpreis"
                            : "Surcharge"}
                      </span>
                      <strong>
                        {currentOffer.quote.discountCents > 0 ? "−" : "+"}
                        {formatEuro(Math.abs(currentOffer.quote.discountCents), currentOffer.booking.locale)}
                      </strong>
                    </div>
                  ) : null}
                  <div className="public-offer-total">
                    <span>{de ? "Gesamt" : "Total"}</span>
                    <strong>{formatEuro(currentOffer.totalCents, currentOffer.booking.locale)}</strong>
                  </div>
                </div>
              )}

              {currentOffer.quote.calculatedTotalCents !== undefined ? (
                <div className="public-offer-alert public-offer-alert--info">
                  <Info size={17} strokeWidth={2} aria-hidden="true" />
                  <span>
                    {de
                      ? "Der Gesamtpreis wurde individuell vereinbart und weicht von der Standardberechnung ab."
                      : "The total price was agreed individually and differs from the standard calculation."}
                  </span>
                </div>
              ) : null}

              <OfferCountdown
                expiresAt={currentOffer.expiresAt}
                locale={currentOffer.booking.locale}
                active={canConfirm}
              />

              {confirmed ? (
                <div className="public-offer-alert public-offer-alert--success">
                  <CheckCircle2 size={17} strokeWidth={2} aria-hidden="true" />
                  <span>
                    {de
                      ? "Diese Buchung ist verbindlich bestätigt. Eine Bestätigungsmail ist unterwegs."
                      : "This booking is bindingly confirmed. A confirmation email is on its way."}
                  </span>
                </div>
              ) : bookingStatus === "cancelled" ? (
                <div className="public-offer-alert public-offer-alert--danger">
                  <AlertTriangle size={17} strokeWidth={2} aria-hidden="true" />
                  <span>{de ? "Diese Buchung wurde storniert." : "This booking has been cancelled."}</span>
                </div>
              ) : bookingStatus === "rejected" ? (
                <div className="public-offer-alert public-offer-alert--danger">
                  <AlertTriangle size={17} strokeWidth={2} aria-hidden="true" />
                  <span>{de ? "Diese Anfrage wurde abgelehnt." : "This inquiry has been rejected."}</span>
                </div>
              ) : offerRevoked ? (
                <div className="public-offer-alert public-offer-alert--danger">
                  <AlertTriangle size={17} strokeWidth={2} aria-hidden="true" />
                  <span>
                    {de
                      ? "Dieses Angebot wurde zurückgezogen und ist nicht mehr gültig. Bitte melde dich, wenn du ein neues Angebot benötigst."
                      : "This offer was withdrawn and is no longer valid. Please contact us if you need a new offer."}
                  </span>
                </div>
              ) : expired ? (
                <div className="public-offer-alert public-offer-alert--warning">
                  <AlertTriangle size={17} strokeWidth={2} aria-hidden="true" />
                  <span>
                    {de
                      ? "Dieses Angebot ist abgelaufen oder wurde ersetzt. Bitte melde dich für ein neues Angebot."
                      : "This offer has expired or been replaced. Please contact us for a new offer."}
                  </span>
                </div>
              ) : bookingStatus === "inquiry_received" ? (
                <div className="public-offer-alert public-offer-alert--info">
                  <Info size={17} strokeWidth={2} aria-hidden="true" />
                  <span>
                    {de
                      ? "Deine Anfrage ist eingegangen. Wir prüfen die Verfügbarkeit und melden uns mit einem konkreten Angebot."
                      : "Your inquiry has been received. We are checking availability and will get back to you with a concrete offer."}
                  </span>
                </div>
              ) : canConfirm ? (
                <div className="public-offer-payment">
                  {paymentState === "success" ? (
                    <div className="public-offer-alert public-offer-alert--warning">
                      <Info size={17} strokeWidth={2} aria-hidden="true" />
                      <span>
                        {de
                          ? "Die Zahlung wurde zurückgemeldet. Wir prüfen sie gerade und bestätigen die Buchung anschließend automatisch."
                          : "The payment was reported back. We are checking it and will confirm the booking automatically."}
                      </span>
                    </div>
                  ) : paymentState === "cancelled" ? (
                    <div className="public-offer-alert public-offer-alert--warning">
                      <Info size={17} strokeWidth={2} aria-hidden="true" />
                      <span>
                        {de
                          ? "Die Zahlung wurde abgebrochen. Es wurde noch keine verbindliche Buchung angelegt."
                          : "The payment was cancelled. No binding booking has been created yet."}
                      </span>
                    </div>
                  ) : null}
                  <p>
                    {de
                      ? "Mit der Zahlung bestätigst du deine Buchung verbindlich. Die sichere Abwicklung erfolgt über Stripe."
                      : "Payment confirms your booking bindingly. Secure checkout is handled by Stripe."}
                  </p>
                  <button className="public-offer-button" disabled={busy} onClick={confirm}>
                    <CreditCard size={18} strokeWidth={1.9} aria-hidden="true" />
                    <span>
                      {busy
                        ? de
                          ? "Stripe wird geöffnet …"
                          : "Opening Stripe …"
                        : de
                          ? "Jetzt verbindlich buchen"
                          : "Book bindingly now"}
                    </span>
                    <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                  {error ? (
                    <p className="public-offer-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="public-offer-alert public-offer-alert--info">
                  <Info size={17} strokeWidth={2} aria-hidden="true" />
                  <span>
                    {de
                      ? "Der aktuelle Buchungsstatus lässt momentan keine weitere Aktion zu."
                      : "The current booking status does not allow another action right now."}
                  </span>
                </div>
              )}

              <p className="public-offer-summary__updated">
                {de ? "Zuletzt aktualisiert" : "Last updated"} ·{" "}
                {formatUpdatedAt(currentOffer.booking.updatedAt, currentOffer.booking.locale)}
              </p>
            </div>
            <div className="public-offer-trust">
              <ShieldCheck size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>
                {de
                  ? "Persönlich betreut · Sichere Zahlung · Transparente Preise"
                  : "Personal service · Secure payment · Clear pricing"}
              </span>
            </div>
          </aside>
        </div>

        <footer className="public-offer-footer">
          <span>{de ? "Fragen zu deiner Buchung?" : "Questions about your booking?"}</span>
          <a href="mailto:hallo@munich-bike-rental.de">hallo@munich-bike-rental.de</a>
          <span aria-hidden="true">·</span>
          <a href="tel:+498954193577">+49 89 54193577</a>
        </footer>
      </div>
    </main>
  );
}
