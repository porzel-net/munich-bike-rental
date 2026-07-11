import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MapPin } from "lucide-react";

import { HomeTopbar } from "../../components/home-interactive";
import { MaintenanceForm } from "../../components/maintenance-form";
import { footerLinks, resolveLocale, translations } from "../../lib/home-content";
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

function MaintenanceIntro({ lang, text }: { lang: "de" | "en"; text: string }) {
  const priceMatch = lang === "de" ? /110 €|49 €/g : /110 EUR|49 EUR/g;
  const segments = text.split(priceMatch);
  const prices = text.match(priceMatch) ?? [];

  return (
    <p className="section-copy service-hero__lead">
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`}>
          {segment}
          {prices[index] ? <strong>{prices[index]}</strong> : null}
        </span>
      ))}
    </p>
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

  return (
    <main className="site-shell service-shell">
      <HomeTopbar
        lang={lang}
        topbar={{
          nav: t.nav,
          languageToggle: t.languageToggle,
          menuButton: t.menuButton,
        }}
      />

      <section className="section service-hero">
        <div className="container service-hero__grid">
          <div className="service-hero__copy">
            <span className="service-hero__eyebrow">{page.heroEyebrow}</span>
            <h1 className="service-hero__title">{page.heroTitle}</h1>
            <MaintenanceIntro lang={lang} text={page.heroIntro} />

            <div className="service-hero__actions">
              <Link className="button--arrow" href="#wartungsformular">
                <span>{lang === "de" ? "Wartung anfragen" : "Ask for service"}</span>
                <ArrowUpRight aria-hidden="true" />
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
            <div className="section-heading service-form-section__heading">
              <span className="section-heading__eyebrow">{page.formEyebrow}</span>
              <h2 className="section-heading__title service-form-section__title">
                {lang === "de" ? (
                  <>
                    <span className="service-form-section__title-desktop">{page.formTitle}</span>
                    <span className="service-form-section__title-mobile">
                      <span>WARTUNGS-</span>
                      <span>ANFRAGE SENDEN</span>
                    </span>
                  </>
                ) : (
                  page.formTitle
                )}
              </h2>
            </div>
            <p className="section-copy">
              {lang === "de" ? (
                <>
                  Nutze das Formular unten, wenn du dein <strong>Rad warten</strong> lassen möchtest. Je
                  genauer deine Beschreibung, desto besser können wir einschätzen, was ansteht.{" "}
                  <strong>Füg bestenfalls Bilder hinzu!</strong>
                </>
              ) : (
                <>
                  Use the form below if you want your bike serviced. The more precise your description, the
                  better we can estimate what is needed. <strong>Pictures are welcome.</strong>
                </>
              )}
            </p>

            <ul className="service-form-points">
              {lang === "de" ? (
                <>
                  <li>
                    Die Anfrage ist natürlich <strong>unverbindlich</strong> und wir machen dir gern einen{" "}
                    <strong>Kostenvoranschlag</strong>.
                  </li>
                  <li>
                    Auf Wunsch holen wir dein Fahrrad gegen kleinen Aufpreis ab und bringen es wieder
                    zurück.
                  </li>
                  <li>
                    Unsere <strong>Beratung</strong> ist grundsätzlich <strong>kostenlos</strong> - egal ob
                    Pflege, Teile oder Wachs.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    The inquiry is of course <strong>non-binding</strong> and we will gladly prepare a{" "}
                    <strong>quote</strong>.
                  </li>
                  <li>
                    For a small extra fee, we can pick up your bike and bring it back again.
                  </li>
                  <li>
                    Our <strong>advice</strong> is generally <strong>free</strong> - whether it is care,
                    parts or wax.
                  </li>
                </>
              )}
            </ul>
          </div>

          <MaintenanceForm lang={lang} translations={t.maintenanceForm} />
        </div>
      </section>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <span className="footer__title">Munich Rental</span>
          </div>

          <ul className="footer-links">
            {footerLinks.map((item) => (
              <li key={item.href} className="footer-links__item">
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>

          <ul className="footer-meta">
            <li className="footer-meta__item footer-meta__item--location">
              <MapPin className="footer-meta__icon" aria-hidden="true" />
              <span>München, Maxvorstadt</span>
            </li>
          </ul>
        </div>
      </footer>
    </main>
  );
}
