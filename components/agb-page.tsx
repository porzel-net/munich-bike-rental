import Link from "next/link";

type AgbPageContentProps = {
  locale?: "de" | "en";
};

export function AgbPageContent({ locale = "de" }: AgbPageContentProps) {
  const homePath = `/${locale}/rennradverleih/münchen/maxvorstadt`;

  if (locale === "en") {
    return <EnglishAgbPageContent />;
  }

  return (
    <main className="legal-page legal-page--agb">
      <div className="container legal-page__inner">
        <Link className="legal-page__back" href={homePath}>
          Zurück zur Startseite
        </Link>

        <h1>Allgemeine Geschäftsbedingungen für die Vermietung von Fahrrädern</h1>
        <p>
          <strong>Version:</strong> [27.07.2026]
        </p>

        <section>
          <h2>Anbieter und Verleiher</h2>
          <p>Your Bike Rental</p>
          <p>Inhaber: Julius Porzel</p>
          <p>Julius Porzel</p>
          <p>hallo@munich-bike-rental.de</p>
          <p>Nachfolgend „Verleiher“ genannt.</p>
        </section>

        <section>
          <h2>1. Geltungsbereich und Vertragsgrundlagen</h2>
          <p>
            1.1 Diese Allgemeinen Geschäftsbedingungen gelten für sämtliche Verträge über die Vermietung von Fahrrädern
            und dem jeweils vereinbarten Zubehör durch den Verleiher.
          </p>
          <p>
            1.2 Die Allgemeinen Geschäftsbedingungen gelten gegenüber Verbrauchern und Unternehmern. Verbraucher ist
            jede natürliche Person, die den Vertrag überwiegend zu Zwecken abschließt, die weder ihrer gewerblichen noch
            ihrer selbstständigen beruflichen Tätigkeit zugerechnet werden können.
          </p>
          <p>
            1.3 Die individuellen Vertragsdaten ergeben sich aus der jeweiligen Reservierungs- beziehungsweise
            Buchungsbestätigung. Dazu gehören insbesondere:
          </p>
          <ul className="legal-page__list">
            <li>Name und Kontaktdaten des Mieters,</li>
            <li>Fahrradtyp und Modell,</li>
            <li>Fahrrad- oder Rahmennummer,</li>
            <li>vereinbartes Zubehör,</li>
            <li>bekannte Besonderheiten oder vorhandene Beschädigungen,</li>
            <li>Mietbeginn und Mietende,</li>
            <li>Übergabe- und Rückgabeort,</li>
            <li>Mietpreis,</li>
            <li>Kaution</li>
          </ul>
          <p>
            1.4 Die Reservierungs- beziehungsweise Buchungsbestätigung und diese Allgemeinen Geschäftsbedingungen bilden
            gemeinsam den Mietvertrag.
          </p>
          <p>
            1.5 Individuelle Vereinbarungen zwischen dem Verleiher und dem Mieter haben Vorrang vor diesen Allgemeinen
            Geschäftsbedingungen.
          </p>
        </section>

        <section>
          <h2>2. Anfrage, Reservierung und Vertragsschluss</h2>
          <p>
            2.1 Die Darstellung von Fahrrädern, Preisen und Verfügbarkeiten auf der Website stellt noch kein
            verbindliches Vertragsangebot des Verleihers dar.
          </p>
          <p>
            2.2 Eine über die Website, telefonisch, per E-Mail oder über ein anderes Kommunikationsmittel übermittelte
            Anfrage des Kunden ist zunächst unverbindlich, sofern sie ausdrücklich als unverbindliche Anfrage
            gekennzeichnet ist.
          </p>
          <p>
            2.3 Nach der Abstimmung der Mietdaten erhält der Kunde eine Zusammenfassung der wesentlichen Vertragsdaten.
            Der Kunde erhält vor Vertragsschluss die Möglichkeit, diese Allgemeinen Geschäftsbedingungen einzusehen,
            herunterzuladen und zu speichern.
          </p>
          <p>2.4 Der Mietvertrag kommt erst zustande, wenn:</p>
          <ol className="legal-page__list legal-page__list--alpha">
            <li>a) die individuellen Mietdaten zwischen dem Verleiher und dem Mieter abgestimmt wurden,</li>
            <li>b) der Mieter die Geltung dieser Allgemeinen Geschäftsbedingungen bestätigt hat,</li>
            <li>c) die vereinbarte Zahlung vollständig beim Verleiher eingegangen ist und</li>
            <li>d) der Verleiher die Reservierung anschließend per E-Mail endgültig bestätigt hat.</li>
          </ol>
          <p>
            2.5 Die bloße Übermittlung einer Anfrage, eine automatisierte Eingangsbestätigung oder die Mitteilung
            vorläufiger Verfügbarkeit stellt noch keine endgültige Reservierungsbestätigung dar.
          </p>
          <p>2.6 Die endgültige Reservierungsbestätigung enthält oder bezeichnet mindestens:</p>
          <ul className="legal-page__list">
            <li>das vermietete Fahrrad,</li>
            <li>den vereinbarten Mietzeitraum,</li>
            <li>den Übergabe- und Rückgabeort,</li>
            <li>den Gesamtmietpreis,</li>
            <li>die Kaution,</li>
            <li>das vereinbarte Zubehör,</li>
            <li>einen gegebenenfalls gebuchten Schadensschutz,</li>
            <li>die bei Vertragsschluss geltende Version dieser Allgemeinen Geschäftsbedingungen.</li>
          </ul>
        </section>

        <section>
          <h2>3. Mietgegenstand und Eigentum</h2>
          <p>
            3.1 Vermietet werden das in der Reservierungsbestätigung bezeichnete Fahrrad und das dort aufgeführte
            Zubehör.
          </p>
          <p>3.2 Das Fahrrad und das Zubehör bleiben während der gesamten Mietzeit Eigentum des Verleihers.</p>
          <p>
            3.3 Der Mieter darf das Fahrrad weder verkaufen, verpfänden, verschenken noch einem Dritten sonst dauerhaft
            überlassen.
          </p>
          <p>
            3.4 Eine Weitergabe des Fahrrads an Dritte oder eine Untervermietung ist nur mit vorheriger ausdrücklicher
            Zustimmung des Verleihers zulässig.
          </p>
          <p>
            3.5 Der Mieter hat das Fahrrad einschließlich des überlassenen Zubehörs zum vereinbarten Mietende
            vollständig zurückzugeben.
          </p>
        </section>

        <section>
          <h2>4. Voraussetzungen des Mieters</h2>
          <p>4.1 Mieter müssen grundsätzlich das 18. Lebensjahr vollendet haben.</p>
          <p>
            4.2 Eine Vermietung zur Nutzung durch Minderjährige ist nur zulässig, wenn der Verleiher vorher ausdrücklich
            zugestimmt hat und ein gesetzlicher Vertreter den Mietvertrag wirksam abschließt oder dem Vertrag in der vom
            Verleiher verlangten Form zustimmt.
          </p>
          <p>
            4.3 Der Verleiher kann verlangen, dass ein gesetzlicher Vertreter selbst als Mieter oder weiterer
            Vertragspartner auftritt.
          </p>
          <p>4.4 Der Mieter muss körperlich und geistig in der Lage sein, das Fahrrad sicher zu führen.</p>
          <p>
            4.5 Der Mieter ist verpflichtet, wahrheitsgemäße und vollständige Angaben zu seiner Person und zu den für
            die Vermietung erforderlichen Kontaktdaten zu machen.
          </p>
          <p>
            4.6 Der Verleiher ist berechtigt, vor der Übergabe einen gültigen amtlichen Lichtbildausweis einzusehen. Die
            Verarbeitung der hierbei erhobenen Daten richtet sich nach der Datenschutzerklärung des Verleihers.
          </p>
        </section>

        <section>
          <h2>5. Mietpreis, Zahlung und Kaution</h2>
          <p>
            5.1 Der Mietpreis, die Zahlungsmodalitäten und die Höhe der Kaution ergeben sich aus der
            Reservierungsbestätigung.
          </p>
          <p>
            5.2 Soweit nichts anderes vereinbart wurde, ist der vollständige Mietpreis vor der endgültigen
            Reservierungsbestätigung zu zahlen.
          </p>
          <p>
            5.3 Die Kaution ist spätestens vor oder bei Übergabe des Fahrrads über die vereinbarte Zahlungsart zu
            leisten.
          </p>
          <p>
            5.4 Die Kaution dient der Sicherung fälliger Ansprüche des Verleihers aus dem Mietverhältnis. Sie stellt
            keine Haftungsobergrenze dar.
          </p>
          <p>
            5.5 Nach vollständiger Rückgabe und Prüfung des Fahrrads und des Zubehörs wird die Kaution unverzüglich
            freigegeben oder zurückgezahlt, soweit keine konkreten offenen Ansprüche des Verleihers bestehen.
          </p>
          <p>
            5.6 Bestehen bei der Rückgabe konkrete Anhaltspunkte für einen vom Mieter zu vertretenden Schaden, Verlust,
            fehlendes Zubehör oder sonstige offene Ansprüche, darf der Verleiher einen angemessenen Teil der Kaution bis
            zur Klärung vorläufig zurückbehalten.
          </p>
          <p>
            5.7 Der Verleiher informiert den Mieter über den Grund des vorläufigen Einbehalts. Ein nach abschließender
            Klärung verbleibender Kautionsbetrag wird unverzüglich freigegeben oder zurückgezahlt.
          </p>
          <p>
            5.8 Der Verleiher darf fällige und nach Grund und Höhe feststehende Ansprüche mit dem Anspruch des Mieters
            auf Rückzahlung der Kaution verrechnen.
          </p>
        </section>

        <section>
          <h2>6. Übergabe und Zustandsdokumentation</h2>
          <p>
            6.1 Das Fahrrad wird dem Mieter grundsätzlich in einem für den vereinbarten Gebrauch geeigneten und
            betriebsbereiten Zustand übergeben, soweit in der Reservierungsbestätigung nichts Abweichendes angegeben
            ist.
          </p>
          <p>
            6.2 Das Fahrrad wird vor der Übergabe durch Foto- oder Videoaufnahmen dokumentiert. Die Dokumentation kann
            insbesondere den Zustand folgender Bereiche umfassen:
          </p>
          <ul className="legal-page__list">
            <li>Rahmen und Gabel,</li>
            <li>Laufräder und Reifen,</li>
            <li>Lenker und Vorbau,</li>
            <li>Sattel und Sattelstütze,</li>
            <li>Schaltung und Antrieb,</li>
            <li>Bremsen,</li>
            <li>elektronische Komponenten,</li>
            <li>Zubehör,</li>
            <li>bereits vorhandene Kratzer oder sonstige Beschädigungen.</li>
          </ul>
          <p>
            6.3 Das konkrete Fahrrad, die Fahrrad- oder Rahmennummer, das Zubehör und bekannte Besonderheiten oder
            Beschädigungen werden in der Reservierungsbestätigung oder einer ergänzenden Übergabedokumentation
            aufgeführt.
          </p>
          <p>
            6.4 Dem Mieter wird bei der Übergabe Gelegenheit gegeben, das Fahrrad in zumutbarem Umfang zu besichtigen
            und die wesentlichen Funktionen zu prüfen.
          </p>
          <p>
            6.5 Erkennbare Abweichungen von der Reservierungsbestätigung oder der Zustandsdokumentation soll der Mieter
            unverzüglich bei der Übergabe mitteilen.
          </p>
          <p>
            6.6 Mängel, die bei einer zumutbaren Prüfung nicht erkennbar waren, sind dem Verleiher unverzüglich nach
            ihrer Feststellung mitzuteilen.
          </p>
          <p>
            6.7 Die Foto- oder Videodokumentation und die Feststellungen bei der Übergabe und Rückgabe können zur
            Feststellung des jeweiligen Zustands herangezogen werden. Eine von den gesetzlichen Regelungen abweichende
            Beweislastumkehr ist damit nicht verbunden.
          </p>
        </section>

        <section>
          <h2>7. Nutzung des Fahrrads</h2>
          <p>
            7.1 Der Mieter verpflichtet sich, das Fahrrad sorgfältig, bestimmungsgemäß und entsprechend seiner Bauart zu
            verwenden.
          </p>
          <p>7.2 Der Mieter ist insbesondere verpflichtet:</p>
          <ul className="legal-page__list">
            <li>die geltenden Straßenverkehrsvorschriften einzuhalten,</li>
            <li>seine Fahrweise den Straßen-, Verkehrs- und Witterungsverhältnissen anzupassen,</li>
            <li>die angegebenen Gewichtsgrenzen für Fahrer und Gepäck einzuhalten,</li>
            <li>das Fahrrad vor jeder Fahrt einer kurzen Sichtprüfung zu unterziehen,</li>
            <li>erkennbare sicherheitsrelevante Beeinträchtigungen unverzüglich dem Verleiher mitzuteilen,</li>
            <li>die Anweisungen des Verleihers zur Bedienung und Nutzung zu beachten.</li>
          </ul>
          <p>7.3 Untersagt sind insbesondere:</p>
          <ul className="legal-page__list">
            <li>
              die Teilnahme an Rennen, Wettkämpfen oder Zeitfahrveranstaltungen ohne vorherige ausdrückliche Zustimmung
              des Verleihers,
            </li>
            <li>Sprünge, Stunts oder vergleichbare Belastungen,</li>
            <li>die Nutzung in Bikeparks oder auf technisch anspruchsvollen Trails,</li>
            <li>die Nutzung eines Rennrads auf unbefestigten oder für Rennräder ungeeigneten Wegen,</li>
            <li>eine Nutzung unter Alkohol-, Drogen- oder sonstigem berauschendem Einfluss,</li>
            <li>
              die Verwendung zur Beförderung weiterer Personen, sofern das Fahrrad hierfür nicht ausdrücklich vorgesehen
              ist,
            </li>
            <li>das Ziehen eines Anhängers ohne vorherige Zustimmung,</li>
            <li>die Nutzung zu rechtswidrigen Zwecken.</li>
          </ul>
          <p>
            7.4 Der Mieter darf ohne vorherige Zustimmung des Verleihers keine technischen Veränderungen, Umbauten oder
            Demontagen vornehmen. Dies betrifft insbesondere:
          </p>
          <ul className="legal-page__list">
            <li>Bremsen,</li>
            <li>Schaltung,</li>
            <li>Laufräder,</li>
            <li>Lenker,</li>
            <li>Vorbau,</li>
            <li>Sattelstütze,</li>
            <li>elektronische Komponenten,</li>
            <li>Pedale und sonstige Anbauteile.</li>
          </ul>
          <p>
            7.5 Der Mieter darf das Fahrrad nur selbst nutzen. Eine Nutzung durch andere Personen ist nur nach
            vorheriger ausdrücklicher Zustimmung des Verleihers zulässig.
          </p>
        </section>

        <section>
          <h2>8. Verpflichtende Aufbewahrung in einem gesicherten Innenraum</h2>
          <p>
            8.1 Das Fahrrad darf außerhalb der unmittelbaren Nutzung nicht unbeaufsichtigt im öffentlichen Raum, im
            Freien oder in einem allgemein zugänglichen Bereich abgestellt werden. Dies gilt auch dann, wenn das Fahrrad
            mit einem Schloss gesichert wird.
          </p>
          <p>
            8.2 Wird das Fahrrad nicht unmittelbar genutzt, muss es in einem abgeschlossenen, nicht allgemein
            zugänglichen Innenraum aufbewahrt werden, der vor dem Zugriff unbefugter Dritter geschützt ist.
          </p>
          <p>8.3 Als geeigneter Innenraum gelten insbesondere:</p>
          <ul className="legal-page__list">
            <li>eine abgeschlossene private Wohnung/Garage,</li>
            <li>ein abgeschlossenes Haus,</li>
            <li>ein abgeschlossenes Hotel- oder Gästezimmer,</li>
            <li>
              ein individuell abschließbarer Abstellraum, zu dem nur der Mieter oder ausdrücklich von ihm autorisierte
              Personen Zugang haben.
            </li>
          </ul>
          <p>8.4 Nicht als ausreichend gesichert gelten insbesondere:</p>
          <ul className="legal-page__list">
            <li>öffentliche oder allgemein zugängliche Fahrradabstellanlagen,</li>
            <li>offene Innenhöfe,</li>
            <li>gemeinschaftlich genutzte Treppenhäuser,</li>
            <li>gemeinschaftlich genutzte Tiefgaragen,</li>
            <li>gemeinschaftliche Hotel-Fahrradräume,</li>
            <li>Bahnhöfe,</li>
            <li>öffentliche Parkhäuser,</li>
            <li>sonstige Bereiche, zu denen ein nicht individuell begrenzter Personenkreis Zugang hat.</li>
          </ul>
          <p>
            8.5 Steht kein geeigneter Innenraum zur Verfügung, darf das Fahrrad nicht unbeaufsichtigt zurückgelassen
            werden.
          </p>
          <p>
            8.6 Der Mieter hat sich bereits vor Vertragsschluss und vor Übernahme des Fahrrads zu vergewissern, dass ihm
            während der Mietzeit eine den vorstehenden Anforderungen entsprechende Aufbewahrungsmöglichkeit zur
            Verfügung steht.
          </p>
        </section>

        <section>
          <h2>9. Verhalten bei Unfall, Beschädigung, Diebstahl oder Verlust</h2>
          <p>
            9.1 Unfälle, Beschädigungen, Diebstahl, Verlust und sonstige erhebliche Ereignisse sind dem Verleiher
            unverzüglich mitzuteilen.
          </p>
          <p>9.2 Bei einem Unfall hat der Mieter, soweit möglich und zumutbar, folgende Angaben festzuhalten:</p>
          <ul className="legal-page__list">
            <li>Zeitpunkt und Ort,</li>
            <li>Unfallhergang,</li>
            <li>Namen und Kontaktdaten beteiligter Personen,</li>
            <li>Namen und Kontaktdaten von Zeugen,</li>
            <li>Kennzeichen beteiligter Fahrzeuge,</li>
            <li>gegebenenfalls das polizeiliche Akten- oder Vorgangszeichen,</li>
            <li>aussagekräftige Fotoaufnahmen.</li>
          </ul>
          <p>
            9.3 Bei Diebstahl oder Verlust hat der Mieter unverzüglich Anzeige bei der zuständigen Polizei zu erstatten.
          </p>
          <p>
            9.4 Dem Verleiher sind die polizeiliche Vorgangsnummer und eine nachvollziehbare Schilderung des Ereignisses
            zu übermitteln.
          </p>
          <p>
            9.5 Sämtliche vorhandenen Schlüssel, Schlösser und sonstigen Sicherungsmittel sind dem Verleiher
            auszuhändigen.
          </p>
          <p>9.6 Der Mieter darf gegenüber Dritten kein Schuldanerkenntnis im Namen des Verleihers abgeben.</p>
        </section>

        <section>
          <h2>10. Haftung des Mieters</h2>
          <p>
            10.1 Der Mieter haftet nach den gesetzlichen Vorschriften für Schäden, Verlust oder Diebstahl des Fahrrads
            und des Zubehörs, soweit er diese zu vertreten hat.
          </p>
          <p>
            10.2 Eine Haftung besteht insbesondere, wenn ein Schaden durch eine vorsätzliche oder fahrlässige Verletzung
            der vertraglichen Nutzungs-, Sicherungs-, Aufbewahrungs- oder Mitteilungspflichten verursacht wurde.
          </p>
          <p>
            10.3 Der Mieter haftet nicht allein deshalb, weil ein Schaden während seiner Mietzeit festgestellt wurde.
            Die gesetzlichen Regelungen zur Darlegungs- und Beweislast bleiben unberührt.
          </p>
          <p>
            10.4 Gewöhnliche Abnutzung und Verschlechterungen, die durch den vertragsgemäßen Gebrauch entstehen, hat der
            Mieter nicht zu vertreten.
          </p>
          <p>
            10.5 Der Mieter haftet nicht für bereits bei der Übergabe vorhandene und dokumentierte Schäden oder Mängel.
          </p>
          <p>
            10.6 Soweit kein Schadensschutz nach Ziffer 11 vereinbart wurde oder der Schadensschutz aufgrund der dort
            genannten Voraussetzungen nicht greift, richtet sich der Umfang der Haftung nach den gesetzlichen
            Vorschriften.
          </p>
        </section>

        <section>
          <h2>11. Vertraglicher Schadensschutz und Haftungsbegrenzung</h2>
          <p>
            11.1 Der vertragliche Schadensschutz gilt nur, wenn er in der Reservierungsbestätigung ausdrücklich als
            gebucht oder im Mietpreis enthalten ausgewiesen ist.
          </p>
          <p>11.2 Der Schadensschutz ist eine vertragliche Haftungsreduzierung und keine Versicherung.</p>
          <p>
            11.3 Soweit der Mieter nach den gesetzlichen Vorschriften haftet, wird seine Haftung bei einfach fahrlässig
            verursachten reparierbaren Sachschäden am Mietfahrrad auf <strong>100,00 € je Schadensereignis</strong>{" "}
            begrenzt.
          </p>
          <p>
            11.4 Bei einem wirtschaftlichen Totalschaden, Verlust oder Diebstahl wird die Haftung des Mieters auf{" "}
            <strong>300,00 € je Schadensereignis</strong> begrenzt, soweit der Mieter nach den gesetzlichen Vorschriften
            haftet und sämtliche Voraussetzungen des Schadensschutzes erfüllt sind.
          </p>
          <p>
            11.5 Mehrere Schäden, die auf demselben einheitlichen Ereignis beruhen, gelten als ein Schadensereignis.
            Schäden aus voneinander unabhängigen Ereignissen gelten als separate Schadensereignisse.
          </p>
          <p>11.6 Voraussetzung für die Haftungsbegrenzung bei Diebstahl oder Verlust ist insbesondere, dass:</p>
          <ul className="legal-page__list">
            <li>das Fahrrad entsprechend Ziffer 8 in einem geeigneten gesicherten Innenraum aufbewahrt wurde,</li>
            <li>der Mieter den Verleiher unverzüglich informiert hat,</li>
            <li>unverzüglich eine polizeiliche Anzeige erstattet wurde,</li>
            <li>die polizeiliche Vorgangsnummer vorgelegt wurde,</li>
            <li>sämtliche noch vorhandenen Schlüssel und Sicherungsmittel zurückgegeben wurden.</li>
          </ul>
          <p>
            11.7 Die Haftungsbegrenzung gilt nicht, soweit der Schaden, Verlust oder Diebstahl verursacht oder
            wesentlich begünstigt wurde durch:
          </p>
          <ul className="legal-page__list">
            <li>Vorsatz oder grobe Fahrlässigkeit,</li>
            <li>Alkohol-, Drogen- oder sonstigen berauschenden Einfluss,</li>
            <li>eine unerlaubte Weitergabe des Fahrrads an Dritte,</li>
            <li>eine nicht genehmigte Untervermietung,</li>
            <li>eine Teilnahme an Rennen, Wettkämpfen oder sonstigen nicht genehmigten Veranstaltungen,</li>
            <li>eine Nutzung außerhalb des vereinbarten Nutzungsbereichs,</li>
            <li>eine vorsätzliche oder grob fahrlässige Verletzung der Aufbewahrungs- oder Sicherungspflichten,</li>
            <li>nicht genehmigte technische Veränderungen,</li>
            <li>das Nichtanzeigen eines Diebstahls bei der Polizei,</li>
            <li>falsche oder unvollständige Angaben zum Schadenshergang.</li>
          </ul>
          <p>
            11.8 Der Ausschluss oder die Einschränkung des Schadensschutzes gilt nur, soweit die jeweilige
            Pflichtverletzung für den Eintritt oder den Umfang des Schadens ursächlich war oder die Aufklärung des
            Schadens wesentlich erschwert hat.
          </p>
          <p>
            11.9 Gewöhnliche Abnutzung und Verschlechterungen, die durch den vertragsgemäßen Gebrauch entstehen, hat der
            Mieter nicht zu vertreten und sie fallen nicht unter die Selbstbeteiligung.
          </p>
          <p>
            11.10 Die Haftungsbegrenzung gilt ausschließlich für Schäden am Mietfahrrad und dem ausdrücklich vom
            Schadensschutz erfassten Zubehör. Sie gilt nicht für:
          </p>
          <ul className="legal-page__list">
            <li>Personenschäden,</li>
            <li>Schäden an fremden Sachen,</li>
            <li>Ansprüche Dritter,</li>
            <li>Bußgelder oder Verwarnungsgelder,</li>
            <li>Kosten aufgrund vorsätzlich falscher Angaben,</li>
            <li>sonstige Schäden außerhalb des Mietfahrrads.</li>
          </ul>
        </section>

        <section>
          <h2>12. Rückgabe und verspätete Rückgabe</h2>
          <p>
            12.1 Das Fahrrad und das vereinbarte Zubehör sind spätestens zu dem in der Reservierungsbestätigung
            genannten Zeitpunkt am vereinbarten Rückgabeort zurückzugeben.
          </p>
          <p>
            12.2 Eine Verlängerung der Mietzeit ist nur nach vorheriger ausdrücklicher Zustimmung des Verleihers
            zulässig.
          </p>
          <p>
            12.3 Der Mieter muss eine absehbare Verspätung unverzüglich mitteilen. Die Mitteilung allein bewirkt keine
            Verlängerung des Mietvertrags.
          </p>
          <p>
            12.4 Bei verspäteter Rückgabe kann der Verleiher für die zusätzliche Nutzungsdauer den hierfür vereinbarten
            oder nach der gültigen Preisliste berechneten anteiligen Mietpreis verlangen.
          </p>
          <p>
            12.5 Darüber hinausgehende Schäden, insbesondere konkret nachgewiesene Ausfälle einer Anschlussvermietung,
            können nach den gesetzlichen Vorschriften verlangt werden, soweit der Mieter die verspätete Rückgabe zu
            vertreten hat.
          </p>
          <p>
            12.6 Ersparte Aufwendungen und Einnahmen aus einer möglichen anderweitigen Vermietung werden angerechnet.
          </p>
          <p>
            12.7 Das Fahrrad ist einschließlich des in der Reservierungsbestätigung aufgeführten Zubehörs vollständig
            zurückzugeben.
          </p>
        </section>

        <section>
          <h2>13. Stornierung durch den Mieter</h2>
          <p>13.1 Die folgenden Stornierungsbedingungen gelten erst, nachdem:</p>
          <ul className="legal-page__list">
            <li>der Mietvertrag nach Ziffer 2.4 wirksam zustande gekommen ist,</li>
            <li>die Reservierung vom Verleiher endgültig per E-Mail bestätigt wurde und</li>
            <li>die vereinbarte Zahlung vollständig eingegangen ist.</li>
          </ul>
          <p>
            13.2 Eine Stornierung muss in Textform, insbesondere per E-Mail, gegenüber dem Verleiher erklärt werden.
          </p>
          <p>13.3 Maßgeblich für die Berechnung der Stornierungsfrist ist der Zugang der Stornierung beim Verleiher.</p>
          <p>13.4 Bei einer Stornierung werden folgende pauschalierte Stornierungskosten berechnet:</p>
          <p>
            a) <strong>Mehr als 168 Stunden (entspricht 7 Tage) vor dem vereinbarten Mietbeginn:</strong>
            <br />
            25 % des vereinbarten Mietpreises.
            <br />
            Der Mieter erhält 75 % des bereits gezahlten Mietpreises zurück.
          </p>
          <p>
            b){" "}
            <strong>Ab 168 (entspricht 7 Tage) Stunden bis mehr als 24 Stunden vor dem vereinbarten Mietbeginn:</strong>
            <br />
            50 % des vereinbarten Mietpreises.
            <br />
            Der Mieter erhält 50 % des bereits gezahlten Mietpreises zurück.
          </p>
          <p>
            c) <strong>24 Stunden oder weniger vor dem vereinbarten Mietbeginn sowie bei Nichterscheinen:</strong>
            <br />
            100 % des vereinbarten Mietpreises.
            <br />
            Eine Rückerstattung erfolgt nicht.
          </p>
          <p>
            13.5 Dem Mieter bleibt ausdrücklich der Nachweis vorbehalten, dass dem Verleiher durch die Stornierung kein
            Schaden oder ein wesentlich geringerer Schaden entstanden ist.
          </p>
          <p>
            13.6 Bei einer vorzeitigen freiwilligen Rückgabe des Fahrrads besteht grundsätzlich kein Anspruch auf
            anteilige Erstattung des Mietpreises. Zwingende gesetzliche Ansprüche des Mieters bleiben unberührt.
          </p>
          <p>
            13.7 Ein gegebenenfalls bestehendes gesetzliches Widerrufsrecht bleibt von diesen Stornierungsbedingungen
            unberührt.
          </p>
          <p>
            13.8 Soweit für eine Vermietung zu einem konkreten Termin oder Zeitraum aufgrund der gesetzlichen
            Vorschriften kein Widerrufsrecht besteht, gelten ausschließlich die gesetzlichen Rechte und die vorstehenden
            vertraglichen Stornierungsbedingungen.
          </p>
        </section>

        <section>
          <h2>14. Außergewöhnliche Verschmutzung</h2>
          <p>
            14.1 Eine gewöhnliche, durch den vertragsgemäßen Gebrauch verursachte Verschmutzung ist mit dem Mietpreis
            abgegolten.
          </p>
          <p>
            14.2 Bei einer außergewöhnlichen Verschmutzung kann der Verleiher die erforderlichen und angemessenen
            Reinigungskosten verlangen, soweit der Mieter die Verschmutzung zu vertreten hat.
          </p>
          <p>14.3 Als außergewöhnliche Verschmutzung gelten insbesondere erhebliche Verunreinigungen durch:</p>
          <ul className="legal-page__list">
            <li>Schlamm,</li>
            <li>Öl oder Schmierstoffe außerhalb der üblichen Antriebsspuren,</li>
            <li>Farbe,</li>
            <li>Klebstoffe,</li>
            <li>Getränke oder Lebensmittel,</li>
            <li>sonstige schwer entfernbare Substanzen.</li>
          </ul>
          <p>14.4 Eine pauschale Reinigungsgebühr wird nicht allein aufgrund gewöhnlicher Gebrauchsspuren erhoben.</p>
        </section>

        <section>
          <h2>15. Haftung des Verleihers</h2>
          <p>
            15.1 Der Verleiher haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der
            Gesundheit, die auf einer vorsätzlichen oder fahrlässigen Pflichtverletzung des Verleihers, seiner
            gesetzlichen Vertreter oder seiner Erfüllungsgehilfen beruhen.
          </p>
          <p>15.2 Für sonstige Schäden haftet der Verleiher unbeschränkt bei Vorsatz und grober Fahrlässigkeit.</p>
          <p>
            15.3 Bei einer einfach fahrlässigen Verletzung einer wesentlichen Vertragspflicht haftet der Verleiher für
            den vertragstypischen und bei Vertragsschluss vorhersehbaren Schaden.
          </p>
          <p>
            15.4 Wesentliche Vertragspflichten sind solche Pflichten, deren Erfüllung die ordnungsgemäße Durchführung
            des Mietvertrags überhaupt erst ermöglicht und auf deren Einhaltung der Mieter regelmäßig vertrauen darf.
          </p>
          <p>15.5 Die gesetzlichen Ansprüche des Mieters wegen eines Mangels des Fahrrads bleiben unberührt.</p>
          <p>
            15.6 Der Verleiher haftet nicht für Schäden, die ausschließlich auf einer unsachgemäßen Nutzung, der
            Missachtung von Bedienungs- oder Sicherheitshinweisen oder einer sonstigen vom Mieter zu vertretenden
            Pflichtverletzung beruhen.
          </p>
        </section>

        <section>
          <h2>16. Datenschutz</h2>
          <p>
            16.1 Der Verleiher verarbeitet personenbezogene Daten des Mieters, soweit dies zur Anbahnung, Durchführung,
            Abwicklung und Dokumentation des Mietverhältnisses erforderlich ist.
          </p>
          <p>16.2 Dies kann insbesondere folgende Daten betreffen:</p>
          <ul className="legal-page__list">
            <li>Name und Kontaktdaten,</li>
            <li>Anschrift und Geburtsdatum,</li>
            <li>Buchungs- und Zahlungsdaten,</li>
            <li>Daten zur Identitätsprüfung,</li>
            <li>Kommunikation im Zusammenhang mit der Reservierung,</li>
            <li>Foto- oder Videoaufnahmen zur Dokumentation des Fahrradzustands,</li>
            <li>Angaben zu Unfällen, Schäden, Diebstählen oder Verlusten.</li>
          </ul>
          <p>
            16.3 Weitere Informationen über Art, Umfang, Rechtsgrundlagen, Speicherdauer, Empfänger und Rechte der
            betroffenen Personen enthält die Datenschutzerklärung des Verleihers:
          </p>
          <p>
            <strong>[Link zur Datenschutzerklärung einfügen]</strong>
          </p>
          <p>
            16.4 Die Foto- und Videoaufnahmen dienen grundsätzlich der Dokumentation des Zustands des Fahrrads. Unnötige
            Aufnahmen des Mieters oder anderer identifizierbarer Personen sollen vermieden werden.
          </p>
        </section>

        <section>
          <h2>17. Anwendbares Recht und Gerichtsstand</h2>
          <p>17.1 Es gilt das Recht der Bundesrepublik Deutschland.</p>
          <p>
            17.2 Gegenüber Verbrauchern gilt diese Rechtswahl nur insoweit, als hierdurch zwingende
            Verbraucherschutzvorschriften des Staates, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat, nicht
            entzogen werden.
          </p>
          <p>17.3 Der Gerichtsstand richtet sich nach den gesetzlichen Vorschriften.</p>
        </section>

        <section>
          <h2>18. Schlussbestimmungen</h2>
          <p>
            18.1 Individuelle Vereinbarungen haben Vorrang vor diesen Allgemeinen Geschäftsbedingungen. Dies gilt
            unabhängig davon, ob die individuelle Vereinbarung schriftlich, in Textform oder in anderer nachweisbarer
            Weise getroffen wurde.
          </p>
          <p>
            18.2 Sollte eine Bestimmung dieser Allgemeinen Geschäftsbedingungen ganz oder teilweise unwirksam sein oder
            werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
          </p>
          <p>18.3 An die Stelle einer unwirksamen Bestimmung treten die gesetzlichen Vorschriften.</p>
          <p>
            18.4 Der Verleiher speichert die bei Vertragsschluss geltende Fassung der Allgemeinen Geschäftsbedingungen
            zusammen mit den Buchungsdaten. Der Mieter erhält die Möglichkeit, die für seinen Vertrag geltende Fassung
            zu speichern.
          </p>
        </section>
      </div>
    </main>
  );
}

