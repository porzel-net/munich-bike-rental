import type { StaticImageData } from "next/image";
import {
  Bike,
  CalendarClock,
  CalendarRange,
  GraduationCap,
  Package,
  type LucideIcon,
} from "lucide-react";

import aeroadPreview from "../public/bikes/aeroad-cf-sl-8-disc/preview.png";
import aeroadReal1 from "../public/bikes/aeroad-cf-sl-8-disc/real1.png";
import aeroadReal2 from "../public/bikes/aeroad-cf-sl-8-disc/real2.png";
import aeroadReal3 from "../public/bikes/aeroad-cf-sl-8-disc/real3.png";
import aeroadReal4 from "../public/bikes/aeroad-cf-sl-8-disc/real4.png";
import enduracePreview from "../public/bikes/endurace-cf-sl-8-di2/preview.png";
import enduraceReal1 from "../public/bikes/endurace-cf-sl-8-di2/real1.png";
import enduraceReal2 from "../public/bikes/endurace-cf-sl-8-di2/real2.png";
import ultimatePreview from "../public/bikes/ultimate-cf-sl-7eTap-axs/preview.png";
import ultimateReal1 from "../public/bikes/ultimate-cf-sl-7eTap-axs/real1.png";
import ultimateReal2 from "../public/bikes/ultimate-cf-sl-7eTap-axs/real2.png";
import ultimateReal3 from "../public/bikes/ultimate-cf-sl-7eTap-axs/real3.png";

export type Locale = "de" | "en";

export type LocalizedText = Record<Locale, string>;

export type FormValidationText = {
  contactHint: string;
  nameRequired: string;
  contactRequired: string;
  contactInvalid: string;
  heightRequired: string;
  heightInvalid: string;
  bikeSizeRequired: string;
  periodFromRequired: string;
  periodToRequired: string;
  periodInvalid: string;
  messageRequired: string;
  privacyRequired: string;
  submitFailed: string;
  submitOriginError: string;
  submitConfigError: string;
  submitPayloadError: string;
  submitValidationError: string;
};

export type PortfolioItem = {
  title: string;
  subtitle: LocalizedText;
  price: LocalizedText;
  description: LocalizedText;
  image: string | StaticImageData;
  gallery: Array<string | StaticImageData>;
  facts: Array<{
    label: LocalizedText;
    value: LocalizedText;
  }>;
  equipment: Record<Locale, string[]>;
};

export type ServiceItem = {
  title: string;
  text: LocalizedText;
};

export type PriceItem = {
  title: LocalizedText;
  cost: LocalizedText;
  icon: LucideIcon;
};

export const footerLinks = [
  { href: "/", label: "Startseite" },
  { href: "/blog", label: "Blog" },
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutzerklaerung", label: "Datenschutzerklärung" },
];

export const services: ServiceItem[] = [
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
      de: "Wir sind ein persönlicher Rennradverleih in München und verleihen ausschließlich unsere eigenen Rennräder, damit jedes Rad sofort startklar ist.",
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
      de: "Perfekt gepflegte Rennräder, Zuverlässigkeit und ehrlicher persönlicher Kontakt statt anonymer Massenverleih.",
      en: "Perfectly maintained bikes, reliability and honest personal contact instead of anonymous mass rental.",
    },
  },
];

