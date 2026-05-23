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

type Locale = "de" | "en";

type LocalizedText = Record<Locale, string>;

type PortfolioItem = {
  title: string;
  subtitle: LocalizedText;
  price: LocalizedText;
  description: LocalizedText;
  image: string;
  gallery: string[];
  facts: Array<{
    label: LocalizedText;
    value: LocalizedText;
  }>;
  equipment: Record<Locale, string[]>;
};

type ServiceItem = {
  title: string;
  text: LocalizedText;
};

type PriceItem = {
  title: LocalizedText;
  cost: LocalizedText;
  icon: LucideIcon;
};

type ContactStatus = "idle" | "sending" | "success" | "error";

const services: ServiceItem[] = [
  {
    title: "Wer wir sind",
    text: {
      de: "Wir sind Julius und Justus, beide 20 Jahre alt, und stecken unsere ganze Fahrradleidenschaft in den Verleih.",
      en: "We are Julius and Justus, both 20 years old, and we put all our cycling passion into the rental.",
    },
  },
  {
    title: "Was wir machen",
    text: {
      de: "Wir verleihen ausschließlich unsere eigenen Fahrräder in München und sorgen dafür, dass jedes Rad sofort startklar ist.",
      en: "We rent out only our own bikes in Munich and make sure every bike is ready to go right away.",
    },
  },
  {
    title: "Warum wir",
    text: {
      de: "Weil man lieber zu uns Studenten geht, die sich aus Leidenschaft um die Fahrräder kümmern, statt ein Bike bei einem großen Konzern zu mieten.",
      en: "Because it feels better to rent from two students who care for the bikes with real passion instead of going to a large corporation.",
    },
  },
  {
    title: "Wofür wir stehen",
    text: {
      de: "Perfekt gepflegte Räder, Zuverlässigkeit und ehrlicher persönlicher Kontakt statt anonymer Massenverleih.",
      en: "Perfectly maintained bikes, reliability and honest personal contact instead of anonymous mass rental.",
    },
  },
];

