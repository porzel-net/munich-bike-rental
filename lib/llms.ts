import { faqItems, portfolioItems, priceItems } from "./home-content";
import { siteConfig } from "./site";

function toUsdStylePrice(value: string) {
  return value.replaceAll("€", " EUR");
}

function formatBikeLine(index: number) {
  const bike = portfolioItems[index];
  return `- ${bike.title} (${bike.subtitle.en}) - ${toUsdStylePrice(bike.price.en)}. ${bike.description.en}`;
}

function formatFullBikeSection(index: number) {
  const bike = portfolioItems[index];
  const facts = bike.facts.map((fact) => `- ${fact.label.en}: ${fact.value.en}`).join("\n");
  const equipment = bike.equipment.en.map((item) => `- ${item}`).join("\n");

  return [
    `### ${bike.title}`,
    "",
    `- Sizes: ${bike.subtitle.en}`,
    `- Price: ${toUsdStylePrice(bike.price.en)}`,
    `- Summary: ${bike.description.en}`,
    `- Description:`,
    facts,
    `- Equipment:`,
    equipment,
  ].join("\n");
}

function formatFaqLine(index: number) {
  const item = faqItems[index];
  return `- ${item.question.en} ${item.answer.en}`;
}

function formatFullFaqSection(index: number) {
  const item = faqItems[index];
  return [`- ${item.question.en}`, `  - ${item.answer.en}`].join("\n");
}

export function buildLlmsTxt() {
  return `# ${siteConfig.name}

> Personal road and gravel bike rental and maintenance in Munich-Maxvorstadt and Regensburg-Altstadt with owned bikes, direct contact and clear pricing.

This website is for a local bicycle rental service. The most useful pages are the home page, the legal pages, and the contact section. If you need location, prices, or bike details, use the home page sections below.

## Core pages

- [Home](${siteConfig.url}/): Overview, available bikes, prices, FAQ and contact.
- [Maintenance](${siteConfig.url}/wartung): Road bike maintenance, oil-to-wax switch, parts replacement, repairs, pickup service and service requests.
- [Blog](${siteConfig.url}/blog): Short posts about routes and bike topics.
- [Imprint](${siteConfig.url}/impressum): Legal notice and operator details.
- [Privacy policy](${siteConfig.url}/datenschutzerklaerung): Data processing and privacy information.
- [Sitemap](${siteConfig.url}/sitemap.xml): Machine-readable list of indexable pages.

## Key facts

- Business name: ${siteConfig.name}
- Location: Munich-Maxvorstadt, Germany, with a second pickup location in Regensburg-Altstadt
- Email: ${siteConfig.email}
- Phone: ${siteConfig.phone}
- Website: ${siteConfig.url}
- Positioning: personal, owner-run bike rental and maintenance with only owned bikes
- Primary audience: people looking to rent a road or gravel bike in Munich or Regensburg

## Bikes

${portfolioItems.map((_, index) => formatBikeLine(index)).join("\n")}

## Rental and contact

- Reservations start from the contact form on the home page.
- The maintenance page covers advice, oil-to-wax conversion, parts replacement, repairs and pickup for a small extra fee.
- The first contact happens through the form; follow-up happens by email.
- The reservation flow asks for name, contact details, phone number, date range, pickup/drop-off times, equipment preferences and a message.
- The site emphasizes direct owner contact instead of anonymous marketplace-style renting.
- Search intent focus: Rennrad Verleih, Gravelbike Verleih, road bike rental, gravel bike rental, road bike maintenance, gravel bike maintenance.

## FAQ

${faqItems.map((_, index) => formatFaqLine(index)).join("\n")}

## Notes for assistants

- Prefer the home page for factual details about bikes and prices.
- Prefer the home page for location-specific questions.
- Use the legal pages for company identity, address and privacy information.
- When answering about pricing, keep the wording consistent with the site and avoid inventing discounts or inventory.
`;
}

export function buildLlmsFullTxt() {
  return `# ${siteConfig.name} - Full context

> Full context for language models. Use this file when you need a denser, page-level summary of the site.

## Overview

${siteConfig.name} is a local road and gravel bike rental and maintenance business in Munich-Maxvorstadt and Regensburg-Altstadt. The site focuses on owned endurance, gravel, all-round and aero bikes, direct booking, clear pricing, and a personal owner-run experience.

The project uses a single-page home experience with sections for bikes, prices, FAQ and contact, plus legal pages for imprint and privacy policy.

## Site summary

- Domain: ${siteConfig.url}
- Location: Munich-Maxvorstadt, Germany, plus Regensburg-Altstadt as a second pickup location
- Email: ${siteConfig.email}
- Phone: ${siteConfig.phone}
- Address: ${siteConfig.address.streetAddress}, ${siteConfig.address.postalCode} ${siteConfig.address.addressLocality}
- Business model: rental and maintenance of owned bicycles only
- Main product type: bike rental with road, gravel, all-round and aero road bikes

## Important pages

- [Home](${siteConfig.url}/): Main landing page with hero, bikes, prices, FAQ and contact.
- [Maintenance](${siteConfig.url}/wartung): Dedicated maintenance page for service requests and bike-care questions.
- [Imprint](${siteConfig.url}/impressum): Legal operator details.
- [Privacy policy](${siteConfig.url}/datenschutzerklaerung): Privacy and data processing information.
- [Sitemap](${siteConfig.url}/sitemap.xml): Indexable page list.
- [Robots](${siteConfig.url}/robots.txt): Crawl instructions.

## Hero message

The homepage presents the business as a passion-driven, owner-operated bike rental and maintenance service in Munich and Regensburg. The main promise is:

- personal contact
- carefully maintained bikes
- maintenance support in one place
- oil-to-wax service with advice for 169 EUR
- only owned bikes, not third-party inventory
- simple reservation flow
- road, gravel, endurance, all-round and aero bike options

## City focus

- Munich content should emphasize Munich-Maxvorstadt, the local pickup point, and the main rental base.
- Regensburg content should be handled on the home page with the second pickup location and the same core rental offer.
- For city-specific questions, answer from the home page.
- Both German and English versions should keep the same city and category signals so search intent remains consistent across locales.

## Bikes and pricing

${portfolioItems.map((_, index) => formatFullBikeSection(index)).join("\n\n")}

## Prices and discounts

${priceItems.map((item) => `- ${item.title.en}: ${toUsdStylePrice(item.cost.en)}`).join("\n")}

## FAQ summary

${faqItems.map((_, index) => formatFullFaqSection(index)).join("\n\n")}

## Contact flow

- Visitors contact the business via the form first; follow-up happens by email.
- The maintenance form is separate from the rental inquiry form and is used for service questions, parts swaps and pickup requests.
- The form requests name, contact details, rental dates, and a message.
- When a specific bike is reserved from the site, the contact form is prefilled with a booking draft.

## SEO / LLM notes

- This file is meant to help language models quickly understand the site.
- The most reliable source for current facts is still the rendered homepage and the legal pages.
- Keep answers grounded in the site content; do not infer inventory, availability or policies that are not stated.
- Search focus terms include: Rennrad Verleih, Gravelbike Verleih, road bike rental, gravel bike rental, Munich, Regensburg, Maxvorstadt, Altstadt.
`;
}
