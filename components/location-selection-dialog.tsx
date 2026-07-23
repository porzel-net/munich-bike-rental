"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Locale } from "../lib/home-content";
import { getLocalizedLocationPath, rentalLocationConfigs } from "../lib/rental-locations";

type LocationSelectionDialogProps = {
  lang: Locale;
  open: boolean;
  onClose?: () => void;
};

export function LocationSelectionDialog({ lang, open, onClose }: LocationSelectionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="location-selection-dialog"
      aria-labelledby="location-selection-title"
      onClose={onClose}
    >
      <div className="location-selection-dialog__header">
        <div>
          <span className="location-selection-dialog__eyebrow">
            {lang === "de" ? "Standort wählen" : "Choose a location"}
          </span>
          <h2 id="location-selection-title">
            {lang === "de" ? "Wo möchtest du dein Bike abholen?" : "Where would you like to pick up your bike?"}
          </h2>
        </div>
        <form method="dialog">
          <button
            type="submit"
            className="location-selection-dialog__close"
            aria-label={lang === "de" ? "Schließen" : "Close"}
          >
            <X aria-hidden="true" />
          </button>
        </form>
      </div>

      <p>
        {lang === "de"
          ? "Bitte wähle den passenden Standort für deine Anfrage."
          : "Please choose the right location for your inquiry."}
      </p>

      <div className="location-selection-dialog__links">
        {rentalLocationConfigs.map((location) => (
          <Link key={location.path} href={getLocalizedLocationPath(location, lang)}>
            <strong>{location.city[lang]}</strong>
            <span>{location.district[lang]}</span>
          </Link>
        ))}
      </div>
    </dialog>
  );
}

type LocationSelectionPromptProps = {
  lang: Locale;
  currentCity: string;
};

export function LocationSelectionPrompt({ lang, currentCity }: LocationSelectionPromptProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="hero__location-switch" onClick={() => setOpen(true)}>
        {lang === "de" ? `Du bist gar nicht in ${currentCity}? Hier klicken.` : `Not in ${currentCity}? Click here.`}
      </button>
      <LocationSelectionDialog lang={lang} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
