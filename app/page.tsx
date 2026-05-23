"use client";

import mainImage from "../main.png";
import { useEffect, useState, type FormEvent } from "react";
import {
  Bike,
  CalendarClock,
  CalendarRange,
  GraduationCap,
  Package,
  MapPin,
  Ruler,
  ShieldCheck,
  Wrench,
  Weight,
  X,
  type LucideIcon,
} from "lucide-react";

type PortfolioItem = {
  title: string;
  subtitle: string;
  price: string;
  description: string;
  image: string;
  gallery: string[];
  facts: Array<{
    label: string;
    value: string;
  }>;
  equipment: string[];
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
  { href: "#faq", label: "FAQ" },
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
    text: "Weil man lieber zu uns Studenten geht, die sich aus Leidenschaft um die Fahrräder kümmern, statt ein Bike bei einem großen Konzern zu mieten.",
  },
  {
    title: "Wofür wir stehen",
    text: "Perfekt gepflegte Räder, Zuverlässigkeit und ehrlicher persönlicher Kontakt statt anonymer Massenverleih.",
  },
];

const portfolioItems: PortfolioItem[] = [
  {
    title: "Endurance CF SL 8 Di2",
    subtitle: "S / M / L",
    price: "39€/Tag",
    description: "Ausgewogenes Rennrad für schnelle, lange Touren und entspannte Ausfahrten mit viel Komfort.",
    image: "/bikes/endurance-cf-sl-8-di2/preview.png",
    gallery: [
      "/bikes/endurance-cf-sl-8-di2/real1.png",
      "/bikes/endurance-cf-sl-8-di2/real2.png",
    ],
    facts: [
      { label: "Schaltung", value: "Shimano Ultegra Di2" },
      { label: "Bremsen", value: "Hydraulische Scheibenbremsen" },
      { label: "Laufräder", value: "DT Swiss Laufräder" },
    ],
    equipment: ["Elektronische Schaltung", "Sportliche Sitzposition", "Direktes Handling", "Pannensichere Bereifung"],
  },
  {
    title: "Ultimate CF SL 7 eTap AXS",
    subtitle: "M / L",
    price: "45€/Tag",
    description: "Leichtes Allround-Rad für sportliche Ausfahrten, Training und flotte Touren in der Stadt.",
    image: "/bikes/ultimate-cf-sl-7eTap-axs/preview.png",
    gallery: [
      "/bikes/ultimate-cf-sl-7eTap-axs/real1.png",
      "/bikes/ultimate-cf-sl-7eTap-axs/real2.png",
      "/bikes/ultimate-cf-sl-7eTap-axs/real3.png",
    ],
    facts: [
      { label: "Rahmen", value: "Carbonrahmen" },
      { label: "Schaltung", value: "SRAM Rival eTap AXS 2x12" },
      { label: "Bremsen", value: "Hydraulische Scheibenbremsen" },
      { label: "Laufräder", value: "DT Swiss Laufräder" },
    ],
    equipment: ["Elektronische Schaltung", "Tubeless-ready", "Leichte Bauweise", "Sportliche Geometrie"],
  },
  {
    title: "Aeroad CF SL 8 Disc",
    subtitle: "S / M",
    price: "80€/Tag",
    description: "Aero-Bike für maximale Geschwindigkeit auf der Straße und ein direktes, sportliches Fahrgefühl.",
    image: "/bikes/aeroad-cf-sl-8-disc/preview.png",
    gallery: [
      "/bikes/aeroad-cf-sl-8-disc/real1.png",
      "/bikes/aeroad-cf-sl-8-disc/real2.png",
      "/bikes/aeroad-cf-sl-8-disc/real3.png",
      "/bikes/aeroad-cf-sl-8-disc/real4.png",
    ],
    facts: [
      { label: "Antrieb", value: "Shimano Ultegra R8000 2x11" },
      { label: "Kassette", value: "11-34, neuwertig" },
      { label: "Schaltwerk", value: "Shimano Ultegra Longcage" },
      { label: "Laufräder", value: "DT Swiss ARC 1600, 62 / 50 mm" },
    ],
    equipment: ["Continental Grand Prix S TR 28 mm", "Tanwall-Reifen", "Bergtaugliche Übersetzung", "Aero-orientiertes Setup"],
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
    label: "hallo@munich-bike-rental.de",
    icon: "/assets/img/svg/mail.svg",
    href: "mailto:hallo@munich-bike-rental.de",
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

const faqItems = [
  {
    question: "Wie läuft die Anfrage und Miete ab?",
    answer:
      "Alle Fahrräder können online angefragt und gemietet werden. Wir klären anschließend alles per E-Mail, WhatsApp oder Telefon, damit am Ende Preis, Zeitraum und Abholung sauber passen.",
  },
  {
    question: "Wo werden die Fahrräder abgeholt?",
    answer:
      "Die Abholung findet vor Ort in München-Maxvorstadt statt. Den genauen Ablauf stimmen wir nach der Anfrage per E-Mail mit dir ab.",
  },
  {
    question: "Sind die Fahrräder versichert?",
    answer:
      "Ja, alle Fahrräder sind über eine gewerbliche Versicherung abgesichert. Die Versicherung umfasst Diebstahl, Schäden und Zerstörung.",
  },
  {
    question: "Was passiert, wenn etwas beschädigt wird?",
    answer:
      "Auch in diesem Fall bist du nicht allein. Wir arbeiten mit einer gewerblichen Versicherung, damit Diebstahl, Schäden und Zerstörung abgesichert sind und wir gemeinsam eine saubere Lösung haben.",
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

function BikeModal({
  bike,
  onClose,
}: {
  bike: PortfolioItem;
  onClose: () => void;
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
        <button type="button" className="bike-modal__close" aria-label="Close details" onClick={onClose}>
          <X />
        </button>

        <div className="bike-modal__layout">
          <div className="bike-modal__visuals">
            <div className="bike-modal__hero">
              <img src={selectedImage} alt={bike.title} />
            </div>

            <div className="bike-modal__gallery">
              <button
                type="button"
                className={`bike-modal__thumb ${selectedImage === bike.image ? "is-active" : ""}`}
                onClick={() => setSelectedImage(bike.image)}
                aria-label={`${bike.title} preview image`}
              >
                <img src={bike.image} alt={`${bike.title} preview`} />
              </button>

              {bike.gallery.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  className={`bike-modal__thumb ${selectedImage === image ? "is-active" : ""}`}
                  onClick={() => setSelectedImage(image)}
                  aria-label={`${bike.title} detail image ${index + 1}`}
                >
                  <img src={image} alt={`${bike.title} detail ${index + 1}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="bike-modal__content">
            <span className="bike-modal__eyebrow">Verfügbares Rad</span>
            <h3>{bike.title}</h3>
            <p className="bike-modal__description">{bike.description}</p>

            <div className="bike-modal__pricing">
              <span>Preis pro Tag</span>
              <strong>{bike.price}</strong>
            </div>

            <div className="bike-modal__chiprow">
              <span className="bike-modal__chip">
                <Ruler size={16} />
                {bike.subtitle}
              </span>
              <span className="bike-modal__chip">
                <ShieldCheck size={16} />
                Geprüft & gepflegt
              </span>
              <span className="bike-modal__chip">
                <Weight size={16} />
                Leichtes Setup
              </span>
            </div>

            <div className="bike-modal__section">
              <h4>Wichtige Daten</h4>
              <div className="bike-modal__facts">
                {bike.facts.map((fact) => (
                  <div key={fact.label} className="bike-modal__fact">
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="bike-modal__section">
              <h4>Ausrüstung</h4>
              <ul className="bike-modal__equipment">
                {bike.equipment.map((item) => (
                  <li key={item}>
                    <Wrench size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeBike, setActiveBike] = useState<PortfolioItem | null>(null);

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

  useEffect(() => {
    document.body.classList.toggle("modal-open", Boolean(activeBike));
    return () => document.body.classList.remove("modal-open");
  }, [activeBike]);

  const handleContactSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const subject = encodeURIComponent(`Bike-Anfrage${name ? ` von ${name}` : ""}`);
    const body = encodeURIComponent([name ? `Name: ${name}` : "", email ? `E-Mail: ${email}` : "", "", message].filter(Boolean).join("\n"));

    window.location.href = `mailto:hallo@munich-bike-rental.de?subject=${subject}&body=${body}`;
  };

  return (
    <main className="site-shell">
      <header className={`topbar ${scrolled ? "is-scrolled" : ""}`}>
        <div className="container topbar__inner">
          <a className="brand" href="#home" aria-label="Munich Rental home">
            <span className="brand__text">Munich Rental</span>
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
              <button
                key={item.title}
                className="portfolio-card"
                type="button"
                aria-haspopup="dialog"
                onClick={() => setActiveBike(item)}
              >
                <div className="portfolio-card__media">
                  <img src="/assets/img/portfolio/410-460.jpg" alt="" className="portfolio-card__ratio" />
                  <div
                    className="portfolio-card__image"
                    style={{ backgroundImage: `url(${item.image})` }}
                    aria-hidden="true"
                  />
                </div>

                <div className="portfolio-card__overlay" aria-hidden="true">
                  <p>{item.description}</p>
                </div>
                <img src="/assets/img/svg/right-arrow.svg" alt="" className="portfolio-card__arrow" />

                <div className="portfolio-card__details">
                  <h3>{item.title}</h3>
                  <div className="portfolio-card__meta">
                    <span>{item.subtitle}</span>
                    <span>{item.price}</span>
                  </div>
                </div>
              </button>
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

      <section id="faq" className="section section--faq">
        <div className="container faq-grid">
          <div className="faq-grid__copy">
            <SectionHeading eyebrow="FAQ" title="Häufige Fragen" />
            <p className="section-copy">
              Die wichtigsten Punkte zur Anfrage, Abholung und Absicherung haben wir hier gesammelt.
            </p>
          </div>

          <div className="faq-grid__list">
            {faqItems.map((item) => (
              <details key={item.question} className="faq-item">
                <summary>
                  <span>{item.question}</span>
                  <span className="faq-item__icon" aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
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

          <form className="contact-form" onSubmit={handleContactSubmit}>
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
          <p>Copyright © Munich Rental. Alle Rechte vorbehalten.</p>

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

      {activeBike ? <BikeModal bike={activeBike} onClose={() => setActiveBike(null)} /> : null}
    </main>
  );
}