const portfolioItems: PortfolioItem[] = [
  {
    title: "Endurance CF SL 8 Di2",
    subtitle: { de: "S / M / L", en: "S / M / L" },
    price: { de: "39€/Tag", en: "39€/day" },
    description: {
      de: "Ausgewogenes Rennrad für schnelle, lange Touren und entspannte Ausfahrten mit viel Komfort.",
      en: "Balanced road bike for fast, long rides and relaxed outings with plenty of comfort.",
    },
    image: "/bikes/endurance-cf-sl-8-di2/preview.png",
    gallery: [
      "/bikes/endurance-cf-sl-8-di2/real1.png",
      "/bikes/endurance-cf-sl-8-di2/real2.png",
    ],
    facts: [
      {
        label: { de: "Schaltung", en: "Groupset" },
        value: { de: "Shimano Ultegra Di2", en: "Shimano Ultegra Di2" },
      },
      {
        label: { de: "Bremsen", en: "Brakes" },
        value: { de: "Hydraulische Scheibenbremsen", en: "Hydraulic disc brakes" },
      },
      {
        label: { de: "Laufräder", en: "Wheels" },
        value: { de: "DT Swiss Laufräder", en: "DT Swiss wheels" },
      },
    ],
    equipment: {
      de: ["Elektronische Schaltung", "Sportliche Sitzposition", "Direktes Handling", "Pannensichere Bereifung"],
      en: ["Electronic shifting", "Sporty riding position", "Direct handling", "Puncture-resistant tires"],
    },
  },
  {
    title: "Ultimate CF SL 7 eTap AXS",
    subtitle: { de: "M / L", en: "M / L" },
    price: { de: "45€/Tag", en: "45€/day" },
    description: {
      de: "Leichtes Allround-Rad für sportliche Ausfahrten, Training und flotte Touren in der Stadt.",
      en: "Light all-round bike for sporty rides, training and quick city trips.",
    },
    image: "/bikes/ultimate-cf-sl-7eTap-axs/preview.png",
    gallery: [
      "/bikes/ultimate-cf-sl-7eTap-axs/real1.png",
      "/bikes/ultimate-cf-sl-7eTap-axs/real2.png",
      "/bikes/ultimate-cf-sl-7eTap-axs/real3.png",
    ],
    facts: [
      {
        label: { de: "Rahmen", en: "Frame" },
        value: { de: "Carbonrahmen", en: "Carbon frame" },
      },
      {
        label: { de: "Schaltung", en: "Groupset" },
        value: { de: "SRAM Rival eTap AXS 2x12", en: "SRAM Rival eTap AXS 2x12 electronic shifting" },
      },
      {
        label: { de: "Bremsen", en: "Brakes" },
        value: { de: "Hydraulische Scheibenbremsen", en: "Hydraulic disc brakes" },
      },
      {
        label: { de: "Laufräder", en: "Wheels" },
        value: { de: "DT Swiss Laufräder", en: "DT Swiss wheels" },
      },
    ],
    equipment: {
      de: ["Elektronische Schaltung", "Tubeless-ready", "Leichte Bauweise", "Sportliche Geometrie"],
      en: ["Electronic shifting", "Tubeless-ready", "Lightweight build", "Sporty geometry"],
    },
  },
  {
    title: "Aeroad CF SL 8 Disc",
    subtitle: { de: "S / M", en: "S / M" },
    price: { de: "80€/Tag", en: "80€/day" },
    description: {
      de: "Aero-Bike für maximale Geschwindigkeit auf der Straße und ein direktes, sportliches Fahrgefühl.",
      en: "Aero bike for maximum speed on the road and a direct, sporty ride feel.",
    },
    image: "/bikes/aeroad-cf-sl-8-disc/preview.png",
    gallery: [
      "/bikes/aeroad-cf-sl-8-disc/real1.png",
      "/bikes/aeroad-cf-sl-8-disc/real2.png",
      "/bikes/aeroad-cf-sl-8-disc/real3.png",
      "/bikes/aeroad-cf-sl-8-disc/real4.png",
    ],
    facts: [
      {
        label: { de: "Antrieb", en: "Drivetrain" },
        value: { de: "Shimano Ultegra R8000 2x11", en: "Shimano Ultegra R8000 2x11" },
      },
      {
        label: { de: "Kassette", en: "Cassette" },
        value: { de: "11-34, neuwertig", en: "11-34, like new" },
      },
      {
        label: { de: "Schaltwerk", en: "Rear derailleur" },
        value: { de: "Shimano Ultegra Longcage", en: "Shimano Ultegra long cage" },
      },
      {
        label: { de: "Laufräder", en: "Wheels" },
        value: { de: "DT Swiss ARC 1600, 62 / 50 mm", en: "DT Swiss ARC 1600, 62 / 50 mm" },
      },
    ],
    equipment: {
      de: ["Continental Grand Prix S TR 28 mm", "Tanwall-Reifen", "Bergtaugliche Übersetzung", "Aero-orientiertes Setup"],
      en: ["Continental Grand Prix S TR 28 mm", "Tanwall tires", "Climb-friendly gearing", "Aero-oriented setup"],
    },
  },
];

const priceItems: PriceItem[] = [
  {
    title: { de: "Rennräder", en: "Road bikes" },
    cost: { de: "ab 39€", en: "from 39€" },
    icon: Bike,
  },
  {
    title: { de: "Wochenenderabatt", en: "Weekend discount" },
    cost: { de: "10%", en: "10%" },
    icon: CalendarRange,
  },
  {
    title: { de: "Ab 3 Tagen", en: "From 3 days" },
    cost: { de: "20%", en: "20%" },
    icon: CalendarClock,
  },
  {
    title: { de: "Studentenrabatt", en: "Student discount" },
    cost: { de: "20%", en: "20%" },
    icon: GraduationCap,
  },
  {
    title: { de: "Zubehör", en: "Accessories" },
    cost: { de: "ab 5€", en: "from 5€" },
    icon: Package,
  },
];

