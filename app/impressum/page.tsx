import Link from "next/link";
import type { Metadata } from "next";

import { siteConfig } from "../../lib/site";

export const metadata: Metadata = {
  title: {
    absolute: "Impressum | Your Bike Rental",
  },
  description: `Impressum von ${siteConfig.name}.`,
  alternates: {
    canonical: "/impressum",
  },
};

export default function ImpressumPage() {
  return (
    <main className="legal-page">
      <div className="container legal-page__inner">
        <Link className="legal-page__back" href="/de/rennradverleih/münchen/maxvorstadt">
          Zurück zur Startseite
        </Link>

        <h1>Impressum</h1>

        <section>
          <h2>Angaben gemäß § 5 TMG</h2>
          <p>Your Bike Rental</p>
          <p>Julius Porzel</p>
          <p>Josephine-Lang-Weg 3, 81245 München</p>
          <p>Deutschland</p>
        </section>

        <section>
          <h2>Kontakt</h2>
          <p>E-Mail: hallo@munich-bike-rental.de</p>
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
            Unsere Seite kann Links zu externen Websites enthalten. Auf deren Inhalte haben wir keinen Einfluss und
            dafür sind ausschließlich die jeweiligen Betreiber verantwortlich.
          </p>
        </section>
      </div>
    </main>
  );
}
