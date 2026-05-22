"use client";

import mainImage from "../main.png";
import { useEffect, useState } from "react";
import {
  Bike,
  CalendarClock,
  CalendarRange,
  GraduationCap,
  Package,
  MapPin,
  type LucideIcon,
} from "lucide-react";

type PortfolioItem = {
  title: string;
  subtitle: string;
  image: string;
  href: string;
  tone: "blue" | "peach" | "mint";
};

type ServiceItem = {
  title: string;
  text: string;
};

type PriceItem = {
  title: string;
  cost: string;
  icon: LucideIcon;
};

const navItems = [
  { href: "#home", label: "Start" },
  { href: "#portfolio", label: "Räder" },
  { href: "#price", label: "Preise" },
  { href: "#contact", label: "Kontakt" },
];

const services: ServiceItem[] = [
  {
    title: "Wer wir sind",
    text: "Wir sind Julius und Justus, beide 20 Jahre alt, und stecken unsere ganze Fahrradleidenschaft in den Verleih.",
  },
  {
    title: "Was wir machen",
    text: "Wir verleihen ausschließlich unsere eigenen Fahrräder in München und sorgen dafür, dass jedes Rad sofort startklar ist.",
  },
  {
    title: "Warum wir",
    text: "Weil wir selbst leidenschaftliche Fahrer sind, wollten wir einen Verleih aufbauen, dem man seine Bikes gerne anvertraut.",
  },
  {
    title: "Wofür wir stehen",
    text: "Perfekt gepflegte Räder, Zuverlässigkeit und ehrlicher persönlicher Kontakt statt anonymer Massenverleih.",
  },
];

const portfolioItems: PortfolioItem[] = [
  {
    title: "Endurance CF SL 8 Di2",
    subtitle: "Rahmengrößen: S / M / L",
    image: "/bikes/endurance-cf-sl-8-di2/preview.png",
    href: "/bikes/endurance-cf-sl-8-di2/preview.png",
    tone: "blue",
  },
  {
    title: "Ultimate CF SL 7 eTap AXS",
    subtitle: "Rahmengrößen: S / M / L",
    image: "/bikes/ultimate-cf-sl-7eTap-axs/preview.png",
    href: "/bikes/ultimate-cf-sl-7eTap-axs/preview.png",
    tone: "peach",
  },
  {
    title: "Aeroad CF SL 8 Disc",
    subtitle: "Rahmengröße: M",
    image: "/bikes/aeroad-cf-sl-8-disc/preview.png",
    href: "/bikes/aeroad-cf-sl-8-disc/preview.png",
    tone: "mint",
  },
];

const priceItems: PriceItem[] = [
  {
    title: "Rennräder",
    cost: "ab 39€",
    icon: Bike,
  },
  {
    title: "Wochenenderabatt",
    cost: "10%",
    icon: CalendarRange,
  },
  {
    title: "Ab 3 Tagen",
    cost: "20%",
    icon: CalendarClock,
  },
  {
    title: "Studentenrabatt",
    cost: "20%",
    icon: GraduationCap,
  },
  {
    title: "Zubehör",
    cost: "ab 5€",
    icon: Package,
  },
];

const contactItems = [
  {
    label: "Reservierung per Nachricht",
    icon: "/assets/img/svg/placeholder.svg",
  },
  {
    label: "WhatsApp: +49 152 51330962",
    icon: "/assets/img/svg/phone.svg",
    href: "https://wa.me/4915251330962",
  },
  {
    label: "Anrufen: +49 152 51330962",
    icon: "/assets/img/svg/mail.svg",
    href: "tel:+4915251330962",
  },
];

