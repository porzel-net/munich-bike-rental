"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { Ruler, ShieldCheck, Weight, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createReservationMessage,
  type Locale,
  type PortfolioItem,
} from "../lib/home-content";

type TopbarTranslations = {
  nav: {
    start: string;
    bikes: string;
    prices: string;
    faq: string;
    contact: string;
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
  name: string;
  contact: string;
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
  message: string;
  messageHint: string;
  privacy: string;
  submit: string;
  sending: string;
  success: string;
  error: string;
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

type ContactStatus = "idle" | "sending" | "success" | "error";

function getSetupLabel(lang: Locale, bikeTitle: string) {
  if (bikeTitle === "Endurace CF SL 8 Di2") {
    return lang === "de" ? "Komfortables Setup" : "Comfort setup";
  }

  if (bikeTitle === "Ultimate CF SL 7 eTap AXS") {
    return lang === "de" ? "Sportliches Setup" : "Sport setup";
  }

  return lang === "de" ? "Aggressives Setup" : "Aggressive setup";
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
                placeholder="blur"
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
                  placeholder="blur"
                  sizes="180px"
                  className="bike-modal__thumb-image"
                />
              </button>

              {bike.gallery.map((image, index) => (
                <button
                  key={image.src}
                  type="button"
                  className={`bike-modal__thumb ${selectedImage === image ? "is-active" : ""}`}
                  onClick={() => setSelectedImage(image)}
                  aria-label={`${bike.title} ${translations.detailImage} ${index + 1}`}
                >
                  <Image
                    src={image}
                    alt={`${bike.title} detail ${index + 1}`}
                    fill
                    placeholder="blur"
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

export function HomeTopbar({ lang, topbar }: HomeTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  const navigateToLanguage = (nextLang: Locale) => {
    const search = new URLSearchParams(window.location.search);
    search.set("lang", nextLang);
    const nextUrl = `${pathname}?${search.toString()}${window.location.hash}`;
    router.push(nextUrl);
    setMenuOpen(false);
  };

  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <a className="brand" href="#home" aria-label="Munich Rental home">
          <span className="brand__text">Munich Rental</span>
        </a>

        <div className="topbar__right">
          <nav className="nav nav--desktop" aria-label="Primary">
            <ul className="nav__list">
              <li className="nav__item">
                <a href="#home" className="nav__link">
                  {topbar.nav.start}
                </a>
              </li>
              <li className="nav__item">
                <a href="#portfolio" className="nav__link">
                  {topbar.nav.bikes}
                </a>
              </li>
              <li className="nav__item">
                <a href="#price" className="nav__link">
                  {topbar.nav.prices}
                </a>
              </li>
              <li className="nav__item">
                <a href="#faq" className="nav__link">
                  {topbar.nav.faq}
                </a>
              </li>
              <li className="nav__item">
                <a href="#contact" className="nav__link">
                  {topbar.nav.contact}
                </a>
              </li>
              <li className="nav__item">
                <a href="/impressum" className="nav__link nav__link--legal">
                  {topbar.nav.imprint}
                </a>
              </li>
              <li className="nav__item">
                <a href="/datenschutzerklaerung" className="nav__link nav__link--legal">
                  {topbar.nav.privacy}
                </a>
              </li>
            </ul>
          </nav>

          <div className="topbar__actions">
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
              <a href="#home" className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                {topbar.nav.start}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a href="#portfolio" className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                {topbar.nav.bikes}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a href="#price" className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                {topbar.nav.prices}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a href="#faq" className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                {topbar.nav.faq}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a href="#contact" className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                {topbar.nav.contact}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a href="/impressum" className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                {topbar.nav.imprint}
              </a>
            </li>
            <li className="nav__item nav__item--mobile">
              <a
                href="/datenschutzerklaerung"
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

  useEffect(() => {
    document.body.classList.toggle("modal-open", Boolean(activeBike));
    return () => document.body.classList.remove("modal-open");
  }, [activeBike]);

  const handleReserve = (bikeTitle: string) => {
    sessionStorage.setItem("pendingReservationBike", bikeTitle);
    window.dispatchEvent(new CustomEvent("bike-reservation", { detail: bikeTitle }));
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
              className="portfolio-card"
              type="button"
              aria-haspopup="dialog"
              onClick={() => setActiveBike(item)}
            >
              <div className="portfolio-card__media">
                <Image
                  src={item.image}
                  alt={`${item.title} bei Munich Rental`}
                  fill
                  placeholder="blur"
                  sizes="(max-width: 780px) calc(100vw - 32px), (max-width: 1100px) calc((100vw - 64px) / 2), 384px"
                  className="portfolio-card__image"
                />
              </div>

              <div className="portfolio-card__overlay" aria-hidden="true">
                <p>{item.description[lang]}</p>
              </div>
              <img src="/assets/img/svg/right-arrow.svg" alt="" className="portfolio-card__arrow" />

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
  const [contactMessage, setContactMessage] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [pendingReservationBike, setPendingReservationBike] = useState<string | null>(null);
  const [contactStatus, setContactStatus] = useState<ContactStatus>("idle");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  useEffect(() => {
    const applyPendingBike = (bikeTitle: string | null) => {
      if (!bikeTitle) {
        return;
      }

      setPendingReservationBike(bikeTitle);
      setContactMessage(createReservationMessage(lang, bikeTitle));
      sessionStorage.removeItem("pendingReservationBike");
    };

    applyPendingBike(sessionStorage.getItem("pendingReservationBike"));

    const onBikeReservation = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      applyPendingBike(customEvent.detail);
    };

    window.addEventListener("bike-reservation", onBikeReservation);
    return () => window.removeEventListener("bike-reservation", onBikeReservation);
  }, [lang]);

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const contact = String(formData.get("contact") ?? "").trim();
    const height = String(formData.get("height") ?? "").trim();
    const bikeSize = String(formData.get("bikeSize") ?? "").trim();
    const periodFromValue = String(formData.get("periodFrom") ?? "").trim();
    const periodToValue = String(formData.get("periodTo") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();

    setContactStatus("sending");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          contact,
          height,
          bikeSize,
          periodFrom: periodFromValue,
          periodTo: periodToValue,
          message,
          bikeTitle: pendingReservationBike ?? "",
          locale: lang,
        }),
      });

      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? "contact_failed");
      }

      form.reset();
      setContactMessage("");
      setPeriodFrom("");
      setPeriodTo("");
      setPendingReservationBike(null);
      setPrivacyAccepted(false);
      setContactStatus("success");
    } catch {
      setContactStatus("error");
    }
  };

  return (
    <form className="contact-form" onSubmit={handleContactSubmit}>
      <div className="contact-form__fields">
        <input id="name" name="name" type="text" placeholder={translations.form.name} />
        <input
          id="contact"
          name="contact"
          type="text"
          placeholder={translations.form.contact}
          inputMode="text"
          required
        />
        <div className="contact-form__bike-fields">
          <div className="contact-form__field">
            <label htmlFor="height">{translations.form.height}</label>
            <input
              id="height"
              name="height"
              type="number"
              min="100"
              max="250"
              inputMode="numeric"
              required
            />
          </div>
          <div className="contact-form__field">
            <label htmlFor="bike-size">{translations.form.bikeSize}</label>
            <select id="bike-size" name="bikeSize" defaultValue="" required>
              <option value="" disabled>
                {translations.form.bikeSize}
              </option>
              <option value="S">{translations.form.bikeSizeOptions.s}</option>
              <option value="M">{translations.form.bikeSizeOptions.m}</option>
              <option value="L">{translations.form.bikeSizeOptions.l}</option>
            </select>
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
              onChange={(event) => {
                setPeriodFrom(event.target.value);
                setContactStatus("idle");
              }}
              required
            />
          </div>
          <div className="contact-form__period-field">
            <label htmlFor="period-to">{translations.form.periodTo}</label>
            <input
              id="period-to"
              name="periodTo"
              type="date"
              value={periodTo}
              onChange={(event) => {
                setPeriodTo(event.target.value);
                setContactStatus("idle");
              }}
              required
            />
          </div>
        </div>
      </div>
      <textarea
        id="message"
        name="message"
        placeholder={translations.form.message}
        value={contactMessage}
        onChange={(event) => {
          setContactMessage(event.target.value);
          setContactStatus("idle");
        }}
        required
      />
      <p className="contact-form__hint">{translations.form.messageHint}</p>

      <label className="contact-form__checkbox">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(event) => {
            setPrivacyAccepted(event.target.checked);
            setContactStatus("idle");
          }}
        />
        <span>{translations.form.privacy}</span>
      </label>

      <button type="submit" className="button button--arrow" disabled={contactStatus === "sending" || !privacyAccepted || !periodFrom || !periodTo}>
        <span>{contactStatus === "sending" ? translations.form.sending : translations.form.submit}</span>
        <img src="/assets/img/svg/right-arrow.svg" alt="" />
      </button>

      {contactStatus === "success" ? <p className="contact-form__status is-success">{translations.form.success}</p> : null}
      {contactStatus === "error" ? <p className="contact-form__status is-error">{translations.form.error}</p> : null}
    </form>
  );
}
