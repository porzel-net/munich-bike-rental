import type { Locale } from "./home-content";
import { faqItems, portfolioItems } from "./home-content";
import type { BlogPost } from "./blog-content";
import { getBlogImageSrc, getBlogPostPlainText } from "./blog-content";
import { siteConfig } from "./site";
import { getLocalizedLocationPath, getLocationCopy, type RentalLocationConfig } from "./rental-locations";

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function getOfferCatalog(location: RentalLocationConfig, locale: Locale) {
  const catalog = portfolioItems.map((item, index) => ({
    "@type": "Offer",
    position: index + 1,
    name: item.title,
    description: item.description[locale],
    price: Number(item.price[locale].replace(/[^\d,.-]/g, "").replace(",", ".")),
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
  }));

  if (location.key === "munich") {
    return catalog;
  }

  return catalog
    .filter((offer) => offer.name === "Endurace CF SL 8" || offer.name === "Grail CF SL 7")
    .map((offer) => ({ ...offer, price: location.key === "regensburg" ? 49 : 59 }));
}

function getFaqEntries(location: RentalLocationConfig, locale: Locale) {
  const copy = getLocationCopy(location, locale);

  return faqItems.map((item, index) => ({
    "@type": "Question",
    name: item.question[locale],
    acceptedAnswer: {
      "@type": "Answer",
      text: index === 1 ? copy.faqPickup : item.answer[locale],
    },
  }));
}

export function getRentalStructuredDataJson(location: RentalLocationConfig, locale: Locale) {
  const isGerman = locale === "de";
  const copy = getLocationCopy(location, locale);
  const pageUrl = `${siteConfig.url}${getLocalizedLocationPath(location, locale)}`;
  const city = location.city[locale];
  const district = location.district[locale];
  const localOfferCatalog = getOfferCatalog(location, locale);

  return serializeJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}#website`,
        name: "Your Bike Rental",
        alternateName: "Your Bike Rental",
        url: siteConfig.url,
        description: copy.heroIntro,
        inLanguage: isGerman ? "de-DE" : "en-US",
        keywords: isGerman
          ? [`Rennradverleih ${city}`, `Gravelbike Verleih ${city}`, `Rennradverleih ${city} ${district}`]
          : [`road bike rental ${city}`, `gravel bike rental ${city}`, `road bike rental ${city} ${district}`],
      },
      {
        "@type": "LocalBusiness",
        "@id": `${pageUrl}#localbusiness`,
        name: siteConfig.name,
        description: copy.heroIntro,
        url: pageUrl,
        telephone: siteConfig.phoneE164,
        email: siteConfig.email,
        image: `${siteConfig.url}/assets/img/hero/1.jpg`,
        priceRange: siteConfig.priceRange,
        areaServed: [city, district],
        serviceType: isGerman ? "Rennrad- und Gravel-Verleih" : "Road and gravel bike rental",
        hasMap: location.mapsUrl,
        keywords: isGerman
          ? [`Rennradverleih ${city}`, `Gravelbike Verleih ${city}`]
          : [`road bike rental ${city}`, `gravel bike rental ${city}`],
        address: {
          "@type": "PostalAddress",
          streetAddress: location.streetAddress,
          postalCode: location.postalCode,
          addressLocality: location.city.de,
          addressRegion: siteConfig.address.addressRegion,
          addressCountry: siteConfig.address.addressCountry,
        },
        mainEntityOfPage: pageUrl,
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Bike Rental Angebote",
          itemListElement: localOfferCatalog,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: isGerman ? "Startseite" : "Home",
            item: siteConfig.url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: isGerman ? `Rennradverleih ${city}` : `Road bike rental ${city}`,
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: getFaqEntries(location, locale),
      },
    ],
  });
}

export function getMaintenanceStructuredDataJson(locale: Locale) {
  const isGerman = locale === "de";
  const pageUrl = isGerman ? `${siteConfig.url}/wartung` : `${siteConfig.url}/wartung?lang=en`;

  return serializeJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Your Bike Maintenance",
        url: siteConfig.url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: isGerman ? "Startseite" : "Home",
            item: siteConfig.url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: isGerman ? "Wartung" : "Maintenance",
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "Service",
        name: isGerman ? "Rennrad- und Gravel-Wartung" : "Road and gravel bike servicing",
        description: isGerman
          ? "Wartung fuer Rennraeder und Gravelbikes in Muenchen-Maxvorstadt mit Beratung, Teiletausch, Reparaturen und Oel-zu-Wachs-Umstieg."
          : "Road and gravel bike servicing in Munich-Maxvorstadt with advice, part swaps, repairs and oil-to-wax conversion.",
        serviceType: isGerman ? "Fahrradwartung fuer Rennrad und Gravel" : "Bike servicing for road and gravel bikes",
        keywords: isGerman
          ? ["Rennrad Wartung München", "Gravelbike Wartung München"]
          : ["road bike maintenance Munich", "gravel bike maintenance Munich"],
        areaServed: ["München", "München-Maxvorstadt", "Bayern"],
        provider: {
          "@type": "LocalBusiness",
          name: siteConfig.name,
          url: siteConfig.url,
          telephone: siteConfig.phoneE164,
          email: siteConfig.email,
          image: `${siteConfig.url}/assets/img/hero/1.jpg`,
          address: {
            "@type": "PostalAddress",
            streetAddress: siteConfig.address.streetAddress,
            postalCode: siteConfig.address.postalCode,
            addressLocality: siteConfig.address.addressLocality,
            addressRegion: siteConfig.address.addressRegion,
            addressCountry: siteConfig.address.addressCountry,
          },
        },
        url: pageUrl,
      },
    ],
  });
}

export function getBlogPostStructuredDataJson(post: BlogPost, locale: Locale) {
  const title = post.title[locale];
  const description = post.excerpt[locale];
  const articleBody = getBlogPostPlainText(post, locale);
  const language = locale === "de" ? "de-DE" : "en-US";
  const url = `${siteConfig.url}/blog/${post.slug}`;

  return serializeJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: locale === "de" ? "Startseite" : "Home",
            item: siteConfig.url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: locale === "de" ? "Blog" : "Blog",
            item: `${siteConfig.url}/blog`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: title,
            item: url,
          },
        ],
      },
      {
        "@type": "BlogPosting",
        headline: title,
        description,
        articleSection: post.category[locale],
        inLanguage: language,
        datePublished: post.publishedAt,
        dateModified: post.publishedAt,
        image: `${siteConfig.url}${getBlogImageSrc(post.heroImage)}`,
        author: {
          "@type": "Organization",
          name: siteConfig.name,
          url: siteConfig.url,
        },
        publisher: {
          "@type": "Organization",
          name: siteConfig.name,
          url: siteConfig.url,
          logo: {
            "@type": "ImageObject",
            url: `${siteConfig.url}/favicon.png`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": url,
        },
        url,
        keywords: [
          "Rennradtouren München",
          "Rennrad München",
          "Touren rund um München",
          "Fünfseenland",
          "Starnberger See",
        ],
        wordCount: articleBody.split(/\s+/).filter(Boolean).length,
        articleBody,
      },
    ],
  });
}