const contactItems = [
  {
    label: { de: "Reservierung per Nachricht", en: "Reserve by message" },
    icon: "/assets/img/svg/placeholder.svg",
  },
  {
    label: { de: "hallo@munich-bike-rental.de", en: "hallo@munich-bike-rental.de" },
    icon: "/assets/img/svg/mail.svg",
    href: "mailto:hallo@munich-bike-rental.de",
  },
  {
    label: { de: "WhatsApp: +49 152 51330962", en: "WhatsApp: +49 152 51330962" },
    icon: "/assets/img/svg/phone.svg",
    href: "https://wa.me/4915251330962",
  },
  {
    label: { de: "Anrufen: +49 152 51330962", en: "Call: +49 152 51330962" },
    icon: "/assets/img/svg/mail.svg",
    href: "tel:+4915251330962",
  },
];

const faqItems = [
  {
    question: {
      de: "Wie läuft die Anfrage und Miete ab?",
      en: "How does the inquiry and rental process work?",
    },
    answer: {
      de: "Alle Fahrräder können online angefragt und gemietet werden. Wir klären anschließend alles per E-Mail, WhatsApp oder Telefon, damit am Ende Preis, Zeitraum und Abholung sauber passen.",
      en: "All bikes can be requested and rented online. We then sort out everything via email, WhatsApp or phone so that price, rental period and pickup fit perfectly in the end.",
    },
  },
  {
    question: {
      de: "Wo werden die Fahrräder abgeholt?",
      en: "Where do I pick up the bikes?",
    },
    answer: {
      de: "Die Abholung findet vor Ort in München-Maxvorstadt statt. Den genauen Ablauf stimmen wir nach der Anfrage per E-Mail mit dir ab.",
      en: "Pickup takes place on site in Munich-Maxvorstadt. We will coordinate the exact process with you by email after the inquiry.",
    },
  },
  {
    question: {
      de: "Sind die Fahrräder versichert?",
      en: "Are the bikes insured?",
    },
    answer: {
      de: "Ja, alle Fahrräder sind über eine gewerbliche Versicherung abgesichert. Die Versicherung umfasst Diebstahl, Schäden und Zerstörung.",
      en: "Yes, all bikes are covered by commercial insurance. The coverage includes theft, damage and destruction.",
    },
  },
  {
    question: {
      de: "Was passiert, wenn etwas beschädigt wird?",
      en: "What happens if something gets damaged?",
    },
    answer: {
      de: "Auch in diesem Fall bist du nicht allein. Wir arbeiten mit einer gewerblichen Versicherung, damit Diebstahl, Schäden und Zerstörung abgesichert sind und wir gemeinsam eine saubere Lösung haben.",
      en: "Even in that case you're not on your own. We work with commercial insurance so that theft, damage and destruction are covered and we can sort out a clean solution together.",
    },
  },
];

