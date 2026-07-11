import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { HomeTopbar } from "../../components/home-interactive";
import { MaintenanceForm } from "../../components/maintenance-form";
import { resolveLocale, translations } from "../../lib/home-content";
import { siteConfig } from "../../lib/site";

type PageProps = {
  searchParams?: Promise<{
    lang?: string | string[];
  }>;
};

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
      <h2 className={inverse ? "section-heading__title is-inverse" : "section-heading__title"}>{title}</h2>
    </div>
  );
}

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: "Wartung",
  description:
    "Wartung für Rennräder und Gravelbikes in München-Maxvorstadt. Beratung, Öl-zu-Wachs-Umstieg, Teiletausch, Reparaturen und Abholung auf Wunsch.",
  alternates: {
    canonical: "/wartung",
  },
  keywords: [
    "Rennrad Wartung München",
    "Fahrradwartung München",
    "Öl auf Wachs München",
    "Kette wachsen lassen München",
    "Bike maintenance Munich",
  ],
};

export default async function WartungPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLocale(params?.lang);
  const t = translations[lang];
  const page = t.maintenancePage;
  const homeHref = lang === "de" ? "/" : "/?lang=en";

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
            <span className="service-hero__eyebrow">{page.heroEyebrow}</span>
            <h1 className="service-hero__title">{page.heroTitle}</h1>
            <p className="section-copy service-hero__lead">{page.heroIntro}</p>

            <div className="service-hero__actions">
              <Link className="button--arrow" href="#wartungsformular">
                <span>{lang === "de" ? "Wartung anfragen" : "Ask for service"}</span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
              <Link className="service-hero__link" href={homeHref}>
                {lang === "de" ? "Zurück zu den Bikes" : "Back to the bikes"}
              </Link>
            </div>
          </div>

          <div className="service-hero__panel">
            <div className="service-price-card">
              <span className="service-price-card__badge">{page.heroBadge}</span>
              <h2 className="service-price-card__title">{page.heroPriceLabel}</h2>
              <div className="service-price-card__price">{page.heroPriceValue}</div>
              <p className="service-price-card__text">{page.heroPriceNote}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section service-offers">
        <div className="container service-offers__inner">
          <SectionHeading eyebrow={page.servicesEyebrow} title={page.servicesTitle} />
          <p className="section-copy service-offers__intro">{page.servicesIntro}</p>

          <div className="service-offers__grid">
            {page.services.map((service) => (
              <article key={service.title} className="service-offers__card">
                <h3>{service.title}</h3>
                <p>{service.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section service-highlight">
        <div className="container">
          <div className="service-highlight__card">
            <div className="service-highlight__copy">
              <span className="service-highlight__eyebrow">
                {lang === "de" ? "Beratung inklusive" : "Advice included"}
              </span>
              <h2 className="service-highlight__title">{page.highlightTitle}</h2>
              <p className="service-highlight__text">{page.highlightText}</p>
            </div>

            <div className="service-highlight__price">
              <strong>{page.heroPriceValue}</strong>
              <span>{page.heroPriceLabel}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="wartungsformular" className="section service-form-section">
        <div className="container service-form-section__grid">
          <div className="service-form-section__copy">
            <SectionHeading eyebrow={page.formEyebrow} title={page.formTitle} />
            <p className="section-copy">{page.formIntro}</p>

            <ul className="service-form-points">
              <li>
                {lang === "de"
                  ? "Beschreibe kurz, was dein Rad braucht und ob schon etwas verschlissen ist."
                  : "Briefly describe what your bike needs and whether anything is already worn out."}
              </li>
              <li>
                {lang === "de"
                  ? "Wenn du Öl auf Wachs umsteigen willst, helfen wir dir auch bei der Wahl des besten Wachses."
                  : "If you want to switch from oil to wax, we will also help you choose the best wax."}
              </li>
              <li>
                {lang === "de"
                  ? "Auf Wunsch holen wir dein Fahrrad gegen kleinen Aufpreis ab und bringen es wieder zurück."
                  : "If you want, we can pick up your bike for a small extra fee and bring it back again."}
              </li>
            </ul>
          </div>

          <MaintenanceForm lang={lang} translations={t.maintenanceForm} />
        </div>
      </section>
    </main>
  );
}
