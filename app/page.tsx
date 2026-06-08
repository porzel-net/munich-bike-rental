import Image from "next/image";
import mainImage from "../main.png";
import { ArrowUpRight, MapPin } from "lucide-react";

import { ContactForm, HomeTopbar, PortfolioSection } from "../components/home-interactive";
import {
  contactItems,
  faqItems,
  footerLinks,
  portfolioItems,
  priceItems,
  resolveLocale,
  services,
  translations,
} from "../lib/home-content";

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

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLocale(params?.lang);
  const t = translations[lang];

  return (
    <main className="site-shell">
      <HomeTopbar
        lang={lang}
        topbar={{
          nav: t.nav,
          languageToggle: t.languageToggle,
          menuButton: t.menuButton,
        }}
      />

      <section id="home" className="hero section">
        <div className="container hero__grid">
          <div className="hero__copy">
            <span className="hero__location">
              <MapPin className="hero__location-icon" aria-hidden="true" />
              <span>{t.location}</span>
            </span>
            <h1 className="hero__title">
              {lang === "de" ? (
                <>
                  Rennrad
                  <span className="hero__title-line">verleih in München</span>
                </>
              ) : (
                t.hero.title
              )}
            </h1>
            <p className="hero__intro">{t.hero.intro}</p>

            <ul className="hero-stats">
              <li className="hero-stats__item">
                <strong>{t.hero.stats[0].value}</strong>
                <span>
                  {t.hero.stats[0].top}
                  <br />
                  {t.hero.stats[0].bottom}
                </span>
              </li>
              <li className="hero-stats__item">
                <strong>{t.hero.stats[1].value}</strong>
                <span>
                  {t.hero.stats[1].top}
                  <br />
                  {t.hero.stats[1].bottom}
                </span>
              </li>
            </ul>
          </div>

          <div className="hero__visual">
            <div className="hero-frame">
              <Image
                src={mainImage}
                alt="Munich Rental Rennradverleih mit gepflegten Rennraedern in Muenchen"
                className="hero-frame__image"
                fill
                preload
                placeholder="blur"
                sizes="(max-width: 540px) 340px, (max-width: 1100px) 420px, 470px"
              />
              <span className="hero-frame__shape" aria-hidden="true" />
            </div>
          </div>

          <a className="hero__down" href="#portfolio" aria-label={t.hero.scroll}>
            <img src="/assets/img/svg/down-arrow.svg" alt="" />
          </a>
        </div>
      </section>

      <PortfolioSection
        lang={lang}
        translations={{
          portfolio: t.portfolio,
          modal: t.modal,
          form: t.form,
          location: t.location,
        }}
        portfolioItems={portfolioItems}
      />

      <section id="bestprice" className="section section--promise">
        <div className="container">
          <div className="promise-card">
            <div className="promise-card__content">
              <div className="promise-card__header">
                <span className="promise-card__eyebrow">{t.pricePromise.eyebrow}</span>
                <h2 className="promise-card__title">{t.pricePromise.title}</h2>
              </div>

              <blockquote className="promise-card__quote">
                <p>{t.pricePromise.quote}</p>
              </blockquote>

              <div className="promise-card__footer">
                <span className="promise-card__badge">{t.pricePromise.badge}</span>
                <p>{t.pricePromise.note}</p>
              </div>
            </div>

            <div className="promise-card__visual" aria-hidden="true">
              <span className="promise-card__visual-quote promise-card__visual-quote--left">“</span>
              <span className="promise-card__visual-quote promise-card__visual-quote--right">”</span>
              <span className="promise-card__visual-line" />
              <span className="promise-card__visual-dot" />
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="section section--about">
        <div className="container">
          <SectionHeading eyebrow={t.about.eyebrow} title={t.about.title} />

          <ul className="hero-profile hero-profile--section">
            {services.map((service) => (
              <li key={service.title} className="hero-profile__item">
                <span className="hero-profile__label">{service.title}</span>
                <span className="hero-profile__text">{service.text[lang]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="price" className="section section--price">
        <div className="container price-grid">
          <div className="price-grid__copy">
            <SectionHeading eyebrow={t.price.eyebrow} title={t.price.title} />
            <p className="section-copy">{t.price.intro}</p>
          </div>

          <div className="price-grid__list">
            {priceItems.map((item) => (
              <article key={item.title.de} className="price-item">
                <item.icon className="price-item__icon" aria-hidden="true" />
                <div className="price-item__title">{item.title[lang]}</div>
                <div className="price-item__cost">{item.cost[lang]}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="section section--faq">
        <div className="container faq-grid">
          <div className="faq-grid__copy">
            <SectionHeading eyebrow={t.faq.eyebrow} title={t.faq.title} />
            <p className="section-copy">{t.faq.intro}</p>
          </div>

          <div className="faq-grid__list">
            {faqItems.map((item) => (
              <details key={item.question.de} className="faq-item">
                <summary>
                  <span>{item.question[lang]}</span>
                  <span className="faq-item__icon" aria-hidden="true" />
                </summary>
                <p>{item.answer[lang]}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="location" className="section section--location">
        <div className="container location-grid">
          <div className="location-grid__copy">
            <SectionHeading eyebrow={t.locationSection.eyebrow} title={t.locationSection.title} />
            <p className="section-copy">{t.locationSection.intro}</p>

            <div className="location-card">
              <div className="location-card__address">
                <MapPin className="location-card__icon" aria-hidden="true" />
                <div className="location-card__address-copy">
                  <span className="location-card__label">{t.locationSection.addressLabel}</span>
                  <p className="location-card__text">{t.locationSection.address}</p>
                </div>
              </div>

              <a
                className="location-card__link"
                href={t.locationSection.mapsLink}
                target="_blank"
                rel="noreferrer"
              >
                <span>{t.locationSection.mapsLabel}</span>
                <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="location-grid__visual">
            <div className="location-map">
              <Image
                src="/assets/img/location/google-maps.png"
                alt={`Google Maps Standort für ${t.locationSection.address}`}
                fill
                sizes="(max-width: 632px) calc(100vw - 32px), 600px"
                quality={72}
                className="location-map__image"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="section section--contact">
        <div className="container contact-grid">
          <div className="contact-grid__copy">
            <SectionHeading eyebrow={t.contact.eyebrow} title={t.contact.title} />
            <p className="section-copy">{t.contact.intro}</p>

            <ul className="contact-list">
              {contactItems.map((item) => (
                <li key={item.label.de} className="contact-list__item">
                  {item.href ? (
                    <a href={item.href} className="contact-list__link">
                      <img src={item.icon} alt="" className="contact-list__icon" />
                      <span>{item.label[lang]}</span>
                    </a>
                  ) : (
                    <>
                      <img src={item.icon} alt="" className="contact-list__icon" />
                      <span>{item.label[lang]}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <ContactForm
            lang={lang}
            translations={{
              portfolio: t.portfolio,
              modal: t.modal,
              form: t.form,
              location: t.location,
            }}
          />
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
