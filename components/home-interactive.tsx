"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MapPin, Ruler, ShieldCheck, Weight, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConsent } from "./consent-manager";
import {
  type Locale,
  type PortfolioItem,
} from "../lib/home-content";

type TopbarTranslations = {
  nav: {
    start: string;
    maintenance: string;
    bikes: string;
    prices: string;
    faq: string;
    contact: string;
    blog: string;
    imprint: string;
    privacy: string;
  };
  languageToggle: string;
  menuButton: string;
};

type ModalTranslations = {
  bike: string;
  pricePerDay: string;
  facts: string;
  reserve: string;
  checked: string;
  setup: string;
  close: string;
  preview: string;
  detailImage: string;
};

type FormTranslations = {
  location: string;
  name: string;
  contact: string;
  phone: string;
  phoneHint: string;
  height: string;
  bikeSize: string;
  bikeSizeOptions: {
    s: string;
    m: string;
    l: string;
  };
  periodFrom: string;
  periodTo: string;
  periodHint: string;
  pickupTime: string;
  dropoffTime: string;
  equipment: string;
  pedals: string;
  pedalType: string;
  pedalTypeOptions: {
    platform: string;
    spdSl: string;
    lookKeo2Max: string;
    other: string;
  };
  computerMount: string;
  computerMountType: string;
  computerMountTypeOptions: {
    garmin: string;
    wahoo: string;
    other: string;
  };
  helmet: string;
  clothing: string;
  message: string;
  messageHint: string;
  privacy: string;
  submit: string;
  sending: string;
  success: string;
  orderNumberLabel: string;
  error: string;
  validation: {
    locationRequired: string;
    contactHint: string;
    nameRequired: string;
    contactRequired: string;
    contactInvalid: string;
    phoneRequired: string;
    heightRequired: string;
    heightInvalid: string;
    bikeSizeRequired: string;
    periodFromRequired: string;
    periodToRequired: string;
    periodInvalid: string;
    pedalTypeRequired: string;
    computerMountTypeRequired: string;
    pickupTimeRequired: string;
    dropoffTimeRequired: string;
    messageRequired: string;
    privacyRequired: string;
    submitFailed: string;
    submitOriginError: string;
    submitConfigError: string;
    submitPayloadError: string;
    submitValidationError: string;
  };
};

type SharedTranslations = {
  portfolio: {
    eyebrow: string;
    title: string;
  };
  modal: ModalTranslations;
  form: FormTranslations;
  location: string;
};

type HomeTopbarProps = {
  lang: Locale;
  topbar: TopbarTranslations;
  backLink?: {
    href: string;
    label: string;
  };
};

type PortfolioSectionProps = {
  lang: Locale;
  translations: SharedTranslations;
  portfolioItems: PortfolioItem[];
};

type ContactFormProps = {
  lang: Locale;
  translations: SharedTranslations;
};

type AboutImageStackProps = {
  lang: Locale;
};

type LocationShowcaseProps = {
  lang: Locale;
  defaultLocation?: "munich" | "regensburg";
  autoSwitchToMunichOnFirstView?: boolean;
  eyebrow: string;
  title: string;
  intro: string;
  notice: string;
  primaryAddressLabel: string;
  primaryAddress: string;
  secondaryAddressLabel: string;
  secondaryAddress: string;
};

type ContactStatus = "idle" | "sending" | "success" | "error";

type ContactField =
  | "location"
  | "name"
  | "contact"
  | "phone"
  | "height"
  | "bikeSize"
  | "periodFrom"
  | "periodTo"
  | "pickupTime"
  | "dropoffTime"
  | "pedalType"
  | "computerMountType"
  | "message"
  | "privacy";

type ContactFieldErrors = Partial<Record<ContactField, string>>;

type ContactFormValidation = {
  fieldErrors: ContactFieldErrors;
  submitError: string | null;
};

function buildPathWithSearch({
  pathname,
  searchParams,
  hash = "",
  lang,
}: {
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
  hash?: string;
  lang: Locale;
}) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("lang", lang);
  const query = params.toString();

  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

function getAffiliateKey(searchParams: ReturnType<typeof useSearchParams>) {
  return searchParams.get("al")?.trim() ?? "";
}

function getSetupLabel(lang: Locale, bikeTitle: string) {
  if (bikeTitle === "Endurace CF SL 8") {
    return lang === "de" ? "Komfortables Setup" : "Comfort setup";
  }

  if (bikeTitle === "Grail CF SL 7") {
    return lang === "de" ? "Gravel Setup" : "Gravel setup";
  }

  if (bikeTitle === "Ultimate CF SL 7 eTap AXS") {
    return lang === "de" ? "Sportliches Setup" : "Sport setup";
  }

  return lang === "de" ? "Aggressives Setup" : "Aggressive setup";
}

type RentalLocation = "munich" | "regensburg";

type BikeOption = {
  value: string;
  label: string;
};

const RENTAL_LOCATION_OPTIONS: Record<Locale, Array<{ value: RentalLocation; label: string }>> = {
  de: [
    { value: "munich", label: "München" },
    { value: "regensburg", label: "Regensburg" },
  ],
  en: [
    { value: "munich", label: "Munich" },
    { value: "regensburg", label: "Regensburg" },
  ],
};

