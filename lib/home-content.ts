import type { StaticImageData } from "next/image";
import { Bike, CalendarClock, GraduationCap, Package, type LucideIcon } from "lucide-react";

const aeroadPreview = "/bikes/aeroad-cf-sl-8-disc/preview.webp";
const aeroadReal1 = "/bikes/aeroad-cf-sl-8-disc/real1.webp";
const aeroadReal2 = "/bikes/aeroad-cf-sl-8-disc/real2.webp";
const aeroadReal3 = "/bikes/aeroad-cf-sl-8-disc/real3.webp";
const aeroadReal4 = "/bikes/aeroad-cf-sl-8-disc/real4.webp";
const enduracePreview = "/bikes/endurace-cf-sl-8-di2/preview.webp";
const enduraceReal1 = "/bikes/endurace-cf-sl-8-di2/real1.webp";
const enduraceReal2 = "/bikes/endurace-cf-sl-8-di2/real2.webp";
const ultimatePreview = "/bikes/ultimate-cf-sl-7eTap-axs/preview.webp";
const ultimateReal1 = "/bikes/ultimate-cf-sl-7eTap-axs/real1.webp";
const ultimateReal2 = "/bikes/ultimate-cf-sl-7eTap-axs/real2.webp";
const ultimateReal3 = "/bikes/ultimate-cf-sl-7eTap-axs/real3.webp";

export type Locale = "de" | "en";

export type LocalizedText = Record<Locale, string>;

export type FormValidationText = {
  contactHint: string;
  locationRequired: string;
  nameRequired: string;
  contactRequired: string;
  contactInvalid: string;
  phoneRequired: string;
  phoneInvalid: string;
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
  agbRequired: string;
  submitFailed: string;
  submitOriginError: string;
  submitConfigError: string;
  submitPayloadError: string;
  submitValidationError: string;
};

export type PortfolioItem = {
  title: string;
  frameNumber?: string | null;
  subtitle: LocalizedText;
  price: LocalizedText;
  discountText?: LocalizedText;
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
  title: LocalizedText;
  text: LocalizedText;
};

export type PriceItem = {
  title: LocalizedText;
  cost: LocalizedText;
  icon: LucideIcon;
};

export const footerLinks = [
  { href: "/de/rennradverleih/münchen/maxvorstadt", label: "Startseite" },
  { href: "/blog", label: "Blog" },
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutzerklaerung", label: "Datenschutzerklärung" },
  { href: "/de/agb", label: "AGB" },
];

export const services: ServiceItem[] = [
  {
    title: { de: "Wer wir sind", en: "Who we are" },
    text: {
      de: "Wir sind Julius und Justus, beide 20 Jahre alt, und stecken unsere ganze Fahrradleidenschaft in den Verleih.",
      en: "We are Julius and Justus, both 20 years old, and we put all our cycling passion into the rental.",
    },
  },
  {
    title: { de: "Was wir machen", en: "What we do" },
    text: {
      de: "Wir sind ein persönlicher Bike-Verleih in München und verleihen ausschließlich unsere eigenen Endurance-, Gravel-, Allround- und Aero-Bikes, damit jedes Rad sofort startklar ist.",
      en: "We rent out only our own endurance, gravel, all-round and aero bikes in Munich and make sure every bike is ready to go right away.",
    },
  },
  {
    title: { de: "Warum wir", en: "Why us" },
    text: {
      de: "Weil man lieber zu uns Studenten geht, die sich aus Leidenschaft um die Fahrräder kümmern, statt ein Bike bei einem großen Konzern zu mieten.",
      en: "Because it feels better to rent from two students who care for the bikes with real passion instead of going to a large corporation.",
    },
  },
  {
    title: { de: "Wofür wir stehen", en: "What we stand for" },
    text: {
      de: "Perfekt gepflegte Rennräder, Zuverlässigkeit und ehrlicher persönlicher Kontakt statt anonymer Massenverleih.",
      en: "Perfectly maintained bikes, reliability and honest personal contact instead of anonymous mass rental.",
    },
  },
];