export const portfolioItems: PortfolioItem[] = [
  {
    title: "Endurace CF SL 8 Di2",
    subtitle: { de: "S / M / L", en: "S / M / L" },
    price: { de: "59€/Tag", en: "59€/day" },
    description: {
      de: "Ausgewogenes Rennrad für schnelle, lange Touren und entspannte Ausfahrten mit viel Komfort.",
      en: "Balanced road bike for fast, long rides and relaxed outings with plenty of comfort.",
    },
    image: enduracePreview,
    gallery: [enduraceReal1, enduraceReal2],
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
    title: "Canyon Grail CF SL 7",
    subtitle: { de: "S / M / L", en: "S / M / L" },
    price: { de: "59€/Tag", en: "59€/day" },
    description: {
      de: "Carbon-Gravelbike mit Shimano-Schaltung und hydraulischen Scheibenbremsen für gemischte Strecken und längere Ausfahrten.",
      en: "Carbon gravel bike with Shimano shifting and hydraulic disc brakes for mixed routes and longer rides.",
    },
    image: "/bikes/canyon-grail-cf-sl-7/preview.webp",
    gallery: ["/bikes/canyon-grail-cf-sl-7/real1.avif"],
    facts: [
      {
        label: { de: "Rahmen", en: "Frame" },
        value: { de: "Carbon", en: "Carbon" },
      },
      {
        label: { de: "Schaltung", en: "Groupset" },
        value: { de: "GRX 800", en: "GRX 800" },
      },
      {
        label: { de: "Bremsen", en: "Brakes" },
        value: { de: "Shimano GRX 600 hydraulische Scheibe", en: "Shimano GRX 600 hydraulic disc brake" },
      },
      {
        label: { de: "Laufräder", en: "Wheels" },
        value: { de: "DT Swiss GR1600 Spline", en: "DT Swiss GR1600 Spline" },
      },
    ],
    equipment: {
      de: ["Schwalbe Gravel Faltreifen G-One R Evo", "Gravel-taugliches Setup", "Frisches Hinterrad", "S / M / L verfügbar"],
      en: ["Schwalbe G-One R Evo folding gravel tires", "Gravel-ready setup", "Fresh rear wheel", "Available in S / M / L"],
    },
  },
  {
    title: "Ultimate CF SL 7 eTap AXS",
    subtitle: { de: "M / L", en: "M / L" },
    price: { de: "59€/Tag", en: "59€/day" },
    description: {
      de: "Leichtes Allround-Rad für sportliche Ausfahrten, Training und flotte Touren in der Stadt.",
      en: "Light all-round bike for sporty rides, training and quick city trips.",
    },
    image: ultimatePreview,
    gallery: [ultimateReal1, ultimateReal2, ultimateReal3],
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
    price: { de: "79€/Tag", en: "79€/day" },
    description: {
      de: "Aero-Bike für maximale Geschwindigkeit auf der Straße und ein direktes, sportliches Fahrgefühl.",
      en: "Aero bike for maximum speed on the road and a direct, sporty ride feel.",
    },
    image: aeroadPreview,
    gallery: [aeroadReal1, aeroadReal2, aeroadReal3, aeroadReal4],
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

export const priceItems: PriceItem[] = [
  {
    title: { de: "Rennräder", en: "Road bikes" },
    cost: { de: "ab 59€", en: "from 59€" },
    icon: Bike,
  },
  {
    title: { de: "Mo-Do Rabatt", en: "Mon-Thu discount" },
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
    cost: { de: "10%", en: "10%" },
    icon: GraduationCap,
  },
  {
    title: { de: "Zubehör", en: "Accessories" },
    cost: { de: "ab 5€", en: "from 5€" },
    icon: Package,
  },
];

export const contactItems = [
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
    label: { de: "Anrufen: +49 152 51330962", en: "Call: +49 152 51330962" },
    icon: "/assets/img/svg/phone.svg",
    href: "tel:+4915251330962",
  },
];

export const faqItems = [
  {
    question: {
      de: "Wie läuft die Anfrage und Miete ab?",
      en: "How does the inquiry and rental process work?",
    },
    answer: {
      de: "Alle Fahrräder können online über das Kontaktfeld angefragt und gemietet werden. Wir klären anschließend alles direkt per E-Mail oder WhatsApp und melden uns immer innerhalb von 24 Stunden, damit am Ende Preis, Zeitraum und Abholung sauber passen.",
      en: "All bikes can be requested and rented online via the contact form. We then sort out everything directly by email or WhatsApp and always reply within 24 hours so that price, rental period and pickup fit perfectly in the end.",
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
  {
    question: {
      de: "Kann ich ein Rad auch für Wettkämpfe mieten?",
      en: "Can I rent a bike for competitions?",
    },
    answer: {
      de: "Nein, eine Miete für Wettkämpfe ist nicht möglich, weil unsere Versicherung Einsätze bei Rennen und Wettbewerben nicht abdeckt.",
      en: "No, we cannot rent bikes for competitions, because our insurance does not cover race or competition use.",
    },
  },
];

export const translations = {
  de: {
    nav: {
      start: "Start",
      bikes: "Räder",
      prices: "Preise",
      faq: "FAQ",
      contact: "Kontakt",
      blog: "Blog",
      imprint: "Impressum",
      privacy: "Datenschutz",
    },
    languageToggle: "EN",
    menuButton: "Menü öffnen",
    location: "München - Maxvorstadt",
    hero: {
      title: "Rennradverleih in München",
      intro:
        "Wir sind ein persönlicher Rennrad- und Gravelbike-Verleih in München-Maxvorstadt und verleihen gepflegte Rennräder, Carbon-Rennräder, Gravelbikes und sportliche Straßenräder für Training, Wochenendausfahrten und längere Touren. Statt Massenverleih bekommst du bei uns direkten Kontakt, ehrliche Beratung und klare Tarife.",
      scroll: "Zu den Rädern scrollen",
      stats: [
        { value: "2", top: "Inhaber", bottom: "mit Bike-Leidenschaft" },
        { value: "Perfekt", top: "gepflegte", bottom: "Räder" },
      ],
    },
    portfolio: { eyebrow: "Unsere Bikes", title: "Verfügbare Räder" },
    pricePromise: {
      eyebrow: "Preisversprechen",
      title: "Findest du es günstiger, ziehen wir mit.",
      quote:
        "Findest du in München ein vergleichbares Rennrad mit ähnlicher Ausstattung günstiger, bekommst du bei uns den besseren Preis.",
      note: "Vergleichbar heißt: gleiche Klasse, ähnliche Ausstattung und gleicher Mietzeitraum.",
      badge: "Preis anfragen",
    },
    blogSection: {
      eyebrow: "Blog",
      title: "UNSERE KLEINEN BEITRÄGE",
      intro: "Kurze, praktische Einblicke rund um Rennrad, Passform und Touren in und um München.",
      cta: "Beitrag lesen",
      archive: "Alle Beiträge",
    },
    about: { eyebrow: "Über uns", title: "Was uns ausmacht" },
    price: {
      eyebrow: "Preise",
      title: "Miete & Tarife",
      intro: "Klare Preise für deinen Rennradverleih in München, dazu Mo-Do-Rabatt und Zubehör für deine Tour. Erhalte insgesamt bis zu 25% Rabatt pro Tag!",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Häufige Fragen",
      intro: "Die wichtigsten Punkte zum Rennradverleih, zur Anfrage, Abholung und Absicherung haben wir hier gesammelt.",
    },
    contact: {
      eyebrow: "Kontakt",
      title: "Kontakt aufnehmen",
      intro:
        "Schreib uns einfach über das Kontaktfeld, wenn du ein Rad reservieren möchtest. Der Erstkontakt läuft über das Formular. Je nachdem, was du angibst, melden wir uns danach per WhatsApp oder E-Mail - immer innerhalb von 24 Stunden.",
    },
    locationSection: {
      eyebrow: "Standort",
      title: "So findest du uns",
      intro:
        "Die Abholung und Rückgabe für deinen Rennradverleih findet vor Ort in der Maxvorstadt statt. Unterhalb findest du eine Ansicht des Standorts und direkt darunter die genaue Adresse.",
      addressLabel: "Adresse",
      address: "Gabelsbergerstraße 79a, 80333 München, Maxvorstadt",
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
      height: "Körpergröße in cm",
      bikeSize: "Rennradgröße",
      bikeSizeOptions: {
        s: "S",
        m: "M",
        l: "L",
      },
      periodFrom: "Zeitraum von",
      periodTo: "bis",
      periodHint: "Bitte wähle den Zeitraum, in dem du das Rad buchen möchtest.",
      message: "Worum geht es?",
      messageHint:
        "Tipp: Du kannst auch oben bei einem Bike auf Reservieren klicken. Dann wird hier automatisch ein Vorschlag mit dem Bike-Namen eingefügt.",
      privacy: "Ich akzeptiere die Datenschutzbestimmungen.",
      submit: "Anfrage senden",
      subject: "Fahrradanfrage",
      sending: "Senden...",
      success: "Danke, deine Anfrage wurde gesendet. Wir melden uns innerhalb von 24 Stunden per E-Mail oder WhatsApp.",
      error: "Die Nachricht konnte nicht gesendet werden. Bitte versuche es noch einmal.",
      validation: {
        contactHint: "Format: name@domain.de oder +49 152 12345678",
        nameRequired: "Bitte gib deinen Namen an.",
        contactRequired: "Bitte gib eine E-Mail-Adresse oder WhatsApp-Nummer an.",
        contactInvalid: "Bitte nutze ein gültiges Format, zum Beispiel name@domain.de oder +49 152 12345678.",
        heightRequired: "Bitte gib deine Körpergröße an.",
        heightInvalid: "Bitte gib eine Zahl zwischen 100 und 250 cm an.",
        bikeSizeRequired: "Bitte wähle deine Rennradgröße aus.",
        periodFromRequired: "Bitte wähle den Start des Zeitraums.",
        periodToRequired: "Bitte wähle das Ende des Zeitraums.",
        periodInvalid: "Das Ende des Zeitraums muss nach dem Start liegen.",
        messageRequired: "Bitte schreibe eine kurze Nachricht.",
        privacyRequired: "Bitte akzeptiere die Datenschutzbestimmungen.",
        submitFailed: "Die Anfrage konnte nicht gesendet werden. Bitte prüfe die Eingaben und versuche es erneut.",
        submitOriginError: "Die Anfrage konnte nicht gesendet werden, weil der Aufruf als ungültig erkannt wurde.",
        submitConfigError: "Das Formular ist derzeit nicht korrekt eingerichtet. Bitte versuche es später noch einmal.",
        submitPayloadError: "Die Nachricht ist zu lang. Bitte kürze sie etwas und versuche es erneut.",
        submitValidationError: "Bitte prüfe die markierten Felder und versuche es erneut.",
      },
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
      blog: "Blog",
      imprint: "Imprint",
      privacy: "Privacy",
    },
    languageToggle: "DE",
    menuButton: "Open menu",
    location: "Munich - Maxvorstadt",
    hero: {
      title: "Road bike rental in Munich",
      intro:
        "We are a personal road and gravel bike rental in Munich-Maxvorstadt and rent out well-maintained road bikes, carbon road bikes, gravel bikes and sporty bikes for training, weekend rides and longer tours. Instead of a mass rental, you get direct contact, honest advice and clear pricing.",
      scroll: "Scroll to the bikes",
      stats: [
        { value: "2", top: "Owners", bottom: "with bike passion" },
        { value: "Perfectly", top: "maintained", bottom: "bikes" },
      ],
    },
    portfolio: { eyebrow: "Our bikes", title: "Available bikes" },
    pricePromise: {
      eyebrow: "Price promise",
      title: "Find it cheaper and we will match it.",
      quote:
        "If you find a comparable road bike in Munich with similar equipment for less somewhere else, you get the better price with us.",
      note: "Comparable means: same class, similar equipment and the same rental period.",
      badge: "Ask for the price",
    },
    blogSection: {
      eyebrow: "Blog",
      title: "OUR SMALL POSTS",
      intro: "Short, practical insights about road bikes, fit and routes in and around Munich.",
      cta: "Read post",
      archive: "All posts",
    },
    about: { eyebrow: "About us", title: "What makes us special" },
    price: {
      eyebrow: "Prices",
      title: "Rental & rates",
      intro: "Clear prices for your road bike rental in Munich, plus Mon-Thu discounts and accessories for your ride. Get up to 25% off per day!",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Frequently asked questions",
      intro: "Here we've gathered the most important points about road bike rental, inquiries, pickup and coverage.",
    },
    contact: {
      eyebrow: "Contact",
      title: "Get in touch",
      intro:
        "Just write to us via the contact form if you want to reserve a bike. The first contact happens through the form. Depending on what you provide, we'll get back to you by WhatsApp or email - always within 24 hours.",
    },
    locationSection: {
      eyebrow: "Location",
      title: "How to find us",
      intro:
        "Pickup and return for your road bike rental take place on site in Maxvorstadt. Below you'll find a visual location image and directly beneath it the exact address.",
      addressLabel: "Address",
      address: "Gabelsbergerstraße 79a, 80333 Munich, Maxvorstadt",
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
      height: "Height in cm",
      bikeSize: "Road bike size",
      bikeSizeOptions: {
        s: "S",
        m: "M",
        l: "L",
      },
      periodFrom: "Rental period from",
      periodTo: "to",
      periodHint: "Please choose the period in which you want to book the bike.",
      message: "What is it about?",
      messageHint:
        "Tip: You can also click Reserve on a bike above. That will automatically insert a message draft with the bike name here.",
      privacy: "I accept the privacy policy.",
      submit: "Send inquiry",
      subject: "Bike inquiry",
      sending: "Sending...",
      success: "Thanks, your inquiry has been sent. We will reply within 24 hours by email or WhatsApp.",
      error: "The message could not be sent. Please try again.",
      validation: {
        contactHint: "Format: name@domain.com or +49 152 12345678",
        nameRequired: "Please enter your name.",
        contactRequired: "Please enter an email address or WhatsApp number.",
        contactInvalid: "Please use a valid format, for example name@domain.com or +49 152 12345678.",
        heightRequired: "Please enter your height.",
        heightInvalid: "Please enter a number between 100 and 250 cm.",
        bikeSizeRequired: "Please choose your road bike size.",
        periodFromRequired: "Please choose the start of the rental period.",
        periodToRequired: "Please choose the end of the rental period.",
        periodInvalid: "The end of the rental period must be after the start.",
        messageRequired: "Please write a short message.",
        privacyRequired: "Please accept the privacy policy.",
        submitFailed: "The request could not be sent. Please check the fields and try again.",
        submitOriginError: "The request could not be sent because the call was marked as invalid.",
        submitConfigError: "The form is not configured correctly right now. Please try again later.",
        submitPayloadError: "The message is too long. Please shorten it and try again.",
        submitValidationError: "Please check the highlighted fields and try again.",
      },
    },
    footer: "Copyright © Munich Rental. All rights reserved.",
  },
} as const;

export function resolveLocale(input?: string | string[]): Locale {
  const value = Array.isArray(input) ? input[0] : input;
  return value === "en" ? "en" : "de";
}

export function createReservationMessage(lang: Locale, bikeTitle: string) {
  if (lang === "de") {
    return `Hallo Munich Rental,\n\nich würde gerne das Bike "${bikeTitle}" reservieren.\n\nIch freue mich über eine kurze Rückmeldung zu Verfügbarkeit und Abholung.\n\nViele Grüße`;
  }

  return `Hello Munich Rental,\n\nI would like to reserve the "${bikeTitle}" bike.\n\nPlease let me know about availability and pickup.\n\nBest regards`;
}