const translations = {
  de: {
    nav: {
      start: "Start",
      bikes: "Räder",
      prices: "Preise",
      faq: "FAQ",
      contact: "Kontakt",
    },
    languageToggle: "EN",
    menuButton: "Menü öffnen",
    location: "München - Maxvorstadt",
    hero: {
      title: "Fahrradverleih aus Leidenschaft",
      intro:
        "Wir sind zwei junge Burschen aus München, die schon immer von einem eigenen Fahrradverleih geträumt haben. Weil wir selbst begeisterte Fahrer sind, kümmern wir uns mit viel Herz um unsere Bikes und verleihen ausschließlich unsere eigenen Räder.",
      scroll: "Zu den Rädern scrollen",
      stats: [
        { value: "2", top: "Inhaber", bottom: "mit Bike-Leidenschaft" },
        { value: "Perfekt", top: "gepflegte", bottom: "Räder" },
      ],
    },
    portfolio: { eyebrow: "Unsere Bikes", title: "Verfügbare Räder" },
    about: { eyebrow: "Über uns", title: "Was uns ausmacht" },
    price: {
      eyebrow: "Preise",
      title: "Miete & Tarife",
      intro: "Klare Preise, unkomplizierte Rabatte und Zubehör für deine Tour.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Häufige Fragen",
      intro: "Die wichtigsten Punkte zur Anfrage, Abholung und Absicherung haben wir hier gesammelt.",
    },
    contact: {
      eyebrow: "Kontakt",
      title: "Kontakt aufnehmen",
      intro:
        "Schreib uns einfach, wenn du ein Rad reservieren möchtest. Du kannst uns direkt per Nachricht anschreiben, über WhatsApp unter +49 152 51330962 kontaktieren oder uns einfach anrufen.",
    },
    modal: {
      bike: "Verfügbares Rad",
      pricePerDay: "Preis pro Tag",
      facts: "Wichtige Daten",
      equipment: "Ausrüstung",
      reserve: "Reservieren",
      checked: "Geprüft & gepflegt",
      setup: "Leichtes Setup",
      close: "Details schließen",
      preview: "Vorschaubild",
      detailImage: "Detailbild",
    },
    form: {
      name: "Name",
      contact: "E-Mail oder WhatsApp-Nummer",
      periodFrom: "Zeitraum von",
      periodTo: "bis",
      periodHint: "Bitte wähle den Zeitraum, in dem du das Rad buchen möchtest.",
      message: "Worum geht es?",
      privacy: "Ich akzeptiere die Datenschutzbestimmungen.",
      submit: "Anfrage senden",
      subject: "Fahrradanfrage",
      sending: "Senden...",
      success: "Danke, deine Anfrage wurde gesendet. Wir melden uns per E-Mail.",
      error: "Die Nachricht konnte nicht gesendet werden. Bitte versuche es noch einmal.",
    },
    footer: "Copyright © Munich Rental. Alle Rechte vorbehalten.",
  },
  en: {
    nav: {
      start: "Start",
      bikes: "Bikes",
      prices: "Prices",
      faq: "FAQ",
      contact: "Contact",
    },
    languageToggle: "DE",
    menuButton: "Open menu",
    location: "Munich - Maxvorstadt",
    hero: {
      title: "Bike rental with passion",
      intro:
        "We are two young guys from Munich who have always dreamed of running our own bike rental. Since we are passionate riders ourselves, we care for our bikes with a lot of heart and rent out only our own bikes.",
      scroll: "Scroll to the bikes",
      stats: [
        { value: "2", top: "Owners", bottom: "with bike passion" },
        { value: "Perfectly", top: "maintained", bottom: "bikes" },
      ],
    },
    portfolio: { eyebrow: "Our bikes", title: "Available bikes" },
    about: { eyebrow: "About us", title: "What makes us special" },
    price: {
      eyebrow: "Prices",
      title: "Rental & rates",
      intro: "Clear prices, simple discounts and accessories for your ride.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Frequently asked questions",
      intro: "Here we've gathered the most important points about the inquiry, pickup and coverage.",
    },
    contact: {
      eyebrow: "Contact",
      title: "Get in touch",
      intro:
        "Just write to us if you want to reserve a bike. You can contact us directly by message, via WhatsApp at +49 152 51330962 or simply call us.",
    },
    modal: {
      bike: "Available bike",
      pricePerDay: "Price per day",
      facts: "Key details",
      equipment: "Equipment",
      reserve: "Reserve",
      checked: "Checked & maintained",
      setup: "Light setup",
      close: "Close details",
      preview: "Preview image",
      detailImage: "Detail image",
    },
    form: {
      name: "Name",
      contact: "Email or WhatsApp number",
      periodFrom: "Rental period from",
      periodTo: "to",
      periodHint: "Please choose the period in which you want to book the bike.",
      message: "What is it about?",
      privacy: "I accept the privacy policy.",
      submit: "Send inquiry",
      subject: "Bike inquiry",
      sending: "Sending...",
      success: "Thanks, your inquiry has been sent. We will reply by email.",
      error: "The message could not be sent. Please try again.",
    },
    footer: "Copyright © Munich Rental. All rights reserved.",
  },
} as const;

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

