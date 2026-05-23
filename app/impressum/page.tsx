import Link from "next/link";

export const metadata = {
  title: "Impressum | Munich Rental",
};

export default function ImpressumPage() {
  return (
    <main className="legal-page">
      <div className="container legal-page__inner">
        <Link className="legal-page__back" href="/">
          Zurück zur Startseite
        </Link>

        <h1>Impressum</h1>

        <section>
          <h2>Angaben gemäß § 5 TMG</h2>
          <p>Munich Rental</p>
          <p>Julius Porzel</p>
          <p>Josephine-Lang-Weg 3, 81245 München</p>
          <p>Deutschland</p>
        </section>

        <section>
          <h2>Kontakt</h2>
          <p>E-Mail: hallo@munich-bike-rental.de</p>
          <p>Telefon: +4917624742317</p>
        </section>

        <section>
          <h2>Haftung für Inhalte</h2>
          <p>
            Wir sind für eigene Inhalte nach den allgemeinen Gesetzen verantwortlich. Eine pauschale
            Haftungsfreizeichnung ist rechtlich nicht sinnvoll, deshalb beschränken wir uns auf die gesetzlich
            vorgesehenen Hinweise.
          </p>
        </section>

        <section>
          <h2>Haftung für Links</h2>
          <p>
            Unsere Seite kann Links zu externen Websites enthalten. Auf deren Inhalte haben wir keinen Einfluss
            und dafür sind ausschließlich die jeweiligen Betreiber verantwortlich.
          </p>
        </section>
      </div>
    </main>
  );
}
