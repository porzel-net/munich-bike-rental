import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { HomeTopbar } from "../../../components/home-interactive";
import { resolveLocale, translations } from "../../../lib/home-content";
import { siteConfig } from "../../../lib/site";

type PageProps = {
  searchParams?: Promise<{
    lang?: string | string[];
  }>;
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: "Wartung",
  description:
    "Wartung für Rennräder und Gravelbikes in München-Maxvorstadt. Zum Beispiel Kettenpflege, Öl-zu-Wachs-Umstieg und kleine Services.",
  alternates: {
    canonical: "/wartung",
  },
  keywords: [
    "Rennrad Wartung München",
    "Fahrradwartung München",
    "Kette wachsen lassen München",
    "Bike maintenance Munich",
  ],
};

export default async function WartungPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLocale(params?.lang);
  const t = translations[lang];
  const homeHref = lang === "de" ? "/" : "/?lang=en";
  const contactHref = lang === "de" ? "/?lang=de#contact" : "/?lang=en#contact";

  return (
    <main className="site-shell service-shell">
      <HomeTopbar
        lang={lang}
        topbar={{
          nav: t.nav,
          languageToggle: t.languageToggle,
          menuButton: t.menuButton,
        }}
        backLink={{
          href: homeHref,
          label: lang === "de" ? "Zurück zur Startseite" : "Back to homepage",
        }}
      />

      <section className="section service-hero">
        <div className="container service-hero__grid">
          <div className="service-hero__copy">
            <span className="service-hero__eyebrow">
              {lang === "de" ? "Wartung" : "Maintenance"}
            </span>
            <h1 className="service-hero__title">
              {lang === "de" ? "Rennrad warten lassen" : "Road bike maintenance"}
            </h1>
            <p className="section-copy service-hero__lead">
              {lang === "de"
                ? "Wenn du dein Rennrad warten lassen möchtest, zum Beispiel von Öl auf Wachs wechseln oder einen kleinen Service brauchst, bist du hier richtig."
                : "If you want your road bike serviced, for example to switch from oil to wax or to get a small tune-up, you are in the right place."}
            </p>

            <div className="service-hero__actions">
              <Link className="button--arrow" href={contactHref}>
                <span>{lang === "de" ? "Wartung anfragen" : "Ask for service"}</span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="service-hero__panel">
            <div className="service-card">
              <span className="service-card__eyebrow">
                {lang === "de" ? "Mögliche Arbeiten" : "Possible work"}
              </span>
              <ul className="service-card__list">
                <li>{lang === "de" ? "Kettenpflege und Antriebsreinigung" : "Chain care and drivetrain cleaning"}</li>
                <li>{lang === "de" ? "Umstieg von Öl auf Wachs" : "Switch from oil to wax"}</li>
                <li>{lang === "de" ? "Kleine Checks vor der Saison" : "Small pre-season checks"}</li>
                <li>{lang === "de" ? "Tipps zu Setup und Pflege" : "Setup and maintenance advice"}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section service-note">
        <div className="container">
          <div className="service-note__card">
            <p className="service-note__text">
              {lang === "de"
                ? "Wir nehmen dir die Pflege deines Rads nicht anonym ab, sondern sprechen die Arbeit direkt mit dir ab."
                : "We do not handle your bike anonymously, but discuss the work with you directly."}
            </p>
            <Link className="service-note__link" href={homeHref}>
              {lang === "de" ? "Zur Startseite" : "Back to homepage"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
