"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, X } from "lucide-react";

import type { BookingConfirmationDetails } from "@/lib/inquiries/confirmation";
import { rentalLocationLabels } from "@/lib/inquiries/catalog";

type BookingConfirmationDialogProps = {
  token?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatEquipment(bike: BookingConfirmationDetails["bikes"][number]) {
  return [
    bike.needsPedals && `Pedale${bike.pedalType ? `: ${bike.pedalType}` : ""}`,
    bike.needsComputerMount && `Halterung${bike.computerMountType ? `: ${bike.computerMountType}` : ""}`,
    bike.needsHelmet && "Helm",
    bike.needsClothing && "Bekleidung",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function BookingConfirmationDialog({ token }: BookingConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const queryToken = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("bookingToken") ?? undefined,
    () => undefined,
  );
  const [booking, setBooking] = useState<BookingConfirmationDetails | null>(null);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const effectiveToken = token ?? queryToken;
  const loading = Boolean(effectiveToken) && !booking && !error;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !effectiveToken) return;

    if (!dialog.open) dialog.showModal();
    let active = true;

    fetch("/api/booking-confirmation-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: effectiveToken }),
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as {
          booking?: BookingConfirmationDetails;
          alreadyConfirmed?: boolean;
          code?: string;
          message?: string;
        } | null;
        if (!response.ok || !result?.booking) {
          if (active) setErrorCode(result?.code ?? null);
          throw new Error(result?.message ?? "Die Buchung konnte nicht bestätigt werden.");
        }
        if (active) {
          setBooking(result.booking);
          setAlreadyConfirmed(Boolean(result.alreadyConfirmed));
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Die Buchung konnte nicht bestätigt werden.");
      });

    return () => {
      active = false;
    };
  }, [effectiveToken]);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <dialog ref={dialogRef} className="booking-confirmation-dialog" onCancel={close}>
      <div className="booking-confirmation-dialog__header">
        <div>
          <span className="booking-confirmation-dialog__eyebrow">
            {error ? "Bestätigung nicht möglich" : "Buchung bestätigt"}
          </span>
          <h2>
            {errorCode === "expired"
              ? "Neuen Buchungslink anfordern"
              : error
                ? "Link prüfen"
                : alreadyConfirmed
                  ? "Deine Buchung ist bereits bestätigt"
                  : "Deine Buchung ist bestätigt"}
          </h2>
        </div>
        <button type="button" className="booking-confirmation-dialog__close" onClick={close} aria-label="Schließen">
          <X aria-hidden="true" />
        </button>
      </div>

      {loading ? <p className="booking-confirmation-dialog__loading">Deine Buchung wird bestätigt …</p> : null}
      {error ? (
        <p className="booking-confirmation-dialog__error">
          {errorCode === "expired"
            ? "Dein Buchungslink ist nur 36 Stunden gültig und inzwischen abgelaufen. Bitte fordere einen neuen Buchungslink an."
            : error}
        </p>
      ) : null}
      {booking ? (
        <div className="booking-confirmation-dialog__body">
          <div className="booking-confirmation-dialog__success">
            <Check aria-hidden="true" />
            <span>Wir haben deine Reservierung verbindlich übernommen.</span>
          </div>

          <div className="booking-confirmation-dialog__payment-note">
            <strong>Bitte noch 50 % überweisen · {formatPrice(Math.ceil(booking.totalPriceCents / 2))}</strong>
            <p>
              Überweise bitte 50 % des Gesamtpreises. Als Verwendungszweck verwendest du {booking.orderNumber}. Den
              Restbetrag überweist du spätestens bis zur Rückgabe.
            </p>
            <small>Julius Porzel · IBAN DE50100123450750947701</small>
          </div>

          <dl className="booking-confirmation-dialog__summary">
            <div>
              <dt>Auftrag</dt>
              <dd>{booking.orderNumber}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{booking.name}</dd>
            </div>
            <div>
              <dt>Standort</dt>
              <dd>{rentalLocationLabels.de[booking.location]}</dd>
            </div>
            <div>
              <dt>Zeitraum</dt>
              <dd>
                {formatDate(booking.periodFrom)} – {formatDate(booking.periodTo)}
              </dd>
            </div>
            <div>
              <dt>Abholung</dt>
              <dd>{booking.pickupTime} Uhr</dd>
            </div>
            <div>
              <dt>Rückgabe</dt>
              <dd>{booking.dropoffTime} Uhr</dd>
            </div>
            <div>
              <dt>Gesamtbetrag</dt>
              <dd>{formatPrice(booking.totalPriceCents)}</dd>
            </div>
            <div>
              <dt>E-Mail</dt>
              <dd>{booking.email}</dd>
            </div>
            <div>
              <dt>Telefon</dt>
              <dd>{booking.phone}</dd>
            </div>
          </dl>

          <div className="booking-confirmation-dialog__bikes">
            <h3>Fahrräder</h3>
            {booking.bikes.map((bike, index) => (
              <div key={`${bike.bikeSize}-${index}`} className="booking-confirmation-dialog__bike">
                <strong>Fahrrad {index + 1}</strong>
                <span>
                  {bike.bikeSize} · {bike.heightCm} cm
                </span>
                {formatEquipment(bike) ? <small>{formatEquipment(bike)}</small> : null}
              </div>
            ))}
          </div>

          {booking.message ? (
            <div className="booking-confirmation-dialog__message">
              <span>Nachricht</span>
              <p>{booking.message}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
