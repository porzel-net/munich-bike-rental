import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import mainImage from "../main.png";
import { ArrowUpRight, MapPin } from "lucide-react";

import {
  AboutImageStack,
  ContactForm,
  HomeTopbar,
  LocationShowcase,
  PortfolioSection,
} from "../components/home-interactive";
import { LocationSelectionDialog, LocationSelectionPrompt } from "../components/location-selection-dialog";
import { BlogPreviewCard } from "../components/blog-content";
import {
  contactItems,
  faqItems,
  portfolioItems,
  priceItems,
  resolveLocale,
  services,
  translations,
  type Locale,
} from "../lib/home-content";
import { blogPosts } from "../lib/blog-content";
import {
  defaultRentalLocation,
  getLocationCopy,
  getLocalizedLocationPath,
  rentalLocationConfigs,
  type RentalLocationConfig,
} from "../lib/rental-locations";
import { siteConfig } from "../lib/site";

type PageProps = {
  searchParams?: Promise<{
    lang?: string | string[];
    standortauswahl?: string | string[];
  }>;
  location: RentalLocationConfig;
  locale?: Locale;
};

function SectionHeading({ eyebrow, title, inverse = false }: { eyebrow: string; title: string; inverse?: boolean }) {
  return (
    <div className="section-heading">
      <span className="section-heading__eyebrow">{eyebrow}</span>
      <h2 className={inverse ? "section-heading__title is-inverse" : "section-heading__title"}>{title}</h2>
    </div>
  );
}

