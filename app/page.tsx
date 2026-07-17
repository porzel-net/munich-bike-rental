import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import mainImage from "../main.png";
import { ArrowUpRight, MapPin } from "lucide-react";

import {
  AboutImageStack,
  ContactForm,
  HomeTopbar,
  LocationShowcase,
  PortfolioSection,
} from "../components/home-interactive";
import { BlogPreviewCard } from "../components/blog-content";
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
import { blogPosts } from "../lib/blog-content";
import { siteConfig } from "../lib/site";

type PageProps = {
  searchParams?: Promise<{
    lang?: string | string[];
  }>;
  defaultLocation?: "munich" | "regensburg";
  focusCity?: "munich" | "regensburg";
};

function SectionHeading({ eyebrow, title, inverse = false }: { eyebrow: string; title: string; inverse?: boolean }) {
  return (
    <div className="section-heading">
      <span className="section-heading__eyebrow">{eyebrow}</span>
      <h2 className={inverse ? "section-heading__title is-inverse" : "section-heading__title"}>{title}</h2>
    </div>
  );
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const lang = resolveLocale(params?.lang);
  const isGerman = lang === "de";

  const title = isGerman
    ? "Rennrad- & Gravelbike-Verleih München & Regensburg | Your Bike Rental"
    : "Road and gravel bike rental/maintenance Munich & Regensburg";
  const description = isGerman
    ? "Persönlicher Rennrad- und Gravel-Verleih in München-Maxvorstadt und Regensburg-Altstadt mit Wartung, Beratung, gepflegten Rädern und klaren Preisen."
    : "Personal road and gravel bike rental in Munich-Maxvorstadt and Regensburg-Altstadt with maintenance, advice, serviced bikes and transparent pricing.";

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: "/",
      languages: {
        de: "/",
        en: "/?lang=en",
      },
    },
    keywords: isGerman
      ? [
          "Rennradverleih München",
          "Rennradverleih Regensburg",
          "Rennradwartung",
          "Gravelbike Verleih München",
          "Gravelbike Verleih Regensburg",
          "Gravelbikewartung",
          "Rennrad leihen München",
          "Rennrad leihen Regensburg",
          "Gravelbike mieten München",
          "Gravelbike mieten Regensburg",
          "Rennrad Wartung München",
          "Rennrad Wartung Regensburg",
          "Fahrradwartung München",
          "Fahrradwartung",
          "Bikewartung",
          "Öl auf Wachs München",
          "Öl auf Wachs",
          "Rennradservice",
          "Rennrad Maxvorstadt",
          "Gravelbike Maxvorstadt",
          "Rennrad Altstadt Regensburg",
          "Gravelbike Altstadt Regensburg",
          "Bike Verleih München",
          "Bike Verleih Regensburg",
          "Road bike rental Munich",
          "Road bike rental Regensburg",
          "Gravel bike rental Munich",
          "Gravel bike rental Regensburg",
        ]
      : [
          "road bike rental Munich",
          "road bike rental Regensburg",
          "roadbikemaintenance",
          "gravel bike rental Munich",
          "gravel bike rental Regensburg",
          "gravelbikemaintenance",
          "bike rental Munich",
          "bike rental Regensburg",
          "road bike maintenance Munich",
          "gravel bike maintenance Munich",
          "road bike maintenance Regensburg",
          "gravel bike maintenance Regensburg",
          "bike maintenance Munich",
          "oil to wax conversion Munich",
          "oil to wax",
          "bike service Munich",
          "bike service Regensburg",
          "Maxvorstadt bike rental",
          "Munich bike hire",
          "road bike service",
          "service bike Munich",
        ],
    openGraph: {
      type: "website",
      locale: isGerman ? "de_DE" : "en_US",
      url: isGerman ? siteConfig.url : `${siteConfig.url}/?lang=en`,
      siteName: siteConfig.name,
      title,
      description,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: isGerman
            ? "Munich Rental - Rennrad- und Gravel-Verleih mit Wartung in München und Regensburg"
            : "Munich Rental - road and gravel bike rental with maintenance in Munich and Regensburg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function Home({ searchParams, defaultLocation = "munich", focusCity }: PageProps) {
  const params = await searchParams;
  const lang = resolveLocale(params?.lang);
  const t = translations[lang];
  const [primaryLocation, secondaryLocation] = t.location.split(" & ");
  const featuredPost = blogPosts[0];

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
              <span>{primaryLocation}</span>
              <span className="hero__location-separator" aria-hidden="true">
                &amp;
              </span>
              {secondaryLocation ? (
                <>
                  <MapPin className="hero__location-icon" aria-hidden="true" />
                  <span>{secondaryLocation}</span>
                </>
              ) : null}
            </span>
            <h1 className="hero__title">{t.hero.title}</h1>
            <p className="hero__intro">{t.hero.intro}</p>
            {focusCity ? (
              <p className="hero__focus">
                {lang === "de"
                  ? focusCity === "munich"
                    ? "Diese Seite ist speziell auf München ausgerichtet und zeigt den Standort in der Maxvorstadt zuerst."
                    : "Diese Seite ist speziell auf Regensburg ausgerichtet und zeigt den Standort in der Altstadt zuerst."
                  : focusCity === "munich"
                    ? "This page is specifically focused on Munich and shows the Maxvorstadt location first."
                    : "This page is specifically focused on Regensburg and shows the Altstadt location first."}
              </p>
            ) : null}

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
                alt="Munich Rental Bike-Verleih mit gepflegten Endurance-, Gravel- und Aero-Bikes in Muenchen"
                className="hero-frame__image"
                fill
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

      <section className="section section--maintenance-promo">
        <div className="container">
          <div className="maintenance-card">
            <div className="maintenance-card__content">
              <span className="maintenance-card__eyebrow">{t.maintenancePromo.eyebrow}</span>
              <h2 className="maintenance-card__title">{t.maintenancePromo.title}</h2>
              <p className="maintenance-card__text">{t.maintenancePromo.text}</p>
            </div>

            <Link className="button--arrow maintenance-card__link" href={`/wartung${lang === "de" ? "" : "?lang=en"}`}>
              <span>{t.maintenancePromo.cta}</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
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
          <div className="about-grid">
            <div className="about-grid__copy">
              <SectionHeading eyebrow={t.about.eyebrow} title={t.about.title} />

              <ul className="hero-profile hero-profile--section">
                {services.map((service) => (
                  <li key={service.title.de} className="hero-profile__item">
                    <span className="hero-profile__label">{service.title[lang]}</span>
                    <span className="hero-profile__text">{service.text[lang]}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="about-grid__visual">
              <AboutImageStack lang={lang} />
            </div>
          </div>
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
        <div className="container">
          <LocationShowcase
            lang={lang}
            defaultLocation={defaultLocation}
            eyebrow={t.locationSection.eyebrow}
            title={t.locationSection.title}
            intro={t.locationSection.intro}
            notice={t.locationSection.notice}
            primaryAddressLabel={t.locationSection.addressLabel}
            primaryAddress={t.locationSection.address}
            secondaryAddressLabel={t.locationSection.secondaryAddressLabel}
            secondaryAddress={t.locationSection.secondaryAddress}
          />
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

      <section id="blog" className="section section--blog">
        <div className="container blog-section">
          <div className="section-heading">
            <span className="section-heading__eyebrow">{t.blogSection.eyebrow}</span>
            <h2 className="section-heading__title">{t.blogSection.title}</h2>
          </div>

          <p className="section-copy">{t.blogSection.intro}</p>

          <BlogPreviewCard
            post={featuredPost}
            lang={lang}
            href={`/blog/${featuredPost.slug}?lang=${lang}`}
            ctaLabel={t.blogSection.cta}
          />

          <div className="blog-section__footer">
            <Link className="blog-section__link" href={`/blog?lang=${lang}`}>
              <span>{t.blogSection.archive}</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <span className="footer__title">Your Bike Rental</span>
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
            <li className="footer-meta__item footer-meta__item--location">
              <MapPin className="footer-meta__icon" aria-hidden="true" />
              <span>Regensburg, Altstadt</span>
            </li>
          </ul>
        </div>
      </footer>
    </main>
  );
}