const BIKE_OPTIONS_BY_LOCATION: Record<RentalLocation, BikeOption[]> = {
  munich: [
    { value: "Endurace CF SL 8 - XS", label: "Endurace CF SL 8 - XS" },
    { value: "Endurace CF SL 8 - S", label: "Endurace CF SL 8 - S" },
    { value: "Endurace CF SL 8 - M", label: "Endurace CF SL 8 - M" },
    { value: "Endurace CF SL 8 - L", label: "Endurace CF SL 8 - L" },
    { value: "Grail CF SL 7 - S", label: "Grail CF SL 7 - S" },
    { value: "Grail CF SL 7 - M", label: "Grail CF SL 7 - M" },
    { value: "Grail CF SL 7 - L", label: "Grail CF SL 7 - L" },
    { value: "Ultimate CF SL 7 eTap AXS - M", label: "Ultimate CF SL 7 eTap AXS - M" },
    { value: "Ultimate CF SL 7 eTap AXS - L", label: "Ultimate CF SL 7 eTap AXS - L" },
    { value: "Aeroad CF SL 8 - S", label: "Aeroad CF SL 8 - S" },
    { value: "Aeroad CF SL 8 - M", label: "Aeroad CF SL 8 - M" },
  ],
  regensburg: [
    { value: "Endurace CF SL 8 - XS", label: "Endurace CF SL 8 - XS" },
    { value: "Endurace CF SL 8 - S", label: "Endurace CF SL 8 - S" },
    { value: "Endurace CF SL 8 - M", label: "Endurace CF SL 8 - M" },
    { value: "Endurace CF SL 8 - L", label: "Endurace CF SL 8 - L" },
    { value: "Grail CF SL 7 - S", label: "Grail CF SL 7 - S" },
    { value: "Grail CF SL 7 - M", label: "Grail CF SL 7 - M" },
    { value: "Grail CF SL 7 - L", label: "Grail CF SL 7 - L" },
  ],
};

function isRentalLocation(value: string): value is RentalLocation {
  return value === "munich" || value === "regensburg";
}