function createReservationMessage(lang: Locale, bikeTitle: string) {
  if (lang === "de") {
    return `Hallo Munich Rental,

ich würde gerne das Bike "${bikeTitle}" reservieren.

Ich freue mich über eine kurze Rückmeldung zu Verfügbarkeit und Abholung.

Viele Grüße`;
  }

  return `Hello Munich Rental,

I would like to reserve the "${bikeTitle}" bike.

Please let me know about availability and pickup.

Best regards`;
}

function BikeModal({
  bike,
  onClose,
  onReserve,
  lang,
}: {
  bike: PortfolioItem;
  onClose: () => void;
  onReserve: (bikeTitle: string) => void;
  lang: Locale;
}) {
  const [selectedImage, setSelectedImage] = useState(bike.image);
  const t = translations[lang];

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
        <button type="button" className="bike-modal__close" aria-label={t.modal.close} onClick={onClose}>
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
                aria-label={`${bike.title} ${t.modal.preview}`}
              >
                <img src={bike.image} alt={`${bike.title} preview`} />
              </button>

              {bike.gallery.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  className={`bike-modal__thumb ${selectedImage === image ? "is-active" : ""}`}
                  onClick={() => setSelectedImage(image)}
                  aria-label={`${bike.title} ${t.modal.detailImage} ${index + 1}`}
                >
                  <img src={image} alt={`${bike.title} detail ${index + 1}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="bike-modal__content">
            <span className="bike-modal__eyebrow">{t.modal.bike}</span>
            <h3>{bike.title}</h3>
            <p className="bike-modal__description">{bike.description[lang]}</p>

            <div className="bike-modal__pricing">
              <span>{t.modal.pricePerDay}</span>
              <strong>{bike.price[lang]}</strong>
            </div>

            <button type="button" className="button button--arrow bike-modal__reserve" onClick={() => onReserve(bike.title)}>
              <span>{t.modal.reserve}</span>
              <img src="/assets/img/svg/right-arrow.svg" alt="" />
            </button>

            <div className="bike-modal__chiprow">
              <span className="bike-modal__chip">
                <Ruler size={16} />
                {bike.subtitle[lang]}
              </span>
              <span className="bike-modal__chip">
                <ShieldCheck size={16} />
                {t.modal.checked}
              </span>
              <span className="bike-modal__chip">
                <Weight size={16} />
                {t.modal.setup}
              </span>
            </div>

            <div className="bike-modal__section">
              <h4>{t.modal.facts}</h4>
              <div className="bike-modal__facts">
                {bike.facts.map((fact) => (
                  <div key={fact.label.de} className="bike-modal__fact">
                    <span>{fact.label[lang]}</span>
                    <strong>{fact.value[lang]}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="bike-modal__section">
              <h4>{t.modal.equipment}</h4>
              <ul className="bike-modal__equipment">
                {bike.equipment[lang].map((item) => (
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
  const [lang, setLang] = useState<Locale>("de");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeBike, setActiveBike] = useState<PortfolioItem | null>(null);
  const [contactMessage, setContactMessage] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [pendingReservationBike, setPendingReservationBike] = useState<string | null>(null);
  const [contactStatus, setContactStatus] = useState<ContactStatus>("idle");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const t = translations[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

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

  useEffect(() => {
    if (!pendingReservationBike || activeBike) {
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      const contactSection = document.getElementById("contact");
      contactSection?.scrollIntoView({ behavior: "smooth", block: "start" });

      const periodField = document.getElementById("period-from") as HTMLInputElement | null;
      periodField?.focus({ preventScroll: true });

      setPendingReservationBike(null);
    });

    return () => window.cancelAnimationFrame(raf);
  }, [activeBike, pendingReservationBike]);

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const contact = String(formData.get("contact") ?? "").trim();
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

  const handleBikeReserve = (bikeTitle: string) => {
    setContactMessage(createReservationMessage(lang, bikeTitle));
    setPendingReservationBike(bikeTitle);
    setContactStatus("idle");
    setActiveBike(null);
  };

  return (
    <main className="site-shell">
      <header className={`topbar ${scrolled ? "is-scrolled" : ""}`}>
        <div className="container topbar__inner">
          <a className="brand" href="#home" aria-label="Munich Rental home">
            <span className="brand__text">Munich Rental</span>
          </a>

          <div className="topbar__right">
            <nav className="nav nav--desktop" aria-label="Primary">
              <ul className="nav__list">
                <li className="nav__item">
                  <a href="#home" className="nav__link">
                    {t.nav.start}
                  </a>
                </li>
                <li className="nav__item">
                  <a href="#portfolio" className="nav__link">
                    {t.nav.bikes}
                  </a>
                </li>
                <li className="nav__item">
                  <a href="#price" className="nav__link">
                    {t.nav.prices}
                  </a>
                </li>
                <li className="nav__item">
                  <a href="#faq" className="nav__link">
                    {t.nav.faq}
                  </a>
                </li>
                <li className="nav__item">
                  <a href="#contact" className="nav__link">
                    {t.nav.contact}
                  </a>
                </li>
              </ul>
            </nav>

            <div className="topbar__actions">
              <button
                type="button"
                className="lang-switch"
                aria-label={`Switch language to ${lang === "de" ? "English" : "Deutsch"}`}
                onClick={() => setLang((current) => (current === "de" ? "en" : "de"))}
              >
                {t.languageToggle}
              </button>

              <button
                type="button"
                className={`hamburger ${menuOpen ? "is-active" : ""}`}
                aria-label={t.menuButton}
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
                  {t.nav.start}
                </a>
              </li>
              <li className="nav__item nav__item--mobile">
                <a href="#portfolio" className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                  {t.nav.bikes}
                </a>
              </li>
              <li className="nav__item nav__item--mobile">
                <a href="#price" className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                  {t.nav.prices}
                </a>
              </li>
              <li className="nav__item nav__item--mobile">
                <a href="#faq" className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                  {t.nav.faq}
                </a>
              </li>
              <li className="nav__item nav__item--mobile">
                <a href="#contact" className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                  {t.nav.contact}
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <section id="home" className="hero section">
        <div className="container hero__grid">
          <div className="hero__copy">
            <span className="hero__location">
              <MapPin className="hero__location-icon" aria-hidden="true" />
              <span>{t.location}</span>
            </span>
            <h1 className="hero__title">{t.hero.title}</h1>
            <p className="hero__intro">{t.hero.intro}</p>

            <ul className="hero-stats">
              <li className="hero-stats__item">
                <strong>{t.hero.stats[0].value}</strong>
                <span>
                  {t.hero.stats[0].top}
                  <br />
                  {t.hero.stats[0].bottom}
                </span>
              </li>
              <li className="hero-stats__item">
                <strong>{t.hero.stats[1].value}</strong>
                <span>
                  {t.hero.stats[1].top}
                  <br />
                  {t.hero.stats[1].bottom}
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

          <a className="hero__down" href="#portfolio" aria-label={t.hero.scroll}>
            <img src="/assets/img/svg/down-arrow.svg" alt="" />
          </a>
        </div>
      </section>

      <section id="portfolio" className="section section--portfolio">
        <div className="container">
          <SectionHeading eyebrow={t.portfolio.eyebrow} title={t.portfolio.title} />

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
      </section>

      <section id="about" className="section section--about">
        <div className="container">
          <SectionHeading eyebrow={t.about.eyebrow} title={t.about.title} />

          <ul className="hero-profile hero-profile--section">
            {services.map((service) => (
              <li key={service.title} className="hero-profile__item">
                <span className="hero-profile__label">{service.title}</span>
                <span className="hero-profile__text">{service.text[lang]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="price" className="section section--price">
        <div className="container price-grid">
          <div className="price-grid__copy">
            <SectionHeading eyebrow={t.price.eyebrow} title={t.price.title} />
            <p className="section-copy">{t.price.intro}</p>
          </div>

          <div className="price-grid__list">
            {priceItems.map((item) => (
              <article key={item.title.de} className="price-item">
                <item.icon className="price-item__icon" aria-hidden="true" />
                <div className="price-item__title">{item.title[lang]}</div>
                <div className="price-item__cost">{item.cost[lang]}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="section section--faq">
        <div className="container faq-grid">
          <div className="faq-grid__copy">
            <SectionHeading eyebrow={t.faq.eyebrow} title={t.faq.title} />
            <p className="section-copy">{t.faq.intro}</p>
          </div>

          <div className="faq-grid__list">
            {faqItems.map((item) => (
              <details key={item.question.de} className="faq-item">
                <summary>
                  <span>{item.question[lang]}</span>
                  <span className="faq-item__icon" aria-hidden="true" />
                </summary>
                <p>{item.answer[lang]}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="section section--contact">
        <div className="container contact-grid">
          <div className="contact-grid__copy">
            <SectionHeading eyebrow={t.contact.eyebrow} title={t.contact.title} />
            <p className="section-copy">{t.contact.intro}</p>

            <ul className="contact-list">
              {contactItems.map((item) => (
                <li key={item.label.de} className="contact-list__item">
                  {item.href ? (
                    <a href={item.href} className="contact-list__link">
                      <img src={item.icon} alt="" className="contact-list__icon" />
                      <span>{item.label[lang]}</span>
                    </a>
                  ) : (
                    <>
                      <img src={item.icon} alt="" className="contact-list__icon" />
                      <span>{item.label[lang]}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <form className="contact-form" onSubmit={handleContactSubmit}>
            <div className="contact-form__fields">
              <input id="name" name="name" type="text" placeholder={t.form.name} />
              <input
                id="contact"
                name="contact"
                type="text"
                placeholder={t.form.contact}
                inputMode="text"
              />
            </div>
            <div className="contact-form__period">
              <span className="contact-form__hint">{t.form.periodHint}</span>
              <div className="contact-form__period-fields">
                <div className="contact-form__period-field">
                  <label htmlFor="period-from">{t.form.periodFrom}</label>
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
                  <label htmlFor="period-to">{t.form.periodTo}</label>
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
              placeholder={t.form.message}
              value={contactMessage}
              onChange={(event) => {
                setContactMessage(event.target.value);
                setContactStatus("idle");
              }}
              required
            />

            <label className="contact-form__checkbox">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(event) => {
                  setPrivacyAccepted(event.target.checked);
                  setContactStatus("idle");
                }}
              />
              <span>{t.form.privacy}</span>
            </label>

            <button
              type="submit"
              className="button button--arrow"
              disabled={
                contactStatus === "sending" || !privacyAccepted || !periodFrom || !periodTo
              }
            >
              <span>{contactStatus === "sending" ? t.form.sending : t.form.submit}</span>
              <img src="/assets/img/svg/right-arrow.svg" alt="" />
            </button>

            {contactStatus === "success" ? <p className="contact-form__status is-success">{t.form.success}</p> : null}
            {contactStatus === "error" ? <p className="contact-form__status is-error">{t.form.error}</p> : null}
          </form>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer__inner">
          <p>{t.footer}</p>

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

      {activeBike ? (
        <BikeModal bike={activeBike} lang={lang} onClose={() => setActiveBike(null)} onReserve={handleBikeReserve} />
      ) : null}
    </main>
  );
}