const socials = [
  { href: "#", icon: "/assets/img/svg/social/facebook.svg", label: "Facebook" },
  { href: "#", icon: "/assets/img/svg/social/twitter.svg", label: "Twitter" },
  {
    href: "#",
    icon: "/assets/img/svg/social/instagram.svg",
    label: "Instagram",
  },
  { href: "#", icon: "/assets/img/svg/social/dribbble.svg", label: "Dribbble" },
  { href: "#", icon: "/assets/img/svg/social/tik-tok.svg", label: "TikTok" },
];

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

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  return (
    <main className="site-shell">
      <header className={`topbar ${scrolled ? "is-scrolled" : ""}`}>
        <div className="container topbar__inner">
          <a className="brand" href="#home" aria-label="BikeRental München home">
            <img src="/assets/img/logo/dark.png" alt="BikeRental München logo" className="brand__logo" />
          </a>

          <nav className="nav nav--desktop" aria-label="Primary">
            <ul className="nav__list">
              {navItems.map((item) => (
                <li key={item.href} className="nav__item">
                  <a href={item.href} className="nav__link">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            className={`hamburger ${menuOpen ? "is-active" : ""}`}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className={`mobile-drawer ${menuOpen ? "is-open" : ""}`}>
          <nav className="nav nav--mobile" aria-label="Mobile primary">
            <ul className="nav__list nav__list--mobile">
              {navItems.map((item) => (
                <li key={item.href} className="nav__item nav__item--mobile">
                  <a href={item.href} className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <section id="home" className="hero section">
        <div className="container hero__grid">
          <div className="hero__copy">
            <span className="hero__location">
              <MapPin className="hero__location-icon" aria-hidden="true" />
              <span>München - Maxvorstadt</span>
            </span>
            <h1 className="hero__title">Fahrradverleih aus Leidenschaft</h1>
            <p className="hero__intro">
              Wir sind zwei junge Burschen aus München, die schon immer von einem eigenen Fahrradverleih
              geträumt haben. Weil wir selbst begeisterte Fahrer sind, kümmern wir uns mit viel Herz um
              unsere Bikes und verleihen ausschließlich unsere eigenen Räder.
            </p>

            <ul className="hero-stats">
              <li className="hero-stats__item">
                <strong>2</strong>
                <span>
                  Inhaber
                  <br />
                  mit Bike-Leidenschaft
                </span>
              </li>
              <li className="hero-stats__item">
                <strong>Perfekt</strong>
                <span>
                  gepflegte
                  <br />
                  Räder
                </span>
              </li>
            </ul>
          </div>

          <div className="hero__visual">
            <div className="hero-frame">
              <img src={mainImage.src} alt="" className="hero-frame__ratio" />
              <div
                className="hero-frame__image"
                aria-hidden="true"
                style={{ backgroundImage: `url(${mainImage.src})` }}
              />
              <span className="hero-frame__shape" aria-hidden="true" />
            </div>
          </div>

          <a className="hero__down" href="#portfolio" aria-label="Scroll to portfolio">
            <img src="/assets/img/svg/down-arrow.svg" alt="" />
          </a>
        </div>
      </section>

      <section id="portfolio" className="section section--portfolio">
        <div className="container">
          <SectionHeading eyebrow="Unsere Bikes" title="Verfügbare Räder" />

          <div className="portfolio-grid">
            {portfolioItems.map((item) => (
              <a
                key={item.title}
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                className={`portfolio-card portfolio-card--${item.tone}`}
              >
                <div className="portfolio-card__media">
                  <div className="portfolio-card__decor" aria-hidden="true">
                    <span className="portfolio-card__blob portfolio-card__blob--one" />
                    <span className="portfolio-card__blob portfolio-card__blob--two" />
                    <span className="portfolio-card__blob portfolio-card__blob--three" />
                    <span className="portfolio-card__blob portfolio-card__blob--four" />
                    <span className="portfolio-card__blob portfolio-card__blob--five" />
                    <span className="portfolio-card__blob portfolio-card__blob--six" />
                    <span className="portfolio-card__blob portfolio-card__blob--seven" />
                    <span className="portfolio-card__blob portfolio-card__blob--eight" />
                  </div>
                  <img src="/assets/img/portfolio/410-460.jpg" alt="" className="portfolio-card__ratio" />
                  <div
                    className="portfolio-card__image"
                    style={{ backgroundImage: `url(${item.image})` }}
                    aria-hidden="true"
                  />
                </div>

                <div className="portfolio-card__overlay" aria-hidden="true" />
                <img src="/assets/img/svg/right-arrow.svg" alt="" className="portfolio-card__arrow" />

                <div className="portfolio-card__details">
                  <h3>{item.title}</h3>
                  <span>{item.subtitle}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="section section--about">
        <div className="container">
          <SectionHeading eyebrow="Über uns" title="Was uns ausmacht" />

          <ul className="hero-profile hero-profile--section">
            {services.map((service) => (
              <li key={service.title} className="hero-profile__item">
                <span className="hero-profile__label">{service.title}</span>
                <span className="hero-profile__text">{service.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="price" className="section section--price">
        <div className="container price-grid">
          <div className="price-grid__copy">
            <SectionHeading eyebrow="Preise" title="Miete & Tarife" />
            <p className="section-copy">
              Klare Preise, unkomplizierte Rabatte und Zubehör für deine Tour.
            </p>
          </div>

          <div className="price-grid__list">
            {priceItems.map((item) => (
              <article key={item.title} className="price-item">
                <item.icon className="price-item__icon" aria-hidden="true" />
                <div className="price-item__title">{item.title}</div>
                <div className="price-item__cost">{item.cost}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="section section--contact">
        <div className="container contact-grid">
          <div className="contact-grid__copy">
            <SectionHeading eyebrow="Kontakt" title="Kontakt aufnehmen" />
            <p className="section-copy">
              Schreib uns einfach, wenn du ein Rad reservieren möchtest. Du kannst uns direkt per
              Nachricht anschreiben, über WhatsApp unter +49 152 51330962 kontaktieren oder uns einfach
              anrufen.
            </p>

            <ul className="contact-list">
              {contactItems.map((item) => (
                <li key={item.label} className="contact-list__item">
                  {item.href ? (
                    <a href={item.href} className="contact-list__link">
                      <img src={item.icon} alt="" className="contact-list__icon" />
                      <span>{item.label}</span>
                    </a>
                  ) : (
                    <>
                      <img src={item.icon} alt="" className="contact-list__icon" />
                      <span>{item.label}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <form className="contact-form">
            <div className="contact-form__fields">
              <input id="name" name="name" type="text" placeholder="Name" />
              <input id="email" name="email" type="email" placeholder="E-Mail" />
            </div>
            <textarea id="message" name="message" placeholder="Worum geht es?" />

            <button type="submit" className="button button--arrow">
              <span>Anfrage senden</span>
              <img src="/assets/img/svg/right-arrow.svg" alt="" />
            </button>
          </form>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer__inner">
          <p>Copyright © BikeRental München. Alle Rechte vorbehalten.</p>

          <ul className="socials">
            {socials.map((item) => (
              <li key={item.label} className="socials__item">
                <a href={item.href} aria-label={item.label}>
                  <img src={item.icon} alt="" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </main>
  );
}