export const portfolioItems: PortfolioItem[] = [
  {
    title: "Endurace CF SL 8",
    subtitle: { de: "XS / S / M / L", en: "XS / S / M / L" },
    price: { de: "59€/Tag", en: "59€/day" },
    description: {
      de: "Ausgewogenes Endurance-Rennrad für schnelle, lange Touren und entspannte Ausfahrten mit viel Komfort.",
      en: "Balanced endurance road bike for fast, long rides and relaxed outings with plenty of comfort.",
    },
    image: enduracePreview,
    gallery: [enduraceReal1, enduraceReal2],
    facts: [
      {
        label: { de: "Schaltung", en: "Groupset" },
        value: { de: "Ultegra Di2 oder Rival AXS", en: "Ultegra Di2 or Rival AXS" },
      },
      {
        label: { de: "Schaltungsart", en: "Shifting type" },
        value: { de: "Elektronisch", en: "Electronic" },
      },
      {
        label: { de: "Bremsen", en: "Brakes" },
        value: { de: "Hydraulische Scheibenbremsen", en: "Hydraulic disc brakes" },
      },
      {
        label: { de: "Laufräder", en: "Wheels" },
        value: { de: "DT Swiss oder Falcrum", en: "DT Swiss or Falcrum" },
      },
    ],
    equipment: {
      de: ["Elektronische Schaltung", "Sportliche Sitzposition", "Direktes Handling", "Pannensichere Bereifung"],
      en: ["Electronic shifting", "Sporty riding position", "Direct handling", "Puncture-resistant tires"],
    },
  },
  {
    title: "Grail CF SL 7",
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
        label: { de: "Schaltungsart", en: "Shifting type" },
        value: { de: "Elektronisch", en: "Electronic" },
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
      de: [
        "Schwalbe Gravel Faltreifen G-One R Evo",
        "Gravel-taugliches Setup",
        "Frisches Hinterrad",
        "S / M / L verfügbar",
      ],
      en: [
        "Schwalbe G-One R Evo folding gravel tires",
        "Gravel-ready setup",
        "Fresh rear wheel",
        "Available in S / M / L",
      ],
    },
  },
  {
    title: "Ultimate CF SL 7",
    subtitle: { de: "M / L", en: "M / L" },
    price: { de: "59€/Tag", en: "59€/day" },
    description: {
      de: "Leichtes Allround-Rennrad für sportliche Ausfahrten, Training und flotte Touren in der Stadt.",
      en: "Light all-round road bike for sporty rides, training and quick city trips.",
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
        label: { de: "Schaltungsart", en: "Shifting type" },
        value: { de: "Elektronisch", en: "Electronic" },
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
    title: "Aeroad CF SL 8",
    subtitle: { de: "S / M", en: "S / M" },
    price: { de: "59€/Tag", en: "59€/day" },
    description: {
      de: "Aero-Rennrad für maximale Geschwindigkeit auf der Straße und ein direktes, sportliches Fahrgefühl.",
      en: "Aero road bike for maximum speed on the road and a direct, sporty ride feel.",
    },
    image: aeroadPreview,
    gallery: [aeroadReal1, aeroadReal2, aeroadReal3, aeroadReal4],
    facts: [
      {
        label: { de: "Antrieb", en: "Drivetrain" },
        value: { de: "Shimano Ultegra R8000 2x11", en: "Shimano Ultegra R8000 2x11" },
      },
      {
        label: { de: "Schaltungsart", en: "Shifting type" },
        value: { de: "Mechanisch", en: "Mechanical" },
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
      de: [
        "Continental Grand Prix S TR 28 mm",
        "Tanwall-Reifen",
        "Bergtaugliche Übersetzung",
        "Aero-orientiertes Setup",
      ],
      en: ["Continental Grand Prix S TR 28 mm", "Tanwall tires", "Climb-friendly gearing", "Aero-oriented setup"],
    },
  },
];

export const priceItems: PriceItem[] = [
  {
    title: { de: "Rennräder", en: "Road bikes" },
    cost: { de: "ab 49€", en: "from 49€" },
    icon: Bike,
  },
  {
    title: { de: "Ab 3 Tagen", en: "From 3 days" },
    cost: { de: "15%", en: "15%" },
    icon: CalendarClock,
  },
  {
    title: { de: "Studentenrabatt", en: "Student discount" },
    cost: { de: "10%", en: "10%" },
    icon: GraduationCap,
  },
  {
    title: { de: "Zubehör", en: "Accessories" },
    cost: { de: "ab 0€", en: "from 0€" },
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
    label: { de: "Anrufen: +49 89 54193577", en: "Call: +49 89 54193577" },
    icon: "/assets/img/svg/phone.svg",
    href: "tel:+498954193577",
  },
];

export const faqItems = [
  {
    question: {
      de: "Wie läuft die Anfrage und Miete ab?",
      en: "How does the inquiry and rental process work?",
    },
    answer: {
      de: "Alle Fahrräder können online über das Kontaktfeld angefragt und gemietet werden. Wir klären anschließend alles direkt per E-Mail und melden uns immer innerhalb von 24 Stunden. Eine Telefonnummer hilft uns besonders bei kurzfristigen Anfragen, damit wir bei Bedarf direkt anrufen können.",
      en: "All bikes can be requested and rented online via the contact form. We then sort out everything directly by email and always reply within 24 hours. A phone number helps us especially with short-notice requests so we can call you directly if needed.",
    },
  },
  {
    question: {
      de: "Wo werden die Fahrräder abgeholt?",
      en: "Where do I pick up the bikes?",
    },
    answer: {
      de: "Die Abholung findet vor Ort in München-Maxvorstadt und Regensburg-Altstadt statt. Vor Ort geben wir dir das Fahrrad dann raus und gehen auf deine Wünsche ein (bspw. das Einstellen von der Sitzposition). Den genauen Ablauf stimmen wir nach der Anfrage per E-Mail mit dir ab.",
      en: "Pickup takes place on site in Munich-Maxvorstadt and Regensburg-Altstadt. On site, we hand over the bike and accommodate your preferences (for example, adjusting the saddle position). We will coordinate the exact process with you by email after the inquiry.",
    },
  },
  {
    question: {
      de: "Wie sind die Stornierungsbedingungen?",
      en: "What is the cancellation policy?",
    },
    answer: {
      de: "Die Stornierungsregelung gilt erst, sobald wir die Reservierung nach dem Austausch per E-Mail gemeinsam bestätigt haben und die Zahlung eingegangen ist. Bei einer Stornierung mehr als sieben Tage vor Mietbeginn erstatten wir 75 % des Mietpreises. Wenn du zwischen sieben Tagen und 24 Stunden vor Mietbeginn stornierst, erhältst du 50 % zurück. Bei einer Stornierung innerhalb von 24 Stunden vor Mietbeginn ist leider keine Rückerstattung mehr möglich.",
      en: "The cancellation policy applies once we have mutually confirmed the reservation by email and payment has been received. If you cancel more than seven days before the rental starts, we refund 25% of the rental price. Cancellations made between seven days and 24 hours before the rental starts receive a 50% refund. Unfortunately, cancellations within 24 hours of the rental start are non-refundable.",
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
    location: "München - Maxvorstadt & Regensburg - Altstadt",
    hero: {
      title: "RENNRAD-, GRAVEL-VERLEIH MÜNCHEN & REGENSBURG",
      intro:
        "Wir sind ein persönlicher Rennrad-, Gravel- und E-Road-Verleih in München-Maxvorstadt und verleihen gepflegte Endurance-, Gravel-, Allround- und Aero-Bikes für Training, Wochenendausfahrten und längere Touren. Statt Massenverleih bekommst du bei uns direkten Kontakt, ehrliche Beratung und klare Tarife.",
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
      intro: "Klare Preise für deinen Bike-Verleih in München: Rennräder ab 49€ plus Rabatte obendrauf. Zubehör ab 0€.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Häufige Fragen",
      intro: "Die wichtigsten Punkte zum Bike-Verleih, zur Anfrage, Abholung und Absicherung haben wir hier gesammelt.",
    },
    contact: {
      eyebrow: "Kontakt",
      title: "Kontakt aufnehmen",
      intro:
        "Schreib uns einfach über das Kontaktfeld, wenn du ein Rad reservieren möchtest. Der Erstkontakt läuft über das Formular und wir melden uns danach per E-Mail - immer innerhalb von 24 Stunden.",
    },
    locationSection: {
      eyebrow: "Standort",
      title: "Standorte in München & Regensburg",
      intro:
        "Wir geben Rennräder, Gravelbikes und E-Road-Bikes in München-Maxvorstadt und Regensburg-Altstadt heraus. Unterhalb findest du die Standorte und direkt darunter die genauen Adressen.",
      notice: "Wir geben nur raus, es gibt keine Ladenfläche.",
      addressLabel: "Adresse München",
      address: "Gabelsbergerstraße 79a, 80333 München, Maxvorstadt",
      secondaryAddressLabel: "Adresse Regensburg",
      secondaryAddress: "Rote Hahnen Gasse 12, 93047 Regensburg, Altstadt",
    },
    modal: {
      bike: "Verfügbares Rad",
      pricePerDay: "Preis pro Tag",
      facts: "Beschreibung",
      equipment: "Ausrüstung",
      reserve: "Reservieren",
      checked: "Geprüft & gepflegt",
      setup: "Leichtes Setup",
      close: "Details schließen",
      preview: "Vorschaubild",
      detailImage: "Detailbild",
    },
    form: {
      location: "Standort",
      name: "Name",
      contact: "E-Mail-Adresse",
      phone: "Telefonnummer",
      phoneHint: "Bitte im internationalen Format eingeben, z. B. +49 151 12345678.",
      bikeCount: "Anzahl Bikes",
      bike: "Bike",
      height: "Körpergröße in cm",
      bikeSize: "Rennrad",
      bikeSizeOptions: {
        s: "S",
        m: "M",
        l: "L",
      },
      periodFrom: "Zeitraum von",
      periodTo: "bis",
      periodHint: "Bitte wähle den Zeitraum, in dem du das Rad buchen möchtest.",
      pickupTime: "Gewünschte Abholuhrzeit",
      dropoffTime: "Gewünschte Abgabeuhrzeit",
      timeHint:
        "Wir arbeiten immer, auch an Wochenenden und Feiertagen, und vereinbaren die Übergabe gerne individuell mit dir.",
      equipment: "ICH BRAUCHE FOLGENDE AUSRÜSTUNG:",
      pedals: "Pedale\n(einmalig 5€)",
      pedalType: "Welche Pedale?",
      pedalTypeOptions: {
        platform: "Plattformpedale",
        spdSl: "SPD-SL",
        lookKeo2Max: "Look Keo2 Max",
        other: "Andere",
      },
      computerMount: "Fahrradcomputerhalterung\n(einmalig 5€)",
      computerMountType: "Welche Halterung?",
      computerMountTypeOptions: {
        garmin: "Garmin",
        wahoo: "Wahoo",
        other: "Andere",
      },
      helmet: "Helm\n(einmalig 10€)",
      clothing: "Kleidung (Rennradhose + Rennradtrikot)\n(einmalig je 15€)",
      bikepackingBag: "Bikepackingtasche\n(einmalig 25€)",
      glasses: "Rennradbrille\n(einmalig 5 €)",
      bottleHolder: "Flaschenhalter (inklusive)",
      repairKit: "Reparaturset (inklusive)",
      insuranceProtection: "Versicherungsschutz",
      insuranceProtectionInfo: {
        lead: "Dein Schutz ist uns wichtig.",
        body: "Wir gehören zu den wenigen Rennradverleihern in München, die – anders als fast alle Verleiher – Versicherungsschutz anbieten.",
        savings:
          "Bei einem von dir verursachten Schaden zahlst du höchstens 100 € – statt für den gesamten Schaden aufzukommen. Bei Verlust zahlst du höchstens 300 € – statt das komplette Fahrrad ersetzen zu müssen.",
        footer: "Normale, bestimmungsgemäße Gebrauchsspuren und üblicher Verschleiß werden dir nicht berechnet.",
      },
      glassesPreview: "Vorschau der Rennradbrille anzeigen",
      message: "Worum geht es?",
      messageHint:
        "Tipp: Du kannst auch oben bei einem Bike auf Reservieren klicken. Dann wird hier automatisch ein Vorschlag mit dem Bike-Namen eingefügt.",
      privacy: "Die Datenschutzerklärung habe ich zur Kenntnis genommen.",
      agb: "Ich habe die AGB für den Fahrradverleih gelesen und akzeptiere sie.",
      submit: "Unverbindlich Anfragen",
      subject: "Fahrradanfrage",
      sending: "Senden...",
      rentalDaysWarning: {
        title: "Bitte prüfe die angefragte Mietdauer",
        intro: "Du hast aktuell {days} volle Miettage angefragt.",
        details:
          "Auch wenn du das Fahrrad am ersten Tag erst später abholst oder am letzten Tag früher zurückgibst, bleibt es für den gesamten angefragten Zeitraum für dich reserviert.",
        exception:
          "Wenn du mehrere Tage buchst, das Fahrrad aber nur an einzelnen Tagen nutzen und bezahlen möchtest, entsteht für uns ein Einnahmeausfall: Wegen deiner angegebenen Abhol- und Rückgabezeiten können wir das Fahrrad in der Zwischenzeit nicht an andere Kunden ausgeben. Eine abweichende Berechnung ist deshalb nur in Ausnahmefällen möglich. Bitte schreibe deinen Wunsch ausdrücklich in das Nachrichtenfeld unten.",
        cancel: "Abbrechen",
        submit: "Trotzdem abschicken",
      },
      success:
        "Danke, deine Anfrage wurde gesendet. Wir haben dir außerdem eine Bestätigungsmail geschickt. Falls sie nicht ankommt, schau bitte auch in deinem Spam-Ordner nach. Wir melden uns innerhalb von 24 Stunden per E-Mail.",
      orderNumberLabel: "Auftragsnummer",
      error: "Die Nachricht konnte nicht gesendet werden. Bitte versuche es noch einmal.",
      validation: {
        contactHint: "Format: name@domain.de",
        nameRequired: "Bitte gib deinen Namen an.",
        contactRequired: "Bitte gib deine E-Mail-Adresse an.",
        contactInvalid: "Bitte nutze ein gültiges Format, zum Beispiel name@domain.de.",
        phoneRequired: "Bitte gib deine Telefonnummer an.",
        phoneInvalid: "Bitte nutze das internationale Format, z. B. +49 151 12345678.",
        heightRequired: "Bitte gib deine Körpergröße an.",
        heightInvalid: "Bitte gib eine Zahl zwischen 100 und 250 cm an.",
        locationRequired: "Bitte wähle einen Standort aus.",
        bikeSizeRequired: "Bitte wähle dein Rennrad aus.",
        periodFromRequired: "Bitte wähle den Start des Zeitraums.",
        periodToRequired: "Bitte wähle das Ende des Zeitraums.",
        periodInvalid: "Das Ende des Zeitraums muss nach dem Start liegen.",
        pedalTypeRequired: "Bitte wähle die Pedale aus, die du brauchst.",
        computerMountTypeRequired: "Bitte wähle die Fahrradcomputerhalterung aus, die du brauchst.",
        pickupTimeRequired: "Bitte gib deine gewünschte Abholuhrzeit an.",
        dropoffTimeRequired: "Bitte gib deine gewünschte Abgabeuhrzeit an.",
        messageRequired: "Bitte schreibe eine kurze Nachricht.",
        privacyRequired: "Bitte akzeptiere die Datenschutzbestimmungen.",
        agbRequired: "Bitte akzeptiere die AGB für den Fahrradverleih.",
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
    location: "Munich - Maxvorstadt & Regensburg - Altstadt",
    hero: {
      title: "Road and gravel bike rental in Munich & Regensburg",
      intro:
        "We are a personal road, gravel and e-road bike rental in Munich-Maxvorstadt and rent out well-maintained endurance, gravel, all-round and aero bikes for training, weekend rides and longer tours. Instead of a mass rental, you get direct contact, honest advice and clear pricing.",
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
      intro:
        "Clear prices for your bike rental in Munich: road bikes from €49, with discounts on top. Accessories from €0.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Frequently asked questions",
      intro: "Here we've gathered the most important points about bike rental, inquiries, pickup and coverage.",
    },
    contact: {
      eyebrow: "Contact",
      title: "Get in touch",
      intro:
        "Just write to us via the contact form if you want to reserve a bike. The first contact happens through the form and we'll get back to you by email - always within 24 hours.",
    },
    locationSection: {
      eyebrow: "Location",
      title: "Locations in Munich & Regensburg",
      intro:
        "We hand out road bikes, gravel bikes and e-road bikes in Munich-Maxvorstadt and Regensburg-Altstadt. Below you'll find the locations and directly beneath them the exact addresses.",
      notice: "We only hand out bikes, there is no storefront.",
      addressLabel: "Address Munich",
      address: "Gabelsbergerstraße 79a, 80333 Munich, Maxvorstadt",
      secondaryAddressLabel: "Regensburg address",
      secondaryAddress: "Rote Hahnen Gasse 12, 93047 Regensburg, Altstadt",
    },
    modal: {
      bike: "Available bike",
      pricePerDay: "Price per day",
      facts: "Description",
      equipment: "Equipment",
      reserve: "Reserve",
      checked: "Checked & maintained",
      setup: "Light setup",
      close: "Close details",
      preview: "Preview image",
      detailImage: "Detail image",
    },
    form: {
      location: "Location",
      name: "Name",
      contact: "Email address",
      phone: "Phone number",
      phoneHint: "Please use the international format, e.g. +49 151 12345678.",
      bikeCount: "Number of bikes",
      bike: "Bike",
      height: "Height in cm",
      bikeSize: "Road bike",
      bikeSizeOptions: {
        s: "S",
        m: "M",
        l: "L",
      },
      periodFrom: "Rental period from",
      periodTo: "to",
      periodHint: "Please choose the period in which you want to book the bike.",
      pickupTime: "Preferred pickup time",
      dropoffTime: "Preferred drop-off time",
      timeHint:
        "We are available every day, including weekends and public holidays, and are happy to arrange the handover individually with you.",
      equipment: "THE FOLLOWING EQUIPMENT IS NEEDED:",
      pedals: "Pedals\n(one-time €5)",
      pedalType: "Which pedals?",
      pedalTypeOptions: {
        platform: "Platform pedals",
        spdSl: "SPD-SL",
        lookKeo2Max: "Look Keo2 Max",
        other: "Other",
      },
      computerMount: "Bike computer mount\n(one-time €5)",
      computerMountType: "Which mount?",
      computerMountTypeOptions: {
        garmin: "Garmin",
        wahoo: "Wahoo",
        other: "Other",
      },
      helmet: "Helmet\n(one-time €10)",
      clothing: "Clothing (bib shorts + road jersey)\n(one-time €15 each)",
      bikepackingBag: "Bikepacking bag\n(one-time €25)",
      glasses: "Road cycling glasses\n(one-time €5)",
      bottleHolder: "Bottle holder (included)",
      repairKit: "Repair kit (included)",
      insuranceProtection: "Insurance protection",
      insuranceProtectionInfo: {
        lead: "Your protection matters to us.",
        body: "We are one of the few road-bike rental companies in Munich to offer insurance protection, unlike almost all other rental providers.",
        savings:
          "For damage caused by you, you pay no more than €100 instead of the full cost of the damage. If the bike is lost, you pay no more than €300 instead of replacing the entire bike.",
        footer: "Normal wear and tear from proper use is not charged to you.",
      },
      glassesPreview: "Show a preview of the road cycling glasses",
      message: "What is it about?",
      messageHint:
        "Tip: You can also click Reserve on a bike above. That will automatically insert a message draft with the bike name here.",
      privacy: "I accept the privacy policy.",
      agb: "I have read and accept the terms and conditions for bike rental.",
      submit: "Send inquiry",
      subject: "Bike inquiry",
      sending: "Sending...",
      rentalDaysWarning: {
        title: "Please check the requested rental period",
        intro: "You are currently requesting {days} full rental days.",
        details:
          "Even if you pick up the bike later on the first day or return it earlier on the last day, it remains reserved for you for the entire requested period.",
        exception:
          "If you book several days but only want to use and pay for selected days, this creates a loss of revenue for us: because of your stated pickup and return times, we cannot rent the bike to another customer in between. A different price is therefore only possible in exceptional cases. Please state your request explicitly in the message field below.",
        cancel: "Cancel",
        submit: "Send anyway",
      },
      success: "Thanks, your inquiry has been sent. We will reply within 24 hours by email.",
      orderNumberLabel: "Order number",
      error: "The message could not be sent. Please try again.",
      validation: {
        contactHint: "Format: name@domain.com",
        nameRequired: "Please enter your name.",
        contactRequired: "Please enter your email address.",
        contactInvalid: "Please use a valid format, for example name@domain.com.",
        phoneRequired: "Please enter your phone number.",
        phoneInvalid: "Please use the international format, e.g. +49 151 12345678.",
        heightRequired: "Please enter your height.",
        heightInvalid: "Please enter a number between 100 and 250 cm.",
        locationRequired: "Please choose a location.",
        bikeSizeRequired: "Please choose your road bike.",
        periodFromRequired: "Please choose the start of the rental period.",
        periodToRequired: "Please choose the end of the rental period.",
        periodInvalid: "The end of the rental period must be after the start.",
        pedalTypeRequired: "Please choose the pedals you need.",
        computerMountTypeRequired: "Please choose the bike computer mount you need.",
        pickupTimeRequired: "Please enter your preferred pickup time.",
        dropoffTimeRequired: "Please enter your preferred drop-off time.",
        messageRequired: "Please write a short message.",
        privacyRequired: "Please accept the privacy policy.",
        agbRequired: "Please accept the bike rental terms and conditions.",
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
    return `Hey,\n\nich würde gerne das Bike "${bikeTitle}" reservieren.\n\nIch freue mich über eine kurze Rückmeldung zu Verfügbarkeit und Abholung.\n\nViele Grüße`;
  }

  return `Hey,\n\nI would like to reserve the "${bikeTitle}" bike.\n\nPlease let me know about availability and pickup.\n\nBest regards`;
}