function EnglishAgbPageContent() {
  return (
    <main className="legal-page legal-page--agb">
      <div className="container legal-page__inner">
        <Link className="legal-page__back" href="/en/rennradverleih/münchen/maxvorstadt">
          Back to homepage
        </Link>

        <h1>General Terms and Conditions for the Rental of Bicycles</h1>
        <p>
          <strong>Version:</strong> [27.07.2026]
        </p>

        <section>
          <h2>Provider and Lessor</h2>
          <p>Your Bike Rental</p>
          <p>Owner: Julius Porzel</p>
          <p>Julius Porzel</p>
          <p>hallo@munich-bike-rental.de</p>
          <p>Hereinafter referred to as the “Lessor”.</p>
        </section>

        <section>
          <h2>1. Scope and Contractual Basis</h2>
          <p>
            1.1 These General Terms and Conditions apply to all contracts for the rental of bicycles and the accessories
            agreed in each case by the Lessor.
          </p>
          <p>
            1.2 These General Terms and Conditions apply to consumers and entrepreneurs. A consumer is any natural
            person who enters into the contract predominantly for purposes that cannot be attributed to their commercial
            or self-employed professional activity.
          </p>
          <p>
            1.3 The individual contract details are set out in the respective reservation or booking confirmation. These
            include in particular:
          </p>
          <ul className="legal-page__list">
            <li>the Tenant’s name and contact details,</li>
            <li>bicycle type and model,</li>
            <li>bicycle or frame number,</li>
            <li>agreed accessories,</li>
            <li>known special features or existing damage,</li>
            <li>rental start and end,</li>
            <li>handover and return location,</li>
            <li>rental price,</li>
            <li>deposit</li>
          </ul>
          <p>
            1.4 The reservation or booking confirmation and these General Terms and Conditions together form the rental
            agreement.
          </p>
          <p>
            1.5 Individual agreements between the Lessor and the Tenant take precedence over these General Terms and
            Conditions.
          </p>
        </section>

        <section>
          <h2>2. Inquiry, Reservation and Conclusion of Contract</h2>
          <p>
            2.1 The presentation of bicycles, prices and availability on the website does not yet constitute a binding
            offer by the Lessor.
          </p>
          <p>
            2.2 An inquiry submitted by the customer via the website, by telephone, by email or through another means of
            communication is initially non-binding, provided that it is expressly identified as a non-binding inquiry.
          </p>
          <p>
            2.3 After the rental details have been coordinated, the customer will receive a summary of the essential
            contractual details. Before concluding the contract, the customer will have the opportunity to view,
            download and save these General Terms and Conditions.
          </p>
          <p>2.4 The rental agreement is only concluded when:</p>
          <ol className="legal-page__list legal-page__list--alpha">
            <li>a) the individual rental details have been agreed between the Lessor and the Tenant,</li>
            <li>b) the Tenant has confirmed the validity of these General Terms and Conditions,</li>
            <li>c) the agreed payment has been received in full by the Lessor, and</li>
            <li>d) the Lessor has subsequently confirmed the reservation by email.</li>
          </ol>
          <p>
            2.5 The mere submission of an inquiry, an automated confirmation of receipt or notification of provisional
            availability does not yet constitute a final reservation confirmation.
          </p>
          <p>2.6 The final reservation confirmation contains or identifies at least:</p>
          <ul className="legal-page__list">
            <li>the rented bicycle,</li>
            <li>the agreed rental period,</li>
            <li>the handover and return location,</li>
            <li>the total rental price,</li>
            <li>the deposit,</li>
            <li>the agreed accessories,</li>
            <li>any damage protection booked,</li>
            <li>
              the version of these General Terms and Conditions applicable at the time the contract was concluded.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Rental Object and Ownership</h2>
          <p>
            3.1 The rented bicycle and the accessories listed in the reservation confirmation are the rental objects.
          </p>
          <p>
            3.2 The bicycle and the accessories remain the property of the Lessor throughout the entire rental period.
          </p>
          <p>
            3.3 The Tenant may neither sell, pledge or give away the bicycle nor otherwise permanently transfer it to a
            third party.
          </p>
          <p>
            3.4 The bicycle may only be transferred to third parties or sublet with the Lessor’s prior express consent.
          </p>
          <p>
            3.5 The Tenant must return the bicycle, including the accessories provided, in full at the agreed end of the
            rental period.
          </p>
        </section>

        <section>
          <h2>4. Tenant Requirements</h2>
          <p>4.1 Tenants must generally have reached the age of 18.</p>
          <p>
            4.2 Rental for use by minors is only permitted if the Lessor has given prior express consent and a legal
            representative validly concludes the rental agreement or consents to the agreement in the form required by
            the Lessor.
          </p>
          <p>
            4.3 The Lessor may require a legal representative to act as the Tenant or as an additional contractual
            partner.
          </p>
          <p>4.4 The Tenant must be physically and mentally capable of riding the bicycle safely.</p>
          <p>
            4.5 The Tenant is obliged to provide truthful and complete information about their person and the contact
            details required for the rental.
          </p>
          <p>
            4.6 The Lessor is entitled to inspect a valid official photo ID before handover. The processing of the data
            collected in this way is governed by the Lessor’s privacy policy.
          </p>
        </section>

        <section>
          <h2>5. Rental Price, Payment and Deposit</h2>
          <p>
            5.1 The rental price, payment terms and the amount of the deposit are set out in the reservation
            confirmation.
          </p>
          <p>
            5.2 Unless otherwise agreed, the full rental price must be paid before the final reservation confirmation.
          </p>
          <p>
            5.3 The deposit must be paid no later than before or upon handover of the bicycle using the agreed payment
            method.
          </p>
          <p>
            5.4 The deposit serves to secure due claims of the Lessor arising from the rental relationship. It does not
            constitute a limitation of liability.
          </p>
          <p>
            5.5 After the bicycle and accessories have been returned in full and inspected, the deposit will be released
            or repaid without undue delay, provided that there are no specific outstanding claims by the Lessor.
          </p>
          <p>
            5.6 If, upon return, there are specific indications of damage attributable to the Tenant, loss, missing
            accessories or other outstanding claims, the Lessor may provisionally retain an appropriate part of the
            deposit until the matter has been clarified.
          </p>
          <p>
            5.7 The Lessor will inform the Tenant of the reason for the provisional retention. Any remaining deposit
            amount after final clarification will be released or repaid without undue delay.
          </p>
          <p>
            5.8 The Lessor may offset due claims that are established as to their basis and amount against the Tenant’s
            claim for repayment of the deposit.
          </p>
        </section>

        <section>
          <h2>6. Handover and Condition Documentation</h2>
          <p>
            6.1 The bicycle will generally be handed over to the Tenant in a condition suitable for the agreed use and
            ready for operation, unless otherwise stated in the reservation confirmation.
          </p>
          <p>
            6.2 The bicycle will be documented by photographs or video recordings before handover. The documentation may
            include in particular the condition of the following areas:
          </p>
          <ul className="legal-page__list">
            <li>frame and fork,</li>
            <li>wheels and tires,</li>
            <li>handlebars and stem,</li>
            <li>saddle and seat post,</li>
            <li>gears and drivetrain,</li>
            <li>brakes,</li>
            <li>electronic components,</li>
            <li>accessories,</li>
            <li>existing scratches or other damage.</li>
          </ul>
          <p>
            6.3 The specific bicycle, the bicycle or frame number, the accessories and known special features or damage
            will be listed in the reservation confirmation or supplementary handover documentation.
          </p>
          <p>
            6.4 At handover, the Tenant will be given the opportunity to inspect the bicycle to a reasonable extent and
            check its essential functions.
          </p>
          <p>
            6.5 The Tenant should notify the Lessor immediately at handover of any identifiable deviations from the
            reservation confirmation or the condition documentation.
          </p>
          <p>
            6.6 Defects that were not identifiable during a reasonable inspection must be reported to the Lessor
            immediately after they are discovered.
          </p>
          <p>
            6.7 The photographs or video recordings and the findings made at handover and return may be used to
            establish the respective condition. This does not constitute a reversal of the burden of proof deviating
            from the statutory provisions.
          </p>
        </section>

        <section>
          <h2>7. Use of the Bicycle</h2>
          <p>7.1 The Tenant undertakes to use the bicycle carefully, as intended and in accordance with its design.</p>
          <p>7.2 The Tenant is obliged in particular to:</p>
          <ul className="legal-page__list">
            <li>comply with the applicable traffic regulations,</li>
            <li>adapt their riding style to the road, traffic and weather conditions,</li>
            <li>comply with the stated weight limits for rider and luggage,</li>
            <li>carry out a brief visual inspection of the bicycle before each ride,</li>
            <li>notify the Lessor immediately of any identifiable safety-relevant impairment,</li>
            <li>follow the Lessor’s instructions on operation and use.</li>
          </ul>
          <p>7.3 The following are prohibited in particular:</p>
          <ul className="legal-page__list">
            <li>
              participation in races, competitions or time trial events without the Lessor’s prior express consent,
            </li>
            <li>jumps, stunts or comparable strain,</li>
            <li>use in bike parks or on technically demanding trails,</li>
            <li>use of a road bike on unpaved roads or roads unsuitable for road bikes,</li>
            <li>use under the influence of alcohol, drugs or any other intoxicating substance,</li>
            <li>use to transport additional persons unless the bicycle is expressly intended for this purpose,</li>
            <li>towing a trailer without prior consent,</li>
            <li>use for unlawful purposes.</li>
          </ul>
          <p>
            7.4 The Tenant may not make any technical changes, modifications or dismantling without the Lessor’s prior
            consent. This applies in particular to:
          </p>
          <ul className="legal-page__list">
            <li>brakes,</li>
            <li>gears,</li>
            <li>wheels,</li>
            <li>handlebars,</li>
            <li>stem,</li>
            <li>seat post,</li>
            <li>electronic components,</li>
            <li>pedals and other attachments.</li>
          </ul>
          <p>
            7.5 The Tenant may only use the bicycle personally. Use by other persons is only permitted with the Lessor’s
            prior express consent.
          </p>
        </section>

        <section>
          <h2>8. Mandatory Storage in a Secured Indoor Space</h2>
          <p>
            8.1 When not being used immediately, the bicycle may not be left unattended in a public space, outdoors or
            in a generally accessible area. This also applies if the bicycle is secured with a lock.
          </p>
          <p>
            8.2 When the bicycle is not being used immediately, it must be stored in a locked, non-publicly accessible
            indoor space protected against access by unauthorized third parties.
          </p>
          <p>8.3 Suitable indoor spaces include in particular:</p>
          <ul className="legal-page__list">
            <li>a locked private apartment/garage,</li>
            <li>a locked house,</li>
            <li>a locked hotel or guest room,</li>
            <li>
              an individually lockable storage room to which only the Tenant or persons expressly authorized by the
              Tenant have access.
            </li>
          </ul>
          <p>8.4 The following are not considered sufficiently secured in particular:</p>
          <ul className="legal-page__list">
            <li>public or generally accessible bicycle parking facilities,</li>
            <li>open courtyards,</li>
            <li>communal stairwells,</li>
            <li>shared underground garages,</li>
            <li>communal hotel bicycle rooms,</li>
            <li>train stations,</li>
            <li>public parking garages,</li>
            <li>other areas accessible to a group of persons that is not individually restricted.</li>
          </ul>
          <p>8.5 If no suitable indoor space is available, the bicycle may not be left unattended.</p>
          <p>
            8.6 The Tenant must ensure before concluding the contract and before taking over the bicycle that suitable
            storage meeting the above requirements is available to them during the rental period.
          </p>
        </section>

        <section>
          <h2>9. Conduct in the Event of an Accident, Damage, Theft or Loss</h2>
          <p>
            9.1 Accidents, damage, theft, loss and other significant events must be reported to the Lessor immediately.
          </p>
          <p>
            9.2 In the event of an accident, the Tenant must record the following information where possible and
            reasonable:
          </p>
          <ul className="legal-page__list">
            <li>time and place,</li>
            <li>course of the accident,</li>
            <li>names and contact details of persons involved,</li>
            <li>names and contact details of witnesses,</li>
            <li>registration numbers of vehicles involved,</li>
            <li>the police file or incident reference number, if applicable,</li>
            <li>meaningful photographs.</li>
          </ul>
          <p>
            9.3 In the event of theft or loss, the Tenant must immediately report the incident to the competent police
            authority.
          </p>
          <p>
            9.4 The police incident reference number and a comprehensible description of the event must be provided to
            the Lessor.
          </p>
          <p>9.5 All available keys, locks and other security devices must be handed over to the Lessor.</p>
          <p>9.6 The Tenant may not make any admission of liability on behalf of the Lessor to third parties.</p>
        </section>

        <section>
          <h2>10. Tenant’s Liability</h2>
          <p>
            10.1 The Tenant is liable under the statutory provisions for damage to, loss or theft of the bicycle and
            accessories insofar as they are responsible for this.
          </p>
          <p>
            10.2 Liability exists in particular if damage was caused by an intentional or negligent breach of the
            contractual duties of use, security, storage or notification.
          </p>
          <p>
            10.3 The Tenant is not liable merely because damage was identified during their rental period. The statutory
            rules on the burden of presentation and proof remain unaffected.
          </p>
          <p>
            10.4 The Tenant is not responsible for ordinary wear and tear or deterioration resulting from contractual
            use.
          </p>
          <p>10.5 The Tenant is not liable for damage or defects already present and documented at handover.</p>
          <p>
            10.6 If no damage protection has been agreed under Section 11 or if the damage protection does not apply due
            to the conditions stated there, the extent of liability is governed by the statutory provisions.
          </p>
        </section>

        <section>
          <h2>11. Contractual Damage Protection and Limitation of Liability</h2>
          <p>
            11.1 The contractual damage protection only applies if it is expressly stated as booked or included in the
            rental price in the reservation confirmation.
          </p>
          <p>11.2 Damage protection is a contractual reduction of liability and not insurance.</p>
          <p>
            11.3 Insofar as the Tenant is liable under the statutory provisions, their liability for repairable property
            damage to the rented bicycle caused by simple negligence is limited to{" "}
            <strong>€100.00 per damage event</strong>.
          </p>
          <p>
            11.4 In the event of an economic total loss, loss or theft, the Tenant’s liability is limited to{" "}
            <strong>€300.00 per damage event</strong>, insofar as the Tenant is liable under the statutory provisions
            and fulfills all requirements of the damage protection.
          </p>
          <p>
            11.5 Several instances of damage based on the same single event are deemed to constitute one damage event.
            Damage from separate and independent events is deemed to constitute separate damage events.
          </p>
          <p>
            11.6 A prerequisite for the limitation of liability in the event of theft or loss is in particular that:
          </p>
          <ul className="legal-page__list">
            <li>the bicycle was stored in a suitable secured indoor space in accordance with Section 8,</li>
            <li>the Tenant informed the Lessor immediately,</li>
            <li>a police report was filed immediately,</li>
            <li>the police incident reference number was provided,</li>
            <li>all remaining keys and security devices were returned.</li>
          </ul>
          <p>
            11.7 The limitation of liability does not apply insofar as the damage, loss or theft was caused or
            substantially facilitated by:
          </p>
          <ul className="legal-page__list">
            <li>intent or gross negligence,</li>
            <li>the influence of alcohol, drugs or any other intoxicating substance,</li>
            <li>unauthorized transfer of the bicycle to third parties,</li>
            <li>unauthorized subletting,</li>
            <li>participation in races, competitions or other unauthorized events,</li>
            <li>use outside the agreed area of use,</li>
            <li>an intentional or grossly negligent breach of storage or security obligations,</li>
            <li>unauthorized technical modifications,</li>
            <li>failure to report a theft to the police,</li>
            <li>false or incomplete information about the circumstances of the damage.</li>
          </ul>
          <p>
            11.8 The exclusion or restriction of damage protection only applies insofar as the respective breach of duty
            caused the occurrence or extent of the damage or substantially hindered the investigation of the damage.
          </p>
          <p>
            11.9 Ordinary wear and tear and deterioration resulting from contractual use are not the Tenant’s
            responsibility and are not subject to the deductible.
          </p>
          <p>
            11.10 The limitation of liability applies exclusively to damage to the rented bicycle and the accessories
            expressly covered by the damage protection. It does not apply to:
          </p>
          <ul className="legal-page__list">
            <li>personal injury,</li>
            <li>damage to third-party property,</li>
            <li>third-party claims,</li>
            <li>fines or warning fines,</li>
            <li>costs resulting from deliberately false information,</li>
            <li>other damage outside the rented bicycle.</li>
          </ul>
        </section>

        <section>
          <h2>12. Return and Late Return</h2>
          <p>
            12.1 The bicycle and the agreed accessories must be returned no later than the time specified in the
            reservation confirmation at the agreed return location.
          </p>
          <p>12.2 The rental period may only be extended with the Lessor’s prior express consent.</p>
          <p>
            12.3 The Tenant must notify the Lessor immediately of any foreseeable delay. The notification alone does not
            extend the rental agreement.
          </p>
          <p>
            12.4 In the event of late return, the Lessor may charge the agreed pro rata rental price for the additional
            period of use or the pro rata rental price calculated according to the valid price list.
          </p>
          <p>
            12.5 Further damage, in particular specifically proven losses from a subsequent rental, may be claimed under
            the statutory provisions insofar as the Tenant is responsible for the late return.
          </p>
          <p>12.6 Saved expenses and income from any alternative rental will be credited.</p>
          <p>
            12.7 The bicycle must be returned in full, including the accessories listed in the reservation confirmation.
          </p>
        </section>

        <section>
          <h2>13. Cancellation by the Tenant</h2>
          <p>13.1 The following cancellation terms only apply after:</p>
          <ul className="legal-page__list">
            <li>the rental agreement has been validly concluded under Section 2.4,</li>
            <li>the reservation has been finally confirmed by the Lessor by email, and</li>
            <li>the agreed payment has been received in full.</li>
          </ul>
          <p>13.2 Cancellation must be declared to the Lessor in text form, in particular by email.</p>
          <p>
            13.3 The time at which the cancellation is received by the Lessor is decisive for calculating the
            cancellation period.
          </p>
          <p>13.4 The following fixed cancellation costs will be charged for a cancellation:</p>
          <p>
            a) <strong>More than 168 hours (equivalent to 7 days) before the agreed rental start:</strong>
            <br />
            25% of the agreed rental price.
            <br />
            The Tenant will receive a refund of 75% of the rental price already paid.
          </p>
          <p>
            b){" "}
            <strong>
              From 168 (equivalent to 7 days) hours up to more than 24 hours before the agreed rental start:
            </strong>
            <br />
            50% of the agreed rental price.
            <br />
            The Tenant will receive a refund of 50% of the rental price already paid.
          </p>
          <p>
            c) <strong>24 hours or less before the agreed rental start and in the event of a no-show:</strong>
            <br />
            100% of the agreed rental price.
            <br />
            No refund will be made.
          </p>
          <p>
            13.5 The Tenant expressly retains the right to prove that the cancellation caused no damage or substantially
            less damage to the Lessor.
          </p>
          <p>
            13.6 In the event of an early voluntary return of the bicycle, there is generally no entitlement to a pro
            rata refund of the rental price. Mandatory statutory claims of the Tenant remain unaffected.
          </p>
          <p>13.7 Any statutory right of withdrawal that may exist remains unaffected by these cancellation terms.</p>
          <p>
            13.8 If, under the statutory provisions, there is no right of withdrawal for a rental on a specific date or
            during a specific period, only the statutory rights and the above contractual cancellation terms apply.
          </p>
        </section>

        <section>
          <h2>14. Extraordinary Soiling</h2>
          <p>14.1 Ordinary soiling caused by contractual use is covered by the rental price.</p>
          <p>
            14.2 In the event of extraordinary soiling, the Lessor may claim the necessary and reasonable cleaning costs
            insofar as the Tenant is responsible for the soiling.
          </p>
          <p>14.3 Extraordinary soiling includes in particular significant contamination caused by:</p>
          <ul className="legal-page__list">
            <li>mud,</li>
            <li>oil or lubricants outside the usual drivetrain marks,</li>
            <li>paint,</li>
            <li>adhesives,</li>
            <li>drinks or food,</li>
            <li>other substances that are difficult to remove.</li>
          </ul>
          <p>14.4 A flat-rate cleaning fee will not be charged solely on the basis of ordinary signs of use.</p>
        </section>

        <section>
          <h2>15. Lessor’s Liability</h2>
          <p>
            15.1 The Lessor is fully liable for damage resulting from injury to life, body or health based on an
            intentional or negligent breach of duty by the Lessor, its legal representatives or vicarious agents.
          </p>
          <p>15.2 The Lessor is fully liable for other damage in cases of intent and gross negligence.</p>
          <p>
            15.3 In the event of a slightly negligent breach of an essential contractual obligation, the Lessor is
            liable for the foreseeable damage typical for the contract at the time the contract was concluded.
          </p>
          <p>
            15.4 Essential contractual obligations are those obligations whose fulfillment makes the proper execution of
            the rental agreement possible in the first place and on compliance with which the Tenant may regularly rely.
          </p>
          <p>15.5 The Tenant’s statutory claims due to a defect in the bicycle remain unaffected.</p>
          <p>
            15.6 The Lessor is not liable for damage caused exclusively by improper use, failure to observe operating or
            safety instructions or another breach of duty for which the Tenant is responsible.
          </p>
        </section>

        <section>
          <h2>16. Data Protection</h2>
          <p>
            16.1 The Lessor processes the Tenant’s personal data insofar as this is necessary for the initiation,
            performance, processing and documentation of the rental relationship.
          </p>
          <p>16.2 This may include in particular the following data:</p>
          <ul className="legal-page__list">
            <li>name and contact details,</li>
            <li>address and date of birth,</li>
            <li>booking and payment data,</li>
            <li>data for identity verification,</li>
            <li>communications in connection with the reservation,</li>
            <li>photographs or video recordings documenting the condition of the bicycle,</li>
            <li>information about accidents, damage, theft or loss.</li>
          </ul>
          <p>
            16.3 Further information about the type, scope, legal bases, storage period, recipients and rights of data
            subjects is contained in the Lessor’s privacy policy:
          </p>
          <p>
            <strong>[Insert link to privacy policy]</strong>
          </p>
          <p>
            16.4 The photographs and video recordings generally serve to document the condition of the bicycle.
            Unnecessary recordings of the Tenant or other identifiable persons should be avoided.
          </p>
        </section>

        <section>
          <h2>17. Applicable Law and Place of Jurisdiction</h2>
          <p>17.1 The law of the Federal Republic of Germany applies.</p>
          <p>
            17.2 In relation to consumers, this choice of law only applies insofar as it does not deprive them of the
            mandatory consumer protection provisions of the state in which they have their habitual residence.
          </p>
          <p>17.3 The place of jurisdiction is determined by the statutory provisions.</p>
        </section>

        <section>
          <h2>18. Final Provisions</h2>
          <p>
            18.1 Individual agreements take precedence over these General Terms and Conditions. This applies regardless
            of whether the individual agreement was made in writing, in text form or in another verifiable manner.
          </p>
          <p>
            18.2 If a provision of these General Terms and Conditions is or becomes wholly or partially invalid, the
            validity of the remaining provisions remains unaffected.
          </p>
          <p>18.3 The statutory provisions shall replace any invalid provision.</p>
          <p>
            18.4 The Lessor stores the version of the General Terms and Conditions applicable at the time the contract
            was concluded together with the booking data. The Tenant is given the opportunity to save the version
            applicable to their contract.
          </p>
        </section>
      </div>
    </main>
  );
}
