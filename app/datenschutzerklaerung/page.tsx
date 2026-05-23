import Link from "next/link";

export const metadata = {
  title: "Datenschutzerklärung | Munich Rental",
};

const sections = [
  {
    title: "1. Verantwortliche Stelle",
    paragraphs: [
      "Verantwortlich für die Datenverarbeitung ist Munich Rental, Julius Porzel, Josephine-Lang-Weg 3, 81245 München, Deutschland.",
      "Für Fragen zum Datenschutz erreichst du uns per E-Mail unter hallo@munich-bike-rental.de.",
    ],
  },
  {
    title: "2. Welche Daten wir verarbeiten",
    paragraphs: [
      "Je nach Nutzung unserer Website verarbeiten wir insbesondere Name, Kontaktangaben, Buchungszeitraum, Nachricht, ausgewähltes Bike sowie technische Nutzungsdaten wie IP-Adresse, Browserdaten und Zeitpunkt des Zugriffs.",
    ],
  },
  {
    title: "3. Zwecke der Verarbeitung",
    paragraphs: [
      "Wir verarbeiten personenbezogene Daten, um unsere Website bereitzustellen, Anfragen zu beantworten, Reservierungen zu koordinieren und bei Bedarf vorvertragliche Maßnahmen oder die spätere Vertragsabwicklung vorzubereiten.",
      "Wenn du über das Formular kontaktierst, nutzen wir deine Angaben außerdem, um dir per E-Mail oder WhatsApp zu antworten und den gewünschten Buchungszeitraum mit dir abzustimmen.",
    ],
  },
  {
    title: "4. Kontaktformular und Reservierung",
    paragraphs: [
      "Wenn du unser Kontaktformular nutzt, verarbeiten wir die von dir eingegebenen Daten wie Name, Kontaktmöglichkeit, Buchungszeitraum und Nachricht, um deine Anfrage zu bearbeiten und die Reservierung vorzubereiten.",
      "Wenn du in den Bike-Details auf Reservieren klickst, wird ein Nachrichtenentwurf mit dem Namen des gewählten Bikes automatisch vorbefüllt. Diese Vorbelegung dient nur dazu, dir das Formulieren der Anfrage zu erleichtern.",
      "Rechtsgrundlage ist regelmäßig Art. 6 Abs. 1 lit. b DSGVO, soweit die Daten zur Durchführung vorvertraglicher Maßnahmen oder zur Vertragserfüllung benötigt werden, sowie Art. 6 Abs. 1 lit. f DSGVO für die sichere und effiziente Bearbeitung deiner Anfrage.",
    ],
  },
  {
    title: "5. E-Mail, WhatsApp und technische Auftragsverarbeitung",
    paragraphs: [
      "Die über das Formular gesendeten Nachrichten werden serverseitig per E-Mail an hallo@munich-bike-rental.de übermittelt. Der Versand erfolgt über unseren Maildienstanbieter anfrage@munich-bike-rental.de.",
      "Für Hosting, Mailversand und ggf. weitere technische Dienstleistungen setzen wir Auftragsverarbeiter ein. Diese verarbeiten personenbezogene Daten nur auf unsere Weisung und auf Grundlage eines Auftragsverarbeitungsvertrags nach Art. 28 DSGVO.",
      "Wenn du uns über den WhatsApp-Link kontaktierst, erfolgt die Kommunikation über den Dienst von WhatsApp/Meta. Dafür gelten zusätzlich die Datenschutzbestimmungen dieses Anbieters.",
    ],
  },
  {
    title: "6. Cookies, Endgerätezugriffe und TDDDG",
    paragraphs: [
      "Auf unserer Website setzen wir derzeit keine Marketing- oder Analyse-Cookies ein.",
      "Soweit wir künftig Funktionen einsetzen, die Informationen auf deinem Endgerät speichern oder auslesen, erfolgt das nur nach Maßgabe des § 25 TDDDG und der dort vorgesehenen Einwilligungs- oder Erlaubnistatbestände.",
    ],
  },
  {
    title: "7. Kein AI-Act- oder Data-Act-Szenario",
    paragraphs: [
      "Wir setzen derzeit keine KI-Systeme für eine direkte Nutzerinteraktion ein und bieten keine vernetzten Produkte, IoT- oder Data-Act-relevanten Cloud-Dienste an. Deshalb ergeben sich für diese Website aktuell keine zusätzlichen Transparenzpflichten aus dem EU AI Act oder dem EU Data Act.",
    ],
  },
  {
    title: "8. Weitergabe von Daten",
    paragraphs: [
      "Eine Weitergabe deiner Daten an Dritte erfolgt nur, wenn dies zur Bearbeitung deiner Anfrage, zur technischen Bereitstellung der Website oder aufgrund gesetzlicher Pflichten erforderlich ist.",
    ],
  },
  {
    title: "9. Speicherdauer",
    paragraphs: [
      "Wir speichern personenbezogene Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist oder wie gesetzliche Aufbewahrungspflichten bestehen.",
    ],
  },
  {
    title: "10. Deine Rechte",
    paragraphs: [
      "Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie Widerspruch gegen die Verarbeitung deiner personenbezogenen Daten, soweit die gesetzlichen Voraussetzungen vorliegen.",
      "Außerdem steht dir ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde zu.",
    ],
  },
  {
    title: "11. Keine automatisierte Entscheidungsfindung",
    paragraphs: [
      "Eine automatisierte Entscheidungsfindung oder ein Profiling findet auf dieser Website nicht statt.",
    ],
  },
] as const;

export default function DatenschutzerklaerungPage() {
  return (
    <main className="legal-page">
      <div className="container legal-page__inner">
        <Link className="legal-page__back" href="/">
          Zurück zur Startseite
        </Link>

        <h1>Datenschutzerklärung</h1>

        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
