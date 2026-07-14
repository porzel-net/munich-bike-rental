import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzerklärung von Your Bike Rental.",
  alternates: {
    canonical: "/datenschutzerklaerung",
  },
};

const companyName = "Your Bike Rental";

export default function DatenschutzerklaerungPage() {
  return (
    <main className="legal-page">
      <div className="container legal-page__inner">
        <Link className="legal-page__back" href="/">
          Zurück zur Startseite
        </Link>

        <h1>Datenschutzerklärung</h1>
        <p>Information zur Verarbeitung Ihrer Daten nach Art. 13 Datenschutzgrundverordnung (DSGVO)</p>
        <p>Stand: 10.06.2026</p>

        <section>
          <h2>1. Allgemeines</h2>
          <h3>Geltungsbereich und Änderungen</h3>
          <h4>Geltungsbereich</h4>
          <p>Diese Datenschutzerklärung betrifft nachfolgende Verarbeitungen von {companyName}</p>
          <ul>
            <li>Das Internet-Angebot unter der Adresse:</li>
            <li>https://www.munich-bike-rental.de/</li>
            <li>Kontaktaufnahme über unser Online-Formular, unsere E-Mailadresse und per Telefon</li>
          </ul>
          <p>
            In dieser Datenschutzerklärung informieren wir Sie über die Datenverarbeitung, soweit wir allein
            verantwortlich sind, die Datenverarbeitung, soweit wir gemeinsam mit anderen verantwortlich sind, und
            die eingesetzten Fremdanbieter, die in eigener Verantwortung Daten verarbeiten.
          </p>
          <p>Für die Datenverarbeitung anderer Anbieter, auf die z.B. über Links verwiesen wird, gelten die dortigen Datenschutzhinweise.</p>
          <h3>Änderungen der Datenschutzerklärung</h3>
          <p>
            Diese Datenschutzerklärung wird von uns bei Bedarf angepasst bzw. aktualisiert. Es gilt die jeweils
            aktuell gültige Fassung.
          </p>
          <h3>Ansprechpartner und Verantwortliche</h3>
          <h4>Name und Kontaktdaten des Verantwortlichen</h4>
          <p>{companyName}</p>
          <p>Julius Porzel</p>
          <p>Josephine-Lang-Weg 3</p>
          <p>81245 München</p>
          <p>E-Mail: hallo@munich-bike-rental.de</p>
          <h4>Weitere Verantwortliche</h4>
          <p>
            Für die Verarbeitung Ihrer personenbezogenen Daten sind noch weitere Stellen verantwortlich. Insoweit
            besteht eine gemeinsame Verantwortlichkeit gemäß Art. 26 DSGVO. Die für die Verarbeitung Ihrer Daten
            gemeinsam Verantwortlichen haben in einer Vereinbarung festgelegt, welcher Verantwortliche jeweils welche
            Verpflichtung nach der DSGVO erfüllt. Angaben zu den weiteren gemeinsamen Verantwortlichen sowie das
            Wesentliche der getroffenen Vereinbarungen finden Sie bei der jeweiligen Datenverarbeitung.
          </p>
          <h4>Fragen zum Datenschutz</h4>
          <p>
            Bei Fragen zum Umgang mit Ihren personenbezogenen Daten und zur Ausübung Ihrer Rechte als Betroffener,
            können Sie sich jederzeit unter den oben genannten Kontaktdaten an unsere Datenschutzbeauftragte wenden.
          </p>
        </section>

        <section>
          <h2>2. Unser Umgang mit Ihren Daten</h2>
          <h3>Bereitstellung der Webseite und Erstellung von Logfiles</h3>
          <h4>a) Beschreibung und Umfang der Datenverarbeitung</h4>
          <p>
            Bei jedem Aufruf unserer Internetseite erfasst unser System automatisiert Daten und Informationen vom
            Computersystem des aufrufenden Rechners. Die Daten werden ebenfalls in den Logfiles unseres Systems
            gespeichert. Folgende Daten werden hierbei erhoben:
          </p>
          <ul>
            <li>Besuchte Website</li>
            <li>Datum und Uhrzeit zum Zeitpunkt des Zugriffes</li>
            <li>Zeitzonendifferenz zur Greenwich Mean Time (GMT)</li>
            <li>Menge der gesendeten Daten in Byte</li>
            <li>Quelle/Verweis, von welchem Sie auf die Seite gelangten</li>
            <li>Verwendeter Browser</li>
            <li>Sprache und Version der Browsersoftware</li>
            <li>Verwendetes Betriebssystem und dessen Oberfläche</li>
            <li>Verwendete IP-Adresse</li>
            <li>Zugriffsstatus/HTTP-Statuscode</li>
          </ul>
          <p>Im Rahmen des Hostings können außerdem Sicherungskopien und Wiederherstellungsvorgänge verarbeitet werden.</p>
          <h4>Drittanbieter</h4>
          <p>STRATO AG</p>
          <p>Otto-Ostrowski-Straße 7,</p>
          <p>10249 Berlin</p>
          <p>Telefon: +49 (0) 30-300 146 0</p>
          <p>E-Mail: impressum@strato.de</p>
          <h4>Webdesigner, als Auftragsverarbeiter</h4>
          <p>Julius Porzel</p>
          <p>Josephine-Lang-Weg 3</p>
          <p>81245 München</p>
          <p>Soweit für die technische Absicherung der Website aktiviert, Cloudflare, Inc.</p>
          <p>101 Townsend St.</p>
          <p>San Francisco, CA 94107, USA</p>
          <p>Weitere Informationen zu den eingesetzten Cloudflare-Diensten finden Sie in Abschnitt 4.</p>
          <h4>Datenschutz</h4>
          <h4>b) Rechtsgrundlage und Zweck der Datenverarbeitung</h4>
          <p>
            Die genannten Datenverarbeitungen sind technisch notwendig, um angeforderte Inhalte von Webseiten korrekt
            auszuliefern und fallen bei Nutzung des Internets zwingend an.
          </p>
          <p>
            Rechtsgrundlage für die vorübergehende Speicherung der Daten und der Logfiles ist Art. 6 Abs. 1 lit. f
            DSGVO. Die berechtigten Interessen liegen in der Fehleranalyse der Website und um die Sperrung der
            IP-Adresse und ggf. die Rechtsverfolgung im Falle eines Missbrauchs der Website zu ermöglichen, etwa im
            Falle von DOS-Angriffen.
          </p>
          <p>
            Die vorübergehende Speicherung der IP-Adresse durch das System ist notwendig, um eine Auslieferung der
            Website an den Rechner des Nutzers zu ermöglichen. Hierfür muss die IP-Adresse des Nutzers für die Dauer
            der Sitzung gespeichert bleiben.
          </p>
          <p>Die erhobenen Daten dienen außerdem statistischen Auswertungen und zur Verbesserung der Website.</p>
          <p>
            Wir behalten uns vor, die Server-Logfiles nachträglich zu überprüfen, sollten konkrete Anhaltspunkte auf
            eine rechtswidrige Nutzung hinweisen.
          </p>
          <h4>c) Dauer der Speicherung und Widerspruchsmöglichkeit</h4>
          <p>Die Daten werden nach 7 Tagen gelöscht.</p>
          <p>
            Die Erfassung der Daten zur Bereitstellung der Website und die Speicherung der Daten in Logfiles ist für
            den Betrieb der Internetseite zwingend erforderlich. Es besteht folglich seitens des Nutzers keine
            Widerspruchsmöglichkeit.
          </p>
          <p>Logdateien werden nach 7 Tagen gelöscht.</p>
        </section>

        <section>
          <h2>3. Cookies</h2>
          <p>
            Bei Cookies handelt es sich um Textdateien, die im Internetbrowser bzw. vom Internetbrowser auf dem
            Endgerät des Nutzers gespeichert werden.
          </p>
          <h4>a) Beschreibung und Umfang der Datenverarbeitung</h4>
          <p>
            Von uns verwendete Cookies sind technisch notwendige Session-Cookies sowie ein Consent-Cookie, mit dem
            Ihre Auswahl im Cookie-Banner gespeichert wird. Durch Session-Cookies werden Informationen über die
            aktuelle Sitzung hinterlegt. Diese dienen dazu, Einstellungen eines Nutzers auf einer Seite dessen
            Sitzung zuzuordnen. Wenn Sie in einem Browser in zwei Fenstern die Homepage besuchen, wird am
            Session Cookie erkannt, dass es sich bei beiden Aufrufen um Ihre Sitzung handelt.
          </p>
          <p>
            Sofern wir Schutz- und Routingdienste von Cloudflare einsetzen, können zusätzlich technisch notwendige
            Sicherheits- oder Challenge-Cookies bzw. vergleichbare Identifikatoren gesetzt werden. Genauere Details
            sind im Abschnitt „Schutz- und Routingdienste“ zu finden. Cookies oder ähnliche Technologien von Google
            Analytics werden erst nach Ihrer ausdrücklichen Einwilligung geladen.
          </p>
          <h4>b) Rechtsgrundlage und Zweck der Datenverarbeitung</h4>
          <p>Technisch notwendige Cookies sind zwingend erforderlich, um die Website anzuzeigen und Ihre Auswahl zu speichern.</p>
          <p>
            Rechtsgrundlage für die vorübergehende Speicherung der Daten ist Art. 6 Abs. 1 lit. f DSGVO
            (berechtigtes Interesse) bzw. bei optionalen Cookies Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
          </p>
          <h4>c) Dauer der Speicherung und Widerspruchsmöglichkeit</h4>
          <p>
            Session-Cookies werden nach Ende Ihres Besuchs der Webseite automatisch gelöscht. Technisch notwendige
            Sicherheits- oder Challenge-Cookies bzw. vergleichbare Identifikatoren werden nur so lange gespeichert,
            wie dies für den jeweiligen Sicherheitszweck erforderlich ist. Der Consent-Cookie wird gespeichert,
            bis Sie Ihre Auswahl ändern oder den Cookie-Speicher Ihres Browsers löschen.
          </p>
          <p>
            Es besteht seitens des Nutzers keine Widerspruchsmöglichkeit, eine Deaktivierung dieser Cookies kann durch
            Einstellung des jeweiligen Browsers vorgenommen werden.
          </p>
        </section>

        <section>
          <h2>4. Schutz- und Routingdienste</h2>
          <h4>a) Beschreibung und Umfang der Datenverarbeitung</h4>
          <p>
            Diese Website wird über STRATO gehostet. Zusätzlich können, soweit technisch aktiviert, Dienste von
            Cloudflare als DNS-, Reverse-Proxy-, SSL/TLS-, WAF-, DDoS-Schutz-, Routing-, Cache-, CDN-,
            Rate-Limiting-, Bot-Schutz- und Turnstile-Dienste eingesetzt werden. Zum technischen Setup gehören je nach
            Konfiguration auch Protokollierung, Backup, Wiederherstellung, Wartung und Fernzugriff.
          </p>
          <p>
            Bei der Nutzung dieser Dienste können insbesondere IP-Adressen, Server- und Sicherheitslogs, Request- und
            Headerdaten, Cookies bzw. vergleichbare Identifikatoren, Browser- und Geräteinformationen sowie Daten zur
            Abwehr automatisierter Zugriffe verarbeitet werden.
          </p>
          <p>
            Soweit Cloudflare Turnstile eingesetzt wird, können bestimmte Signale zudem in eigener
            datenschutzrechtlicher Verantwortlichkeit von Cloudflare zur Verbesserung der Bot-Erkennung verarbeitet
            werden.
          </p>
          <p>Ergänzende Informationen zu den Unterauftragsverarbeitern:</p>
          <p>STRATO AG</p>
          <p>Otto-Ostrowski-Straße 7,</p>
          <p>10249 Berlin</p>
          <p>Telefon: +49 (0) 30-300 146 0</p>
          <p>E-Mail: impressum@strato.de</p>
          <p>Cloudflare, Inc.</p>
          <p>101 Townsend St.</p>
          <p>San Francisco, CA 94107, USA</p>
          <p>
            Weitere von Cloudflare eingesetzte Unterauftragsverarbeiter ergeben sich, soweit für die konkret
            aktivierten Dienste relevant, aus der jeweils aktuellen Cloudflare-Subprozessorliste:
          </p>
          <p>
            <a
              href="https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/"
              target="_blank"
              rel="noreferrer"
            >
              https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/
            </a>
          </p>
          <h4>b) Rechtsgrundlage für die Datenverarbeitung ist</h4>
          <p>
            Art. 6 Abs. 1 S. 1 lit. f DSGVO: Berechtigtes Interesse an der sicheren, stabilen und performanten
            Auslieferung der Website sowie an der Abwehr missbräuchlicher Zugriffe.
          </p>
          <p>
            Soweit einzelne Funktionen nur mit Einwilligung aktiviert werden, ist Art. 6 Abs. 1 S. 1 lit. a DSGVO
            die Rechtsgrundlage.
          </p>
          <p>
            Zweck: Schutz, Routing, Auslieferung und Absicherung der Website sowie die Erkennung und Abwehr
            automatisierter Zugriffe.
          </p>
          <h4>c) Dauer der Speicherung und Widerspruchsmöglichkeit</h4>
          <p>Die Verarbeitung erfolgt nur, soweit sie für Schutz und Auslieferung der Website erforderlich ist.</p>
          <p>
            Soweit Cookies oder vergleichbare Identifikatoren gesetzt werden, können Sie Ihren Browser so einstellen,
            dass dieser diese nach einer bestimmten Zeit löscht oder nicht akzeptiert. Hierdurch kann es zu
            Funktionseinschränkungen kommen.
          </p>
          <p>
            Eine Verarbeitung in Drittländern, insbesondere in den USA, kann bei Cloudflare nicht ausgeschlossen
            werden. Eine ausschließliche Verarbeitung innerhalb der EU wird nur geschuldet, soweit entsprechende
            Regionalisierungsfunktionen ausdrücklich vereinbart und tatsächlich eingesetzt werden.
          </p>
        </section>

        <section>
          <h2>5. Weitere Technologien</h2>
          <h3>Google Analytics</h3>
          <h4>a) Beschreibung und Umfang der Datenverarbeitung</h4>
          <p>
            Diese Website kann Google Analytics einsetzen, um die Nutzung der Internetseite auszuwerten, die
            Reichweite zu messen und den Erfolg von Anfragen nachzuvollziehen. Google Analytics wird erst geladen,
            nachdem Sie im Cookie-Banner ausdrücklich zugestimmt haben.
          </p>
          <p>
            Beim Einsatz können insbesondere Seitenaufrufe, Interaktionen, Zeitstempel, Geräteinformationen,
            Browserinformationen, ungefähre Standortdaten, Referrer-Informationen und eine gekürzte IP-Adresse
            verarbeitet werden. Die Datenverarbeitung erfolgt durch Google Ireland Limited, Gordon House, Barrow
            Street, Dublin 4, Irland. Eine Übermittlung in Drittländer, insbesondere in die USA, kann dabei nicht
            ausgeschlossen werden.
          </p>
          <h4>b) Rechtsgrundlage und Zweck der Datenverarbeitung</h4>
          <p>
            Rechtsgrundlage ist Ihre Einwilligung nach Art. 6 Abs. 1 S. 1 lit. a DSGVO. Zweck ist die Analyse des
            Nutzerverhaltens, die Messung von Leads und die Verbesserung unserer Website und Werbemaßnahmen.
          </p>
          <h4>c) Dauer der Speicherung und Widerrufsmöglichkeit</h4>
          <p>
            Sie können Ihre Einwilligung jederzeit über die Cookie-Einstellungen widerrufen. Die Speicherdauer der
            von Google gesetzten Cookies richtet sich nach den jeweiligen Google-Einstellungen und der von Google
            verwendeten Konfiguration.
          </p>
          <h3>Verschlüsselte Übertragung</h3>
          <p>
            Wir verwenden zur sicheren Übertragung der Inhalte eine Verschlüsselung (SSL bzw. TLS). Ob eine
            Internetseite verschlüsselt übertragen wird, erkennen Sie am Schloss-Symbol in der Adresszeile Ihres
            Browsers.
          </p>
          <h3>Kürzung der IP-Adresse</h3>
          <p>Durch die Kürzung der IP-Adresse wird die Identifizierung der Nutzer erschwert. Soweit die Möglichkeit besteht wird diese Maßnahme von uns genutzt.</p>
          <h3>Datensicherheit</h3>
          <p>
            Wir bedienen uns geeigneter technischer und organisatorischer Sicherheitsmaßnahmen, um die Daten gegen
            Manipulationen, Verlust, Zerstörung oder gegen den unbefugten Zugriff zu schützen. Unsere
            Sicherheitsmaßnahmen werden entsprechend der technologischen Entwicklung fortlaufend verbessert.
          </p>
          <h3>Verbindung zu anderen Webseiten über Links in Grafiken oder Text</h3>
          <p>Die von uns angebotenen Links führen Sie grundsätzlich ohne Zusatzinformation direkt zum angegebenen Ziel.</p>
          <p>
            Externe Links, die auf Seiten außerhalb unseres Angebots führen haben wir entsprechend gekennzeichnet,
            sofern dies nicht bereits eindeutig erkennbar ist.
          </p>
          <h3>Zwischengeschaltete und weitergeleitete Links</h3>
          <p>
            Ein Link kann automatisch auf eine andere Webseite als die angeforderte weiterleiten oder statt direkt auf
            die neue Seite zu führen, zunächst über eine andere Seite leiten ohne dass der Benutzer davon etwas
            bemerkt. Dies wird meist dazu genutzt um unbemerkt Daten des Besuchers zu verarbeiten oder Aktionen
            auszulösen.
          </p>
          <h3>Aktive Inhalte</h3>
          <p>
            Aktive Inhalte in Webseiten, sind Inhalte, die nach dem Laden direkt auf dem Gerät des Anwenders ausgeführt
            werden und somit grundsätzlich ein Sicherheitsrisiko darstellen. Zu den häufig verwendeten aktiven Inhalten
            gehören Java und JavaScript.
          </p>
          <p>
            Auf unserer Internetseite verwenden wir technisch notwendige JavaScript-Funktionen. Soweit externe Schutz-
            oder Routingdienste eingebunden werden, können diese personenbezogene Informationen über Ihren Besuch auf
            unserer Internetseite erhalten. Hierbei ist ggf. eine Verarbeitung von Daten außerhalb der EU möglich.
          </p>
          <p>
            Sie können sich schützen, indem Sie eine Browser-Erweiterung wie z.B. „NoScript“ oder „uBlock Origin“
            installieren oder JavaScript in Ihrem Browser deaktivieren. Hierdurch kann es zu Funktionseinschränkungen
            auf Internetseiten kommen, die Sie besuchen.
          </p>
          <p>
            Weitere Informationen zu JavaScript finden Sie unter:
            {" "}
            <a href="https://de.wikipedia.org/wiki/JavaScript#Verwendung" target="_blank" rel="noreferrer">
              https://de.wikipedia.org/wiki/JavaScript#Verwendung
            </a>
          </p>
        </section>

        <section>
          <h2>6. Eingebundene Schriften</h2>
          <p>
            Es werden Schriftarten (Fonts) von Fremdanbietern verwendet. Diese sind lokal eingebunden, es findet keine
            Verbindung zu fremden Servern statt. Eine Übermittlung von personenbezogenen Daten (z.B. die IP-Adresse)
            findet NICHT statt.
          </p>
        </section>

        <section>
          <h2>7. Kontaktaufnahme über unser Online-Formular, unsere E-Mailadresse oder per Telefon</h2>
          <h4>a) Beschreibung und Umfang der Datenverarbeitung</h4>
          <p>
            Über das auf unserer Internetseite bereitgestellte Kontaktformular sowie über die bereitgestellten
            Kontaktdaten (Telefonnummer und E-Mail-Adresse) ist eine Kontaktaufnahme an uns möglich. Im
            Kontaktformular werden die von Ihnen eingegebenen Daten verarbeitet, insbesondere Name, Kontaktangabe,
            Telefonnummer, Zeitraum der gewünschten Miete, gewünschte Abhol- und Abgabeuhrzeit, Angaben zur
            gewünschten Ausrüstung wie Pedale, Helm oder Kleidung, Nachricht, Sprache der Anfrage sowie
            gegebenenfalls das ausgewählte Fahrrad.
          </p>
          <p>Die Pflichtfelder sind erforderlich, damit wir Ihre Anfrage bearbeiten können.</p>
          <p>Die Formulardaten werden serverseitig an unsere E-Mail-Infrastruktur übermittelt und dort verarbeitet.</p>
          <p>Die Antwort auf Anfragen über das Formular erfolgt per E-Mail an die angegebene E-Mail-Adresse.</p>
          <p>Beim Versand per E-Mail werden die Kontaktangaben durch den von uns eingesetzten Mail-/SMTP-Dienstleister verarbeitet.</p>
          <p>Es erfolgt in diesem Zusammenhang keine Weitergabe der Daten an unbeteiligte Dritte.</p>
          <h4>b) Rechtsgrundlage und Zweck der Datenverarbeitung</h4>
          <p>
            Art. 6 Abs. 1 S. 1 lit. b. DSGVO: Vertragserfüllung, sofern sich die Anfrage auf den Abschluss oder die
            Durchführung eines Vertrages mit uns richtet.
          </p>
          <p>Art. 6 Abs. 1 S. 1 lit. f. DSGVO: Berechtigtes Interesse, in allen übrigen Fällen</p>
          <p>Die Daten werden ausschließlich für die Beantwortung Ihrer Anfrage verarbeitet.</p>
          <h4>c) Dauer der Speicherung und Widerspruchsmöglichkeit</h4>
          <p>Die Daten werden umgehend nach der Bearbeitung Ihrer Anfrage gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten bestehen.</p>
          <p>
            Für die personenbezogenen Daten, die über das Kontaktformular oder per E-Mail übersandt wurden, ist dies
            dann der Fall, wenn die jeweilige Konversation mit dem Nutzer beendet ist. Beendet ist die Konversation
            dann, wenn sich aus den Umständen entnehmen lässt, dass der betroffene Sachverhalt abschließend geklärt
            ist.
          </p>
          <p>
            Die Daten, für die eine gesetzliche Aufbewahrungspflicht besteht werden für die gesetzlich festgelegte
            Dauer aufbewahrt (6 Jahre nach § 257 Abs. 1 Nr. 2, Abs. 4 HGB).
          </p>
          <p>
            Nimmt der Nutzer über das Kontaktformular oder per E-Mail Kontakt mit uns auf, so kann er der Speicherung
            seiner personenbezogenen Daten jederzeit widersprechen. In einem solchen Fall kann die Konversation nicht
            fortgeführt werden. Alle personenbezogenen Daten, die im Zuge der Kontaktaufnahme gespeichert wurden,
            werden in diesem Fall gelöscht.
          </p>
        </section>

        <section>
          <h2>8. Datenverarbeitung in Drittländern</h2>
          <p>
            Eine Datenübermittlung in Drittstaaten (Staaten außerhalb des Europäischen Wirtschaftsraums - EWR) kann
            insbesondere im Zusammenhang mit Cloudflare nicht ausgeschlossen werden.
          </p>
          <p>
            Soweit eine solche Übermittlung stattfindet, erfolgt sie nur unter den jeweils anwendbaren gesetzlichen
            Voraussetzungen, insbesondere auf Grundlage eines Angemessenheitsbeschlusses, von Standardvertragsklauseln
            oder vergleichbaren Garantien, soweit diese für den jeweiligen Dienst vorgesehen sind.
          </p>
          <p>Eine ausschließliche Verarbeitung innerhalb des EWR wird nicht für alle eingesetzten Dienste geschuldet.</p>
          <h3>Automatisierte Einzelfallentscheidung</h3>
          <p>Wir nutzen keine rein automatisierten Verarbeitungsprozesse zur Herbeiführung einer Entscheidung.</p>
        </section>

        <section>
          <h2>9. Links in Grafiken oder Text</h2>
          <p>Die von uns angebotenen Links führen Sie grundsätzlich ohne Zusatzinformation direkt zum angegebenen Ziel.</p>
          <p>
            Externe Links, die auf Seiten außerhalb unseres Angebots führen haben wir entsprechend gekennzeichnet,
            sofern dies nicht bereits eindeutig erkennbar ist.
          </p>
        </section>

        <section>
          <h2>10. Löschung der Daten</h2>
          <p>
            Ihre Daten werden solange gespeichert, wie es zur Erfüllung des jeweiligen Zwecks erforderlich ist oder
            gesetzliche Aufbewahrungspflichten bestehen und keine abweichenden Angaben zu einzelnen Verarbeitungen
            gemacht werden.
          </p>
          <p>
            Sie widerrufen Ihre Einwilligung, auf die sich die Verarbeitung gem. Art. 6 Abs. 1 lit. a oder Art. 9
            Abs. 2 lit. a DSGVO stützt.
          </p>
          <p>
            Sie legen gem. Art. 21 Abs. 1 DSGVO Widerspruch gegen die Verarbeitung ein und es liegen keine vorrangigen
            berechtigten Gründe für die Verarbeitung vor, oder Sie legen gem. Art. 21 Abs. 2 DSGVO Widerspruch gegen
            die Verarbeitung ein.
          </p>
          <p>
            Die Daten, für die eine gesetzliche Aufbewahrungspflicht besteht werden für die gesetzlich festgelegte
            Dauer aufbewahrt (10 Jahre nach § 257 Abs. HGB, § 146 Abs. 2 AO).
          </p>
          <p>Logdateien werden nach 7 Tagen gelöscht.</p>
          <p>Sicherungskopien werden nur im Rahmen der jeweils technisch erforderlichen Backup-Retention vorgehalten und danach gelöscht.</p>
        </section>

        <section>
          <h2>11. Ihre Rechte</h2>
          <p>
            Als Nutzer unseres Internet-Angebots haben Sie nach der DSGVO verschiedene Rechte, die sich insbesondere
            aus Art. 15 bis 18, 21 DSGVO ergeben:
          </p>
          <h4>Recht auf Auskunft</h4>
          <p>
            Sie können Auskunft gem. Art. 15 DSGVO über Ihre von uns verarbeiteten personenbezogenen Daten verlangen.
            In Ihrem Auskunftsantrag sollten Sie Ihr Anliegen präzisieren, um uns das Zusammenstellen der
            erforderlichen Daten zu erleichtern. Bitte beachten Sie, dass Ihr Auskunftsrecht unter bestimmten
            Umständen gemäß den gesetzlichen Vorschriften (insbesondere § 34 BDSG) eingeschränkt sein kann.
          </p>
          <h4>Recht auf Berichtigung</h4>
          <p>
            Sollten die Sie betreffenden Angaben nicht (mehr) zutreffend sein, können Sie nach Art. 16 DSGVO eine
            Berichtigung verlangen. Sollten Ihre Daten unvollständig sein, können Sie eine Vervollständigung verlangen.
          </p>
          <h4>Recht auf Löschung</h4>
          <p>
            Sie können unter den Bedingungen des Art. 17 DSGVO die Löschung Ihrer personenbezogenen Daten verlangen.
            Ihr Anspruch auf Löschung hängt u. a. davon ab, ob die Sie betreffenden Daten von uns zur Erfüllung
            unserer gesetzlichen Aufgaben noch benötigt werden.
          </p>
          <h4>Recht auf Einschränkung der Verarbeitung</h4>
          <p>
            Sie haben im Rahmen der Vorgaben des Art. 18 DSGVO das Recht, eine Einschränkung der Verarbeitung der Sie
            betreffenden Daten zu verlangen.
          </p>
          <h4>Recht auf Widerspruch</h4>
          <p>
            Sie haben nach Art. 21 DSGVO das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben,
            jederzeit der Verarbeitung der Sie betreffenden Daten zu widersprechen. Allerdings können wir dem nicht
            immer nachkommen, z. B. wenn uns Rechtsvorschriften im Rahmen unserer amtlichen Aufgabenerfüllung zur
            Verarbeitung verpflichten.
          </p>
          <h4>Recht auf keine ausschließlich automatisierte Entscheidung</h4>
          <p>
            Sie haben das Recht nach Art. 22 DSGVO, nicht einer ausschließlich auf einer automatisierten Verarbeitung –
            einschließlich Profiling – beruhenden Entscheidung unterworfen zu werden, die Ihnen gegenüber rechtliche
            Wirkung entfaltet oder Sie in ähnlicher Weise erheblich beeinträchtigt.
          </p>
          <h4>Recht auf Beschwerde</h4>
          <p>
            Wenn Sie der Auffassung sind, dass wir bei der Verarbeitung Ihrer Daten datenschutzrechtliche Vorschriften
            nicht beachtet haben, können Sie sich jederzeit mit einer Beschwerde an uns wenden.
          </p>
          <h4>Recht auf Beschwerde bei einer Aufsichtsbehörde</h4>
          <p>
            Unbeschadet eines anderweitigen verwaltungsrechtlichen oder gerichtlichen Rechtsbehelfs steht Ihnen das
            Recht auf Beschwerde bei einer Aufsichtsbehörde, insbesondere in dem Mitgliedstaat ihres Aufenthaltsorts,
            ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes, zu, wenn Sie der Ansicht sind, dass die
            Verarbeitung der Sie betreffenden personenbezogenen Daten gegen die DSGVO verstößt.
          </p>
          <p>
            Die Aufsichtsbehörde, bei der die Beschwerde eingereicht wurde, unterrichtet den Beschwerdeführer über den
            Stand und die Ergebnisse der Beschwerde einschließlich der Möglichkeit eines gerichtlichen Rechtsbehelfs
            nach Art. 78 DSGVO.
          </p>
          <p>
            Die für {companyName} zuständige Aufsichtsbehörde ist das Bayerische Landesamt für Datenschutzaufsicht
            (BayLDA). Sie erreichen dieses unter folgenden Kontaktmöglichkeiten:
          </p>
          <p>Bayerisches Landesamt für Datenschutzaufsicht</p>
          <p>Postfach 606</p>
          <p>91511 Ansbach</p>
          <p>Telefon: +49 (0) 981 53 1300</p>
          <p>Telefax: +49 (0) 981 53 98 1300</p>
          <p>E-Mail: poststelle@lda.bayern.de</p>
        </section>
      </div>
    </main>
  );
}