export async function generateRentalMetadata({ searchParams, location, locale }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const lang = locale ?? resolveLocale(params?.lang);
  const isGerman = lang === "de";
  const city = location.city[lang];
  const district = location.district[lang];
  const localizedPath = getLocalizedLocationPath(location, lang);

  const title = isGerman
    ? `Dein Rennradverleih & Gravelverleih in ${city} | Your Bike Rental`
    : `Road and gravel bike rental in ${city} ${district} | Your Bike Rental`;
  const description = isGerman
    ? `Persönlicher Rennrad- und Gravel-Verleih in ${city}-${district}: gepflegte Räder, direkte Anfrage, persönliche Beratung und klare Preise.`
    : `Personal road and gravel bike rental in ${city} ${district} with serviced bikes, direct inquiry, personal advice and transparent pricing.`;

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: localizedPath,
      languages: {
        de: location.path,
        en: location.enPath,
        "x-default": location.path,
      },
    },
    keywords: isGerman
      ? [
          `Rennradverleih ${city}`,
          `Rennradverleih ${city} ${district}`,
          `Gravelbike Verleih ${city}`,
          `Gravelbike Verleih ${city} ${district}`,
          `Rennrad mieten ${city}`,
          `Rennrad leihen ${city}`,
          `Gravelbike mieten ${city}`,
          `Bike Verleih ${city}`,
        ]
      : [
          `road bike rental ${city}`,
          `road bike rental ${city} ${district}`,
          `gravel bike rental ${city}`,
          `gravel bike rental ${city} ${district}`,
          `bike rental ${city}`,
          `bike hire ${city}`,
        ],
    openGraph: {
      type: "website",
      locale: isGerman ? "de_DE" : "en_US",
      url: `${siteConfig.url}${localizedPath}`,
      siteName: siteConfig.name,
      title,
      description,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: isGerman
            ? `Your Bike Rental - Rennrad- und Gravel-Verleih in ${city}`
            : `Your Bike Rental - road and gravel bike rental in ${city}`,
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

export async function RentalPage({ searchParams, location, locale }: PageProps) {
  const params = await searchParams;
  const lang = locale ?? resolveLocale(params?.lang);
  const t = translations[lang];
  const copy = getLocationCopy(location, lang);
  const localFaqItems = faqItems.map((item, index) =>
    index === 1 ? { ...item, answer: { ...item.answer, [lang]: copy.faqPickup } } : item,
  );
  const localServices = services.map((service, index) =>
    index === 1 ? { ...service, text: { ...service.text, [lang]: copy.aboutRental } } : service,
  );
  const localPortfolioItems =
    location.key !== "munich"
      ? portfolioItems
          .filter((item) => item.title === "Endurace CF SL 8" || item.title === "Grail CF SL 7")
          .map((item) => ({
            ...item,
            price: location.key === "regensburg" ? { de: "49€/Tag", en: "49€/day" } : { de: "59€/Tag", en: "59€/day" },
          }))
      : portfolioItems;
  const localPriceItems =
    location.key === "regensburg"
      ? priceItems.map((item, index) => (index === 0 ? { ...item, cost: { de: "ab 49€", en: "from 49€" } } : item))
      : priceItems;
  const showLocationSelection = params?.standortauswahl === "1";
  const featuredPost = blogPosts[0];

  return (
    <main className="site-shell">
      <HomeTopbar
        lang={lang}
        homePath={getLocalizedLocationPath(location, lang)}
        showBlog={location.key === "munich"}
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
              <span>{`${location.city[lang]} – ${location.district[lang]}`}</span>
            </span>
            <h1 className="hero__title">{copy.heroTitle}</h1>
            <p className="hero__intro">{copy.heroIntro}</p>
            <LocationSelectionPrompt lang={lang} currentCity={location.city[lang]} />

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
                alt={
                  lang === "en"
                    ? `Well-maintained road and gravel bikes for rent in ${location.city[lang]}`
                    : `Gepflegte Rennräder und Gravelbikes zur Miete in ${location.city[lang]}`
                }
                className="hero-frame__image"
                fill
                priority
                unoptimized
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

      {location.key === "munich" ? (
        <section className="section section--maintenance-promo">
          <div className="container">
            <div className="maintenance-card">
              <div className="maintenance-card__content">
                <span className="maintenance-card__eyebrow">{t.maintenancePromo.eyebrow}</span>
                <h2 className="maintenance-card__title">{copy.maintenanceTitle}</h2>
                <p className="maintenance-card__text">{copy.maintenanceText}</p>
              </div>

              <Link
                className="button--arrow maintenance-card__link"
                href={`/wartung${lang === "de" ? "" : "?lang=en"}`}
              >
                <span>{t.maintenancePromo.cta}</span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <PortfolioSection
        lang={lang}
        translations={{
          portfolio: t.portfolio,
          modal: t.modal,
          form: t.form,
        }}
        portfolioItems={localPortfolioItems}
        showEnduracePromo={location.key === "munich"}
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
                <p>{copy.pricePromise}</p>
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
                {localServices.map((service) => (
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
            <p className="section-copy">{copy.priceIntro}</p>
          </div>

          <div className="price-grid__list">
            {localPriceItems.map((item) => (
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
            {localFaqItems.map((item) => (
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
            eyebrow={t.locationSection.eyebrow}
            title={copy.locationTitle}
            intro={copy.locationIntro}
            notice={copy.locationNotice}
            addressLabel={copy.locationLabel}
            address={location.address}
            mapImage={location.mapImage}
            mapsUrl={location.mapsUrl}
            mapsLabel={lang === "de" ? "In Google Maps öffnen" : "Open in Google Maps"}
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
            defaultLocation={location.key}
            translations={{
              portfolio: t.portfolio,
              modal: t.modal,
              form: t.form,
            }}
          />
        </div>
      </section>

      {location.key === "munich" ? (
        <section id="blog" className="section section--blog">
          <div className="container blog-section">
            <div className="section-heading">
              <span className="section-heading__eyebrow">{t.blogSection.eyebrow}</span>
              <h2 className="section-heading__title">{t.blogSection.title}</h2>
            </div>

            <p className="section-copy">{copy.blogIntro}</p>

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
      ) : null}

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__main">
            <div className="footer__brand">
              <span className="footer__title">Your Bike Rental</span>
            </div>

            <ul className="footer-links">
              {[
                { href: getLocalizedLocationPath(location, lang), label: "Startseite" },
                ...(location.key === "munich" ? [{ href: "/blog", label: "Blog" }] : []),
                { href: "/impressum", label: "Impressum" },
                { href: "/datenschutzerklaerung", label: "Datenschutzerklärung" },
              ].map((item) => (
                <li key={item.href} className="footer-links__item">
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <ul className="footer-meta">
            {rentalLocationConfigs.map((footerLocation) => (
              <li key={footerLocation.path} className="footer-meta__item footer-meta__item--location">
                <MapPin className="footer-meta__icon" aria-hidden="true" />
                <Link href={getLocalizedLocationPath(footerLocation, lang)}>
                  {`${footerLocation.city[lang]}, ${footerLocation.district[lang]}`}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </footer>
      <LocationSelectionDialog lang={lang} open={showLocationSelection} />
    </main>
  );
}

export default function RootRedirect() {
  permanentRedirect(`${defaultRentalLocation.path}?standortauswahl=1`);
}
