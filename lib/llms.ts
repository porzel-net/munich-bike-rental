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
  const facts = bike.facts
    .map((fact) => `- ${fact.label.en}: ${fact.value.en}`)
    .join("\n");
  const equipment = bike.equipment.en.map((item) => `- ${item}`).join("\n");

  return [
    `### ${bike.title}`,
    "",
    `- Sizes: ${bike.subtitle.en}`,
    `- Price: ${toUsdStylePrice(bike.price.en)}`,
    `- Summary: ${bike.description.en}`,
    `- Key details:`,
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

> Personal bike rental and maintenance in Munich-Maxvorstadt with owned endurance, gravel, all-round and aero bikes, direct contact and clear pricing.

This website is for a local bicycle rental service. The most useful pages are the home page, the legal pages, and the contact section. If you need location, prices, or bike details, use the home page sections below.

## Core pages

- [Home](${siteConfig.url}/): Overview, available bikes, prices, FAQ and contact.
- [Maintenance](${siteConfig.url}/wartung): Road bike maintenance, oil-to-wax switch, and small service requests.
- [Blog](${siteConfig.url}/blog): Short posts about routes and bike topics.
- [Imprint](${siteConfig.url}/impressum): Legal notice and operator details.
- [Privacy policy](${siteConfig.url}/datenschutzerklaerung): Data processing and privacy information.
- [Sitemap](${siteConfig.url}/sitemap.xml): Machine-readable list of indexable pages.

## Key facts

- Business name: ${siteConfig.name}
- Location: Munich-Maxvorstadt, Germany
- Email: ${siteConfig.email}
- Phone: ${siteConfig.phone}
- Website: ${siteConfig.url}
- Positioning: personal, owner-run bike rental and maintenance with only owned bikes
- Primary audience: people looking to rent an endurance, gravel, all-round or aero bike in Munich

## Bikes

${portfolioItems.map((_, index) => formatBikeLine(index)).join("\n")}

## Rental and contact

- Reservations start from the contact form on the home page.
- The first contact happens through the form; follow-up happens by email.
- The reservation flow asks for name, contact details, date range and a message.
- The site emphasizes direct owner contact instead of anonymous marketplace-style renting.

## FAQ

${faqItems.map((_, index) => formatFaqLine(index)).join("\n")}

## Notes for assistants

- Prefer the home page for factual details about bikes and prices.
- Use the legal pages for company identity, address and privacy information.
- When answering about pricing, keep the wording consistent with the site and avoid inventing discounts or inventory.
`;
}

export function buildLlmsFullTxt() {
  return `# ${siteConfig.name} - Full context

> Full context for language models. Use this file when you need a denser, page-level summary of the site.

## Overview

${siteConfig.name} is a local bike rental and maintenance business in Munich-Maxvorstadt. The site focuses on owned endurance, gravel, all-round and aero bikes, direct booking, clear pricing, and a personal owner-run experience.

The project uses a single-page home experience with sections for bikes, prices, FAQ and contact, plus legal pages for imprint and privacy policy.

## Site summary

- Domain: ${siteConfig.url}
- Location: Munich-Maxvorstadt, Germany
- Email: ${siteConfig.email}
- Phone: ${siteConfig.phone}
- Address: ${siteConfig.address.streetAddress}, ${siteConfig.address.postalCode} ${siteConfig.address.addressLocality}
- Business model: rental and maintenance of owned bicycles only
- Main product type: bike rental with endurance, gravel, all-round and aero road bikes

## Important pages

- [Home](${siteConfig.url}/): Main landing page with hero, bikes, prices, FAQ and contact.
- [Maintenance](${siteConfig.url}/wartung): Dedicated maintenance page for service requests and bike-care questions.
- [Imprint](${siteConfig.url}/impressum): Legal operator details.
- [Privacy policy](${siteConfig.url}/datenschutzerklaerung): Privacy and data processing information.
- [Sitemap](${siteConfig.url}/sitemap.xml): Indexable page list.
- [Robots](${siteConfig.url}/robots.txt): Crawl instructions.

## Hero message

The homepage presents the business as a passion-driven, owner-operated bike rental and maintenance service in Munich. The main promise is:

- personal contact
- carefully maintained bikes
- maintenance support in one place
- only owned bikes, not third-party inventory
- simple reservation flow
- endurance, gravel, all-round and aero bike options

## Bikes and pricing

${portfolioItems.map((_, index) => formatFullBikeSection(index)).join("\n\n")}

## Prices and discounts

${priceItems
  .map((item) => `- ${item.title.en}: ${toUsdStylePrice(item.cost.en)}`)
  .join("\n")}

## FAQ summary

${faqItems.map((_, index) => formatFullFaqSection(index)).join("\n\n")}

## Contact flow

- Visitors contact the business via the form first; follow-up happens by email.
- The form requests name, contact details, rental dates, and a message.
- When a specific bike is reserved from the site, the contact form is prefilled with a booking draft.

## SEO / LLM notes

- This file is meant to help language models quickly understand the site.
- The most reliable source for current facts is still the rendered homepage and the legal pages.
- Keep answers grounded in the site content; do not infer inventory, availability or policies that are not stated.
`;
}