function isValidContactValue(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateContactForm(
  translations: SharedTranslations,
  values: {
    location: string;
    name: string;
    contact: string;
    phone: string;
    height: string;
    bikeSize: string;
    periodFrom: string;
    periodTo: string;
    pickupTime: string;
    dropoffTime: string;
    needsPedals: boolean;
    pedalType: string;
    needsComputerMount: boolean;
    computerMountType: string;
    needsHelmet: boolean;
    needsClothing: boolean;
    message: string;
    privacyAccepted: boolean;
  },
): ContactFormValidation {
  const validation = translations.form.validation;
  const fieldErrors: ContactFieldErrors = {};
  const locationValue = values.location.trim();
  const phoneValue = values.phone.trim();
  const heightValue = values.height.trim();
  const periodFromValue = values.periodFrom.trim();
  const periodToValue = values.periodTo.trim();
  const pickupTimeValue = values.pickupTime.trim();
  const dropoffTimeValue = values.dropoffTime.trim();
  const pedalTypeValue = values.pedalType.trim();
  const computerMountTypeValue = values.computerMountType.trim();

  if (!locationValue || !["munich", "regensburg"].includes(locationValue)) {
    fieldErrors.location = validation.locationRequired;
  }

  if (!values.name.trim()) {
    fieldErrors.name = validation.nameRequired;
  }

  if (!values.contact.trim()) {
    fieldErrors.contact = validation.contactRequired;
  } else if (!isValidContactValue(values.contact.trim())) {
    fieldErrors.contact = validation.contactInvalid;
  }

  if (!phoneValue) {
    fieldErrors.phone = validation.phoneRequired;
  }

  if (!heightValue) {
    fieldErrors.height = validation.heightRequired;
  } else {
    const heightNumber = Number(heightValue);
    if (!/^\d{2,3}$/.test(heightValue) || !Number.isFinite(heightNumber) || heightNumber < 100 || heightNumber > 250) {
      fieldErrors.height = validation.heightInvalid;
    }
  }

  if (!values.bikeSize.trim()) {
    fieldErrors.bikeSize = validation.bikeSizeRequired;
  }

  if (!periodFromValue) {
    fieldErrors.periodFrom = validation.periodFromRequired;
  }

  if (!periodToValue) {
    fieldErrors.periodTo = validation.periodToRequired;
  }

  if (periodFromValue && periodToValue && new Date(periodFromValue).getTime() > new Date(periodToValue).getTime()) {
    fieldErrors.periodTo = validation.periodInvalid;
  }

  if (!pickupTimeValue) {
    fieldErrors.pickupTime = validation.pickupTimeRequired;
  }

  if (!dropoffTimeValue) {
    fieldErrors.dropoffTime = validation.dropoffTimeRequired;
  }

  if (values.needsPedals && !pedalTypeValue) {
    fieldErrors.pedalType = validation.pedalTypeRequired;
  }

  if (values.needsComputerMount && !computerMountTypeValue) {
    fieldErrors.computerMountType = validation.computerMountTypeRequired;
  }

  if (!values.message.trim()) {
    fieldErrors.message = validation.messageRequired;
  }

  if (!values.privacyAccepted) {
    fieldErrors.privacy = validation.privacyRequired;
  }

  return {
    fieldErrors,
    submitError: Object.keys(fieldErrors).length > 0 ? validation.submitValidationError : null,
  };
}

function SectionHeading({
  eyebrow,
  title,
  inverse = false,
}: {
  eyebrow: string;
  title: string;
  inverse?: boolean;
}) {
  return (
    <div className="section-heading">
      <span className="section-heading__eyebrow">{eyebrow}</span>
      <h2 className={inverse ? "section-heading__title is-inverse" : "section-heading__title"}>
        {title}
      </h2>
    </div>
  );
}

export function AboutImageStack({ lang }: AboutImageStackProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const photos = [
    {
      src: "/assets/img/about/about-3.png",
      alt: {
        de: "Munich Rental auf der Rennradausfahrt",
        en: "Munich Rental on a road bike ride",
      },
    },
    {
      src: "/assets/img/about/about-2.png",
      alt: {
        de: "Munich Rental beim gemeinsamen Abend",
        en: "Munich Rental at a shared evening event",
      },
    },
    {
      src: "/assets/img/about/about-1.png",
      alt: {
        de: "Zwei Gründer mit Rädern vor dem Haus",
        en: "Two founders with bikes in front of the house",
      },
    },
  ];

  const currentPhoto = photos[activeIndex];

  return (
    <button
      type="button"
      className="about-stack"
      aria-label={
        lang === "de"
          ? `Nächstes Bild anzeigen: ${currentPhoto.alt.de}`
          : `Show next photo: ${currentPhoto.alt.en}`
      }
      onClick={() => setActiveIndex((index) => (index + 1) % photos.length)}
    >
      <div className="about-stack__stage" aria-hidden="true">
        {photos.map((photo, index) => {
          const position = (index - activeIndex + photos.length) % photos.length;
          const imageClassName =
            index === 1 ? "about-stack__image about-stack__image--taller" : "about-stack__image";

          return (
            <span
              key={photo.src}
              className={`about-stack__sheet about-stack__sheet--${position}`}
            >
              <Image
                src={photo.src}
                alt=""
                fill
                sizes="(max-width: 1100px) calc(100vw - 48px), 460px"
                placeholder="empty"
                className={imageClassName}
              />
            </span>
          );
        })}

        <span className="about-stack__veil" />
      </div>

    </button>
  );
}

export function LocationShowcase({
  lang,
  defaultLocation = "munich",
  autoSwitchToMunichOnFirstView = false,
  eyebrow,
  title,
  intro,
  notice,
  primaryAddressLabel,
  primaryAddress,
  secondaryAddressLabel,
  secondaryAddress,
}: LocationShowcaseProps) {
  const [activeLocation, setActiveLocation] = useState<"munich" | "regensburg">(() => defaultLocation);
  const showcaseRef = useRef<HTMLDivElement | null>(null);
  const autoSwitchTimerRef = useRef<number | null>(null);
  const hasAutoSwitchedRef = useRef(false);
  const hasInteractedRef = useRef(false);
  const cityLabels = {
    munich: lang === "de" ? "München" : "Munich",
    regensburg: "Regensburg",
  };

  useEffect(() => {
    if (!autoSwitchToMunichOnFirstView || typeof window === "undefined") {
      return undefined;
    }

    const storageKey = "location-showcase-auto-switched";
    hasAutoSwitchedRef.current = window.sessionStorage.getItem(storageKey) === "1";

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);

        if (!isVisible || hasAutoSwitchedRef.current || hasInteractedRef.current) {
          return;
        }

        if (autoSwitchTimerRef.current) {
          window.clearTimeout(autoSwitchTimerRef.current);
        }

        autoSwitchTimerRef.current = window.setTimeout(() => {
          if (hasAutoSwitchedRef.current || hasInteractedRef.current) {
            return;
          }

          setActiveLocation("munich");
          hasAutoSwitchedRef.current = true;
          window.sessionStorage.setItem(storageKey, "1");
        }, 2000);
      },
      { threshold: 0.35 },
    );

    if (showcaseRef.current) {
      observer.observe(showcaseRef.current);
    }

    return () => {
      observer.disconnect();
      if (autoSwitchTimerRef.current) {
        window.clearTimeout(autoSwitchTimerRef.current);
      }
    };
  }, [autoSwitchToMunichOnFirstView]);

  const locations = [
    {
      key: "munich" as const,
      label: primaryAddressLabel,
      address: primaryAddress,
      city: cityLabels.munich,
      image: "/assets/img/location/munich-maps.png",
    },
    {
      key: "regensburg" as const,
      label: secondaryAddressLabel,
      address: secondaryAddress,
      city: cityLabels.regensburg,
      image: "/assets/img/location/regensburg-maps.png",
    },
  ];
  const stackedLocations =
    activeLocation === "munich" ? [locations[0], locations[1]] : [locations[1], locations[0]];

  return (
    <div className="location-grid" ref={showcaseRef}>
      <div className="location-grid__copy">
        <div className="section-heading">
          <span className="section-heading__eyebrow">{eyebrow}</span>
          <h2 className="section-heading__title">{title}</h2>
        </div>
        <p className="section-copy">
          {intro} <strong>{notice}</strong>
        </p>

        <div className="location-showcase__cards" aria-label={lang === "de" ? "Standorte" : "Locations"}>
          {locations.map((location) => {
            const isActive = location.key === activeLocation;

            return (
              <button
                key={location.key}
                type="button"
                className={`location-card location-card--interactive${isActive ? " is-active" : ""}`}
                onClick={() => {
                  hasInteractedRef.current = true;
                  if (autoSwitchTimerRef.current) {
                    window.clearTimeout(autoSwitchTimerRef.current);
                    autoSwitchTimerRef.current = null;
                  }
                  setActiveLocation(location.key);
                }}
                aria-pressed={isActive}
              >
                <div className="location-card__address">
                  <MapPin className="location-card__icon" aria-hidden="true" />
                  <div className="location-card__address-copy">
                    <span className="location-card__label">{location.label}</span>
                    <p className="location-card__text">{location.address}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

      </div>

      <div className="location-grid__visual">
        <div className="location-map">
          {stackedLocations.map((location, index) => {
            const isActive = location.key === activeLocation;
            const isFront = index === 0;

            return (
              <button
                key={location.key}
                type="button"
                className={`location-map__layer${isFront ? " is-active" : " is-inactive"}`}
                style={{ zIndex: isFront ? 2 : 1 }}
                onClick={() => {
                  hasInteractedRef.current = true;
                  if (autoSwitchTimerRef.current) {
                    window.clearTimeout(autoSwitchTimerRef.current);
                    autoSwitchTimerRef.current = null;
                  }
                  setActiveLocation((current) =>
                    current === location.key ? (current === "munich" ? "regensburg" : "munich") : location.key,
                  );
                }}
                aria-pressed={isActive}
                aria-label={
                  location.key === "munich"
                    ? lang === "de"
                      ? "München anzeigen"
                      : "Show Munich"
                    : lang === "de"
                      ? "Regensburg anzeigen"
                      : "Show Regensburg"
                }
              >
                <span className="location-map__badge">{location.city}</span>
                <Image
                  src={location.image}
                  alt={`Standortbild für ${location.address}`}
                  fill
                  sizes="(max-width: 632px) calc(100vw - 32px), 600px"
                  quality={72}
                  className="location-map__image"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BikeModal({
  bike,
  onClose,
  onReserve,
  lang,
  translations,
}: {
  bike: PortfolioItem;
  onClose: () => void;
  onReserve: (bikeTitle: string) => void;
  lang: Locale;
  translations: ModalTranslations;
}) {
  const [selectedImage, setSelectedImage] = useState(bike.image);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="bike-modal" role="presentation" onClick={onClose}>
      <div
        className="bike-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${bike.title} details`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="bike-modal__close" aria-label={translations.close} onClick={onClose}>
          <X />
        </button>

        <div className="bike-modal__layout">
          <div className="bike-modal__visuals">
            <div className="bike-modal__hero">
              <Image
                src={selectedImage}
                alt={bike.title}
                fill
                placeholder={typeof selectedImage === "string" ? "empty" : "blur"}
                sizes="(max-width: 1100px) 100vw, 640px"
                className="bike-modal__hero-image"
              />
            </div>

            <div className="bike-modal__gallery">
              <button
                type="button"
                className={`bike-modal__thumb ${selectedImage === bike.image ? "is-active" : ""}`}
                onClick={() => setSelectedImage(bike.image)}
                aria-label={`${bike.title} ${translations.preview}`}
              >
                <Image
                  src={bike.image}
                  alt={`${bike.title} preview`}
                  fill
                  placeholder={typeof bike.image === "string" ? "empty" : "blur"}
                  sizes="180px"
                  className="bike-modal__thumb-image"
                />
              </button>

              {bike.gallery.map((image, index) => (
                <button
                  key={typeof image === "string" ? image : image.src}
                  type="button"
                  className={`bike-modal__thumb ${selectedImage === image ? "is-active" : ""}`}
                  onClick={() => setSelectedImage(image)}
                  aria-label={`${bike.title} ${translations.detailImage} ${index + 1}`}
                >
                  <Image
                    src={image}
                    alt={`${bike.title} detail ${index + 1}`}
                    fill
                    placeholder={typeof image === "string" ? "empty" : "blur"}
                    sizes="180px"
                    className="bike-modal__thumb-image"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="bike-modal__content">
            <span className="bike-modal__eyebrow">{translations.bike}</span>
            <h3>{bike.title}</h3>
            <p className="bike-modal__description">{bike.description[lang]}</p>

            <div className="bike-modal__pricing">
              <span>{translations.pricePerDay}</span>
              <strong>{bike.price[lang]}</strong>
            </div>

            <button type="button" className="button button--arrow bike-modal__reserve" onClick={() => onReserve(bike.title)}>
              <span>{translations.reserve}</span>
              <img src="/assets/img/svg/right-arrow.svg" alt="" />
            </button>

            <div className="bike-modal__chiprow">
              <span className="bike-modal__chip">
                <Ruler size={16} />
                {bike.subtitle[lang]}
              </span>
              <span className="bike-modal__chip">
                <ShieldCheck size={16} />
                {translations.checked}
              </span>
              <span className="bike-modal__chip">
                <Weight size={16} />
                {getSetupLabel(lang, bike.title)}
              </span>
            </div>

            <div className="bike-modal__section">
              <h4>{translations.facts}</h4>
              <div className="bike-modal__facts">
                {bike.facts.map((fact) => (
                  <div key={fact.label.de} className="bike-modal__fact">
                    <span>{fact.label[lang]}</span>
                    <strong>{fact.value[lang]}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeTopbar({ lang, topbar, backLink }: HomeTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const homeHref = (hash: string) =>
    pathname === "/" ? hash : buildPathWithSearch({ pathname: "/", searchParams, hash, lang });
  const pageHref = (path: string) => buildPathWithSearch({ pathname: path, searchParams, lang });

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  const navigateToLanguage = (nextLang: Locale) => {
    const search = new URLSearchParams(searchParams.toString());
    search.set("lang", nextLang);
    const nextUrl = `${pathname}?${search.toString()}${window.location.hash}`;
    router.push(nextUrl);
    setMenuOpen(false);
  };

  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <a className="brand" href={homeHref("#home")} aria-label="Your Bike Rental home">
          <span className="brand__text">Your Bike Rental</span>
        </a>

        <div className="topbar__right">
          <nav className="nav nav--desktop" aria-label="Primary">
            <ul className="nav__list">
              <li className="nav__item">
                <a href={homeHref("#home")} className="nav__link">
                  {topbar.nav.start}
                </a>
              </li>
              <li className="nav__item">
                <a href={pageHref("/wartung")} className="nav__link nav__link--legal">
                  {topbar.nav.maintenance}
                </a>
              </li>
              <li className="nav__item">
                <a href={homeHref("#portfolio")} className="nav__link nav__link--anchor">
                  {topbar.nav.bikes}
                </a>
              </li>
              <li className="nav__item">
                <a href={homeHref("#price")} className="nav__link nav__link--anchor">
                  {topbar.nav.prices}
                </a>
              </li>
              <li className="nav__item">
                <a href={homeHref("#faq")} className="nav__link nav__link--anchor">
                  {topbar.nav.faq}
                </a>
              </li>
              <li className="nav__item">
                <a href={homeHref("#contact")} className="nav__link nav__link--anchor">
                  {topbar.nav.contact}
                </a>
              </li>
              <li className="nav__item">
                <Link href={pageHref("/blog")} className="nav__link">
                  {topbar.nav.blog}
                </Link>
              </li>
              <li className="nav__item">
                <a href={pageHref("/impressum")} className="nav__link nav__link--legal">
                  {topbar.nav.imprint}
                </a>
              </li>
              <li className="nav__item">
                <a href={pageHref("/datenschutzerklaerung")} className="nav__link nav__link--legal">
                  {topbar.nav.privacy}
                </a>
              </li>
            </ul>
          </nav>

          <div className="topbar__actions">
            {backLink ? (
              <Link className="topbar__home-link" href={backLink.href}>
                {backLink.label}
              </Link>
            ) : null}

            <button
              type="button"
              className="lang-switch"
              aria-label={`Switch language to ${lang === "de" ? "English" : "Deutsch"}`}
              onClick={() => navigateToLanguage(lang === "de" ? "en" : "de")}
            >
              {topbar.languageToggle}
            </button>

            <button
              type="button"
              className={`hamburger ${menuOpen ? "is-active" : ""}`}
              aria-label={topbar.menuButton}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </div>

      <div className={`mobile-drawer ${menuOpen ? "is-open" : ""}`}>
        <nav className="nav nav--mobile" aria-label="Mobile primary">
          <ul className="nav__list nav__list--mobile">
            <li className="nav__item nav__item--mobile">
              <a href={homeHref("#home")} className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                {topbar.nav.start}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a href={pageHref("/wartung")} className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                {topbar.nav.maintenance}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a
                href={homeHref("#portfolio")}
                className="nav__link nav__link--mobile nav__link--mobile-anchor"
                onClick={() => setMenuOpen(false)}
              >
                {topbar.nav.bikes}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a
                href={homeHref("#price")}
                className="nav__link nav__link--mobile nav__link--mobile-anchor"
                onClick={() => setMenuOpen(false)}
              >
                {topbar.nav.prices}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a
                href={homeHref("#faq")}
                className="nav__link nav__link--mobile nav__link--mobile-anchor"
                onClick={() => setMenuOpen(false)}
              >
                {topbar.nav.faq}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a
                href={homeHref("#contact")}
                className="nav__link nav__link--mobile nav__link--mobile-anchor"
                onClick={() => setMenuOpen(false)}
              >
                {topbar.nav.contact}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <Link href={pageHref("/blog")} className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                {topbar.nav.blog}
              </Link>
            </li>
            <li className="nav__item nav__item--mobile">
              <a href={pageHref("/impressum")} className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                {topbar.nav.imprint}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a
                href={pageHref("/datenschutzerklaerung")}
                className="nav__link nav__link--mobile"
                onClick={() => setMenuOpen(false)}
              >
                {topbar.nav.privacy}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function PortfolioSection({ lang, translations, portfolioItems }: PortfolioSectionProps) {
  const [activeBike, setActiveBike] = useState<PortfolioItem | null>(null);
  const roadBikeTitles = new Set([
    "Endurace CF SL 8",
    "Aeroad CF SL 8",
  ]);
  const grailBikeTitle = "Grail CF SL 7";

  useEffect(() => {
    document.body.classList.toggle("modal-open", Boolean(activeBike));
    return () => document.body.classList.remove("modal-open");
  }, [activeBike]);

  const handleReserve = () => {
    setActiveBike(null);
    window.requestAnimationFrame(() => {
      const messageField = document.getElementById("message") as HTMLTextAreaElement | null;
      messageField?.scrollIntoView({ behavior: "smooth", block: "center" });
      messageField?.focus({ preventScroll: true });
    });
  };

  return (
    <section id="portfolio" className="section section--portfolio">
      <div className="container">
        <SectionHeading eyebrow={translations.portfolio.eyebrow} title={translations.portfolio.title} />

        <div className="portfolio-grid">
          {portfolioItems.map((item) => (
            <button
              key={item.title}
              className={`portfolio-card ${
                item.title === "Aeroad CF SL 8"
                  ? "portfolio-card--promo"
                  : ""
              }`}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setActiveBike(item)}
            >
              <div className="portfolio-card__media">
                <Image
                  src={item.image}
                  alt={`${item.title} bei Munich Rental`}
                  fill
                  placeholder="empty"
                  sizes="(max-width: 780px) calc(100vw - 32px), (max-width: 1100px) calc((100vw - 64px) / 2), 384px"
                  className="portfolio-card__image"
                />
              </div>

              <span className="portfolio-card__badge" aria-hidden="true">
                {item.title === grailBikeTitle
                  ? lang === "de"
                    ? "München & Regensburg"
                    : "Munich & Regensburg"
                  : item.title === "Aeroad CF SL 8"
                    ? lang === "de"
                      ? "München"
                      : "Munich"
                    : roadBikeTitles.has(item.title)
                      ? lang === "de"
                        ? "München & Regensburg"
                        : "Munich & Regensburg"
                      : lang === "de"
                        ? "München"
                        : "Munich"}
              </span>

              <div
                className="portfolio-card__overlay"
                aria-hidden="true"
              >
                <p>{item.description[lang]}</p>
              </div>
              <img src="/assets/img/svg/right-arrow.svg" alt="" className="portfolio-card__arrow" />
              {item.title === "Aeroad CF SL 8" ? (
                <span className="portfolio-card__promo" aria-hidden="true">
                  <strong>25%</strong>
                  <span>{lang === "de" ? "Dauerhaften" : "Permanent"}</span>
                  <span>{lang === "de" ? "Juli - August" : "July - August"}</span>
                  <span>{lang === "de" ? "Rabatt" : "Discount"}</span>
                </span>
              ) : null}
              <div className="portfolio-card__details">
                <h3>{item.title}</h3>
                <div className="portfolio-card__meta">
                  <span>{item.subtitle[lang]}</span>
                  <span>{item.price[lang]}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {activeBike ? (
        <BikeModal
          bike={activeBike}
          lang={lang}
          translations={translations.modal}
          onClose={() => setActiveBike(null)}
          onReserve={handleReserve}
        />
      ) : null}
    </section>
  );
}

export function ContactForm({ lang, translations }: ContactFormProps) {
  const { trackLead, analyticsAllowed, saveAll } = useConsent();
  const searchParams = useSearchParams();
  const [location, setLocation] = useState<RentalLocation>("munich");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [height, setHeight] = useState("");
  const [bikeSize, setBikeSize] = useState("");
  const [contactMessage, setContactMessage] = useState(
    lang === "de"
      ? "Hey,\n\nich würde gerne ein Bike reservieren.\n\nIch freue mich über eine kurze Rückmeldung zu Verfügbarkeit und Abholung.\n\nViele Grüße"
      : "Hey,\n\nI would like to reserve a bike.\n\nPlease let me know about availability and pickup.\n\nBest regards",
  );
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropoffTime, setDropoffTime] = useState("");
  const [needsPedals, setNeedsPedals] = useState(false);
  const [pedalType, setPedalType] = useState("");
  const [needsComputerMount, setNeedsComputerMount] = useState(false);
  const [computerMountType, setComputerMountType] = useState("");
  const [needsHelmet, setNeedsHelmet] = useState(false);
  const [needsClothing, setNeedsClothing] = useState(false);
  const [contactStatus, setContactStatus] = useState<ContactStatus>("idle");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const affiliateKey = getAffiliateKey(searchParams);
  const bikeOptions = BIKE_OPTIONS_BY_LOCATION[location];

  const clearFieldError = (field: ContactField) => {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmitError(null);
    setContactStatus("idle");
  };

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validation = validateContactForm(translations, {
      location,
      name,
      contact,
      phone,
      height,
      bikeSize,
      periodFrom,
      periodTo,
      pickupTime,
      dropoffTime,
      needsPedals,
      pedalType,
      needsComputerMount,
      computerMountType,
      needsHelmet,
      needsClothing,
      message: contactMessage,
      privacyAccepted,
    });

    if (Object.keys(validation.fieldErrors).length > 0) {
      setFieldErrors(validation.fieldErrors);
      setSubmitError(validation.submitError);
      setContactStatus("error");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const nameValue = String(formData.get("name") ?? "").trim();
    const contactValue = String(formData.get("contact") ?? "").trim();
    const phoneValue = String(formData.get("phone") ?? "").trim();
    const heightValue = String(formData.get("height") ?? "").trim();
    const bikeSizeValue = String(formData.get("bikeSize") ?? "").trim();
    const locationValue = String(formData.get("location") ?? "").trim();
    const periodFromValue = String(formData.get("periodFrom") ?? "").trim();
    const periodToValue = String(formData.get("periodTo") ?? "").trim();
    const pickupTimeValue = String(formData.get("pickupTime") ?? "").trim();
    const dropoffTimeValue = String(formData.get("dropoffTime") ?? "").trim();
    const needsPedalsValue = formData.get("needsPedals") === "on";
    const pedalTypeValue = String(formData.get("pedalType") ?? "").trim();
    const needsComputerMountValue = formData.get("needsComputerMount") === "on";
    const computerMountTypeValue = String(formData.get("computerMountType") ?? "").trim();
    const needsHelmetValue = formData.get("needsHelmet") === "on";
    const needsClothingValue = formData.get("needsClothing") === "on";
    const message = String(formData.get("message") ?? "").trim();

    setContactStatus("sending");
    setFieldErrors({});
    setSubmitError(null);
    setOrderNumber(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nameValue,
          contact: contactValue,
          phone: phoneValue,
          height: heightValue,
          location: locationValue,
          bikeSize: bikeSizeValue,
          periodFrom: periodFromValue,
          periodTo: periodToValue,
          pickupTime: pickupTimeValue,
          dropoffTime: dropoffTimeValue,
          needsPedals: needsPedalsValue,
          pedalType: needsPedalsValue ? pedalTypeValue : "",
          needsComputerMount: needsComputerMountValue,
          computerMountType: needsComputerMountValue ? computerMountTypeValue : "",
          needsHelmet: needsHelmetValue,
          needsClothing: needsClothingValue,
          message,
          locale: lang,
          affiliateKey: affiliateKey || undefined,
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        code?: string;
        orderNumber?: string;
      } | null;

      if (!response.ok || !result?.ok) {
        const validationTexts = translations.form.validation;
        const code = result?.code ?? result?.error ?? "contact_failed";
        const errorMessage =
          code === "invalid_origin"
            ? validationTexts.submitOriginError
            : code === "payload_too_large"
              ? validationTexts.submitPayloadError
              : code === "config_incomplete"
                ? validationTexts.submitConfigError
                : code === "validation_error"
                  ? validationTexts.submitValidationError
                  : validationTexts.submitFailed;

        throw new Error(errorMessage);
      }

      form.reset();
      setName("");
      setContact("");
      setPhone("");
      setHeight("");
      setLocation("munich");
      setBikeSize("");
      setContactMessage("");
      setPeriodFrom("");
      setPeriodTo("");
      setPickupTime("");
      setDropoffTime("");
      setNeedsPedals(false);
      setPedalType("");
      setNeedsComputerMount(false);
      setComputerMountType("");
      setNeedsHelmet(false);
      setNeedsClothing(false);
      setPrivacyAccepted(false);
      setFieldErrors({});
      setSubmitError(null);
      setOrderNumber(result?.orderNumber ?? null);
      setContactStatus("success");

      if (analyticsAllowed) {
        trackLead({
          language: lang,
          contactMethod: "email",
        });
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : translations.form.validation.submitFailed);
      setContactStatus("error");
    }
  };

  return (
    <form className="contact-form" onSubmit={handleContactSubmit} noValidate>
      <div className="contact-form__fields">
        <div className="contact-form__field">
          <label htmlFor="location">{translations.form.location}</label>
          <select
            id="location"
            name="location"
            value={location}
            aria-invalid={Boolean(fieldErrors.location)}
            aria-describedby={fieldErrors.location ? "location-error" : undefined}
            onChange={(event) => {
              const nextLocation = isRentalLocation(event.target.value) ? event.target.value : "munich";
              const nextBikeOptions = BIKE_OPTIONS_BY_LOCATION[nextLocation];
              if (bikeSize && !nextBikeOptions.some((option) => option.value === bikeSize)) {
                setBikeSize("");
                setFieldErrors((current) => {
                  if (!current.bikeSize) {
                    return current;
                  }

                  const next = { ...current };
                  delete next.bikeSize;
                  return next;
                });
              }
              setLocation(nextLocation);
              clearFieldError("location");
            }}
          >
            {RENTAL_LOCATION_OPTIONS[lang].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldErrors.location ? (
            <p className="contact-form__error" id="location-error">
              {fieldErrors.location}
            </p>
          ) : null}
        </div>
        <div className="contact-form__field">
          <label htmlFor="name">{translations.form.name}</label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder={translations.form.name}
            value={name}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError("name");
            }}
          />
          {fieldErrors.name ? (
            <p className="contact-form__error" id="name-error">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>
        <div className="contact-form__field">
          <label htmlFor="contact">{translations.form.contact}</label>
          <input
            id="contact"
            name="contact"
            type="email"
            placeholder={translations.form.contact}
            value={contact}
            aria-invalid={Boolean(fieldErrors.contact)}
            aria-describedby={fieldErrors.contact ? "contact-error" : undefined}
            onChange={(event) => {
              setContact(event.target.value);
              clearFieldError("contact");
            }}
            inputMode="email"
            autoComplete="email"
          />
          {fieldErrors.contact ? (
            <p className="contact-form__error" id="contact-error">
              {fieldErrors.contact}
            </p>
          ) : null}
        </div>
        <div className="contact-form__field">
          <label htmlFor="phone">{translations.form.phone}</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder={translations.form.phone}
            value={phone}
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? "phone-hint phone-error" : "phone-hint"}
            onChange={(event) => {
              setPhone(event.target.value);
              clearFieldError("phone");
            }}
            inputMode="tel"
            autoComplete="tel"
          />
          <p className="contact-form__hint" id="phone-hint">
            {translations.form.phoneHint}
          </p>
          {fieldErrors.phone ? (
            <p className="contact-form__error" id="phone-error">
              {fieldErrors.phone}
            </p>
          ) : null}
        </div>
        <div className="contact-form__bike-fields">
          <div className="contact-form__field">
            <label htmlFor="height">{translations.form.height}</label>
            <input
              id="height"
              name="height"
              type="number"
              min="100"
              max="250"
              value={height}
              aria-invalid={Boolean(fieldErrors.height)}
              aria-describedby={fieldErrors.height ? "height-error" : undefined}
              onChange={(event) => {
                setHeight(event.target.value);
                clearFieldError("height");
              }}
              inputMode="numeric"
            />
            {fieldErrors.height ? (
              <p className="contact-form__error" id="height-error">
                {fieldErrors.height}
              </p>
            ) : null}
          </div>
          <div className="contact-form__field">
            <label htmlFor="bike-size">{translations.form.bikeSize}</label>
            <select
              id="bike-size"
              name="bikeSize"
              value={bikeSize}
              aria-invalid={Boolean(fieldErrors.bikeSize)}
              aria-describedby={fieldErrors.bikeSize ? "bike-size-error" : undefined}
              onChange={(event) => {
                setBikeSize(event.target.value);
                clearFieldError("bikeSize");
              }}
            >
              <option value="" disabled>
                {lang === "de" ? "Rennrad auswählen" : "Choose a road bike"}
              </option>
              {bikeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldErrors.bikeSize ? (
              <p className="contact-form__error" id="bike-size-error">
                {fieldErrors.bikeSize}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="contact-form__period">
        <span className="contact-form__hint">{translations.form.periodHint}</span>
        <div className="contact-form__period-fields">
          <div className="contact-form__period-field">
            <label htmlFor="period-from">{translations.form.periodFrom}</label>
            <input
              id="period-from"
              name="periodFrom"
              type="date"
              value={periodFrom}
              aria-invalid={Boolean(fieldErrors.periodFrom)}
              aria-describedby={fieldErrors.periodFrom ? "period-from-error" : undefined}
              onChange={(event) => {
                setPeriodFrom(event.target.value);
                clearFieldError("periodFrom");
              }}
            />
            {fieldErrors.periodFrom ? (
              <p className="contact-form__error" id="period-from-error">
                {fieldErrors.periodFrom}
              </p>
            ) : null}
          </div>
          <div className="contact-form__period-field">
            <label htmlFor="period-to">{translations.form.periodTo}</label>
            <input
              id="period-to"
              name="periodTo"
              type="date"
              value={periodTo}
              aria-invalid={Boolean(fieldErrors.periodTo)}
              aria-describedby={fieldErrors.periodTo ? "period-to-error" : undefined}
              onChange={(event) => {
                setPeriodTo(event.target.value);
                clearFieldError("periodTo");
              }}
            />
            {fieldErrors.periodTo ? (
              <p className="contact-form__error" id="period-to-error">
                {fieldErrors.periodTo}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="contact-form__period">
        <div className="contact-form__period-fields">
          <div className="contact-form__period-field">
            <label htmlFor="pickup-time">{translations.form.pickupTime}</label>
            <input
              id="pickup-time"
              name="pickupTime"
              type="time"
              value={pickupTime}
              aria-invalid={Boolean(fieldErrors.pickupTime)}
              aria-describedby={fieldErrors.pickupTime ? "pickup-time-error" : undefined}
              onChange={(event) => {
                setPickupTime(event.target.value);
                clearFieldError("pickupTime");
              }}
            />
            {fieldErrors.pickupTime ? (
              <p className="contact-form__error" id="pickup-time-error">
                {fieldErrors.pickupTime}
              </p>
            ) : null}
          </div>
          <div className="contact-form__period-field">
            <label htmlFor="dropoff-time">{translations.form.dropoffTime}</label>
            <input
              id="dropoff-time"
              name="dropoffTime"
              type="time"
              value={dropoffTime}
              aria-invalid={Boolean(fieldErrors.dropoffTime)}
              aria-describedby={fieldErrors.dropoffTime ? "dropoff-time-error" : undefined}
              onChange={(event) => {
                setDropoffTime(event.target.value);
                clearFieldError("dropoffTime");
              }}
            />
            {fieldErrors.dropoffTime ? (
              <p className="contact-form__error" id="dropoff-time-error">
                {fieldErrors.dropoffTime}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="contact-form__period">
        <span className="contact-form__section-title">{translations.form.equipment}</span>
        <div className="contact-form__equipment-grid">
          <div className="contact-form__equipment-item">
            <label className="contact-form__checkbox">
              <input
                type="checkbox"
                name="needsPedals"
                checked={needsPedals}
                onChange={(event) => {
                  const nextValue = event.target.checked;
                  setNeedsPedals(nextValue);
                  if (!nextValue) {
                    setPedalType("");
                  }
                  clearFieldError("pedalType");
                }}
              />
              <span>{translations.form.pedals}</span>
            </label>

            {needsPedals ? (
              <div className="contact-form__field">
                <label htmlFor="pedal-type">{translations.form.pedalType}</label>
                <select
                  id="pedal-type"
                  name="pedalType"
                  value={pedalType}
                  aria-invalid={Boolean(fieldErrors.pedalType)}
                  aria-describedby={fieldErrors.pedalType ? "pedal-type-error" : undefined}
                  onChange={(event) => {
                    setPedalType(event.target.value);
                    clearFieldError("pedalType");
                  }}
                >
                  <option value="" disabled>
                    {translations.form.pedalType}
                  </option>
                  <option value="platform">{translations.form.pedalTypeOptions.platform}</option>
                  <option value="spdSl">{translations.form.pedalTypeOptions.spdSl}</option>
                  <option value="lookKeo2Max">{translations.form.pedalTypeOptions.lookKeo2Max}</option>
                  <option value="other">{translations.form.pedalTypeOptions.other}</option>
                </select>
                {fieldErrors.pedalType ? (
                  <p className="contact-form__error" id="pedal-type-error">
                    {fieldErrors.pedalType}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="contact-form__equipment-item">
            <label className="contact-form__checkbox">
              <input
                type="checkbox"
                name="needsComputerMount"
                checked={needsComputerMount}
                onChange={(event) => {
                  const nextValue = event.target.checked;
                  setNeedsComputerMount(nextValue);
                  if (!nextValue) {
                    setComputerMountType("");
                  }
                  clearFieldError("computerMountType");
                }}
              />
              <span>{translations.form.computerMount}</span>
            </label>

            {needsComputerMount ? (
              <div className="contact-form__field">
                <label htmlFor="computer-mount-type">{translations.form.computerMountType}</label>
                <select
                  id="computer-mount-type"
                  name="computerMountType"
                  value={computerMountType}
                  aria-invalid={Boolean(fieldErrors.computerMountType)}
                  aria-describedby={fieldErrors.computerMountType ? "computer-mount-type-error" : undefined}
                  onChange={(event) => {
                    setComputerMountType(event.target.value);
                    clearFieldError("computerMountType");
                  }}
                >
                  <option value="" disabled>
                    {translations.form.computerMountType}
                  </option>
                  <option value="garmin">{translations.form.computerMountTypeOptions.garmin}</option>
                  <option value="wahoo">{translations.form.computerMountTypeOptions.wahoo}</option>
                  <option value="other">{translations.form.computerMountTypeOptions.other}</option>
                </select>
                {fieldErrors.computerMountType ? (
                  <p className="contact-form__error" id="computer-mount-type-error">
                    {fieldErrors.computerMountType}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <label className="contact-form__checkbox">
            <input
              type="checkbox"
              name="needsHelmet"
              checked={needsHelmet}
              onChange={(event) => {
                setNeedsHelmet(event.target.checked);
              }}
            />
            <span>{translations.form.helmet}</span>
          </label>

          <label className="contact-form__checkbox">
            <input
              type="checkbox"
              name="needsClothing"
              checked={needsClothing}
              onChange={(event) => {
                setNeedsClothing(event.target.checked);
              }}
            />
            <span>{translations.form.clothing}</span>
          </label>
        </div>
      </div>
      <textarea
        id="message"
        name="message"
        placeholder={translations.form.message}
        value={contactMessage}
        aria-invalid={Boolean(fieldErrors.message)}
        aria-describedby={fieldErrors.message ? "message-error" : undefined}
        onChange={(event) => {
          setContactMessage(event.target.value);
          clearFieldError("message");
        }}
      />
      {fieldErrors.message ? (
        <p className="contact-form__error" id="message-error">
          {fieldErrors.message}
        </p>
      ) : null}

      <label className="contact-form__checkbox">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(event) => {
            const nextValue = event.target.checked;
            setPrivacyAccepted(nextValue);
            if (nextValue) {
              saveAll();
            }
            clearFieldError("privacy");
          }}
          aria-invalid={Boolean(fieldErrors.privacy)}
          aria-describedby={fieldErrors.privacy ? "privacy-error" : undefined}
        />
        <span>{translations.form.privacy}</span>
      </label>
      {fieldErrors.privacy ? (
        <p className="contact-form__error" id="privacy-error">
          {fieldErrors.privacy}
        </p>
      ) : null}

      <button type="submit" className="button button--arrow" disabled={contactStatus === "sending"}>
        <span>{contactStatus === "sending" ? translations.form.sending : translations.form.submit}</span>
        <img src="/assets/img/svg/right-arrow.svg" alt="" />
      </button>

      {contactStatus === "success" ? (
        <div className="contact-form__status is-success">
          <p>{translations.form.success}</p>
          {orderNumber ? (
            <p>
              {translations.form.orderNumberLabel}: {orderNumber}
            </p>
          ) : null}
        </div>
      ) : null}
      {contactStatus === "error" ? (
        <p className="contact-form__status is-error">{submitError ?? translations.form.error}</p>
      ) : null}
    </form>
  );
}
