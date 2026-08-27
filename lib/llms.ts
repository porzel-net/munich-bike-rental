import { faqItems } from "./home-content";
import { getDatabase } from "./db/client";
import { getLocationInventory } from "./inventory/repository";
import { rentalLocationConfigs } from "./rental-locations";
import { siteConfig } from "./site";

function formatLlmPrice(value: string) {
  return value.replaceAll("€", " EUR");
}

function bikePriceText(bike: { weekdayPrice: { en: string }; weekendPrice: { en: string } }) {
  return `${formatLlmPrice(bike.weekdayPrice.en)}; ${formatLlmPrice(bike.weekendPrice.en)}`;
}

function formatBikeLine(bike: ReturnType<typeof getLocationInventory>["portfolioItems"][number]) {
  return `- ${bike.title} (${bike.subtitle.en}) - ${bikePriceText(bike)}. ${bike.description.en}`;
}

function formatFullBikeSection(bike: ReturnType<typeof getLocationInventory>["portfolioItems"][number]) {
  const facts = bike.facts.map((fact) => `- ${fact.label.en}: ${fact.value.en}`).join("\n");
  const equipment = bike.equipment.en.map((item) => `- ${item}`).join("\n");

  return [
    `### ${bike.title}`,
    "",
    `- Sizes: ${bike.subtitle.en}`,
    `- Price: ${bikePriceText(bike)}`,
    `- Summary: ${bike.description.en}`,
    `- Description:`,
    facts,
    `- Equipment:`,
    equipment,
  ].join("\n");
}

function currentLocationPricing() {
  const database = getDatabase();
  return rentalLocationConfigs
    .map((location) => {
      const inventory = getLocationInventory(database, location.key);
      const bikes = inventory.portfolioItems.map(formatBikeLine).join("\n");
      const discounts = inventory.discounts
        .map((discount) => `- ${discount.label.en}: ${discount.percentage}%`)
        .join("\n");
      return `### ${location.city.en}\n\n${bikes || "- No currently catalogued bikes."}\n\nDiscounts:\n${discounts || "- No active discounts."}`;
    })
    .join("\n\n");
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

> Personal road and gravel bike rental across southern Germany with owned bikes, direct contact and clear pricing.

This website is for a local bicycle rental service. The most useful pages are the home page, the legal pages, and the contact section. If you need location, prices, or bike details, use the home page sections below.

## Core pages

- [Munich road & gravel bike rental](${siteConfig.url}/de/rennradverleih/münchen/maxvorstadt): Available bikes, prices, FAQ and contact in Munich-Maxvorstadt.
- [Regensburg road & gravel bike rental](${siteConfig.url}/de/rennradverleih/regensburg/altstadt): Available bikes, prices, FAQ and contact in Regensburg-Altstadt.
- [Lindau road & gravel bike rental](${siteConfig.url}/de/rennradverleih/lindau/aeschach): Available bikes, prices, FAQ and contact in Lindau-Aeschach.
- [Friedrichshafen road & gravel bike rental](${siteConfig.url}/de/rennradverleih/friedrichshafen/innenstadt): Available bikes, prices, FAQ and contact in Friedrichshafen city centre.
- [Konstanz road & gravel bike rental](${siteConfig.url}/de/rennradverleih/konstanz/altstadt): Available bikes, prices, FAQ and contact in Konstanz-Altstadt.
- [Blog](${siteConfig.url}/blog): Short posts about routes and bike topics.
- [Imprint](${siteConfig.url}/impressum): Legal notice and operator details.
- [Privacy policy](${siteConfig.url}/datenschutzerklaerung): Data processing and privacy information.
- [Terms and conditions](${siteConfig.url}/de/agb): General terms and conditions for bicycle rental.
- [Sitemap](${siteConfig.url}/sitemap.xml): Machine-readable list of indexable pages.

## Key facts

- Business name: ${siteConfig.name}
- Locations: Munich-Maxvorstadt, Regensburg-Altstadt, Lindau-Aeschach, Friedrichshafen city centre and Konstanz-Altstadt, Germany
- Email: ${siteConfig.email}
- Phone: ${siteConfig.phone}
- Website: ${siteConfig.url}
- Positioning: personal, owner-run bike rental with only owned bikes
- Primary audience: people looking to rent a road or gravel bike in Munich or Regensburg

## Current bikes and pricing

${currentLocationPricing()}

## Rental and contact

- Reservations start from the contact form on the home page.
- The first contact happens through the form; follow-up happens by email.
- The reservation flow asks for name, contact details, phone number, date range, pickup/drop-off times, equipment preferences and a message.
- The site emphasizes direct owner contact instead of anonymous marketplace-style renting.
- Search intent focus: Rennrad Verleih, Gravelbike Verleih, road bike rental, gravel bike rental.

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

${siteConfig.name} is a local road and gravel bike rental business in Munich-Maxvorstadt and Regensburg-Altstadt. The site focuses on owned endurance, gravel, all-round and aero bikes, direct booking, clear pricing, and a personal owner-run experience.

The project uses a single-page home experience with sections for bikes, prices, FAQ and contact, plus legal pages for imprint and privacy policy.

## Site summary

- Domain: ${siteConfig.url}
- Locations: Munich-Maxvorstadt, Regensburg-Altstadt, Lindau-Aeschach, Friedrichshafen city centre and Konstanz-Altstadt, Germany
- Email: ${siteConfig.email}
- Phone: ${siteConfig.phone}
- Address: ${siteConfig.address.streetAddress}, ${siteConfig.address.postalCode} ${siteConfig.address.addressLocality}
- Business model: rental of owned bicycles only
- Main product type: bike rental with road, gravel, all-round and aero road bikes

## Important pages

- [Munich road & gravel bike rental](${siteConfig.url}/de/rennradverleih/münchen/maxvorstadt): Main rental page for Munich-Maxvorstadt.
- [Regensburg road & gravel bike rental](${siteConfig.url}/de/rennradverleih/regensburg/altstadt): Main rental page for Regensburg-Altstadt.
- [Lindau road & gravel bike rental](${siteConfig.url}/de/rennradverleih/lindau/aeschach): Main rental page for Lindau-Aeschach.
- [Friedrichshafen road & gravel bike rental](${siteConfig.url}/de/rennradverleih/friedrichshafen/innenstadt): Main rental page for Friedrichshafen city centre.
- [Konstanz road & gravel bike rental](${siteConfig.url}/de/rennradverleih/konstanz/altstadt): Main rental page for Konstanz-Altstadt.
- [Imprint](${siteConfig.url}/impressum): Legal operator details.
- [Privacy policy](${siteConfig.url}/datenschutzerklaerung): Privacy and data processing information.
- [Terms and conditions](${siteConfig.url}/en/agb): General terms and conditions for bicycle rental.
- [Sitemap](${siteConfig.url}/sitemap.xml): Indexable page list.
- [Robots](${siteConfig.url}/robots.txt): Crawl instructions.

## Hero message

The homepage presents the business as a passion-driven, owner-operated bike rental service in Munich and Regensburg. The main promise is:

- personal contact
- carefully maintained bikes
- only owned bikes, not third-party inventory
- simple reservation flow
- road, gravel, endurance, all-round and aero bike options

## City focus

- Munich content should emphasize Munich-Maxvorstadt, the local pickup point, and the main rental base.
- Regensburg content should be handled on the home page with the second pickup location and the same core rental offer.
- For city-specific questions, answer from the home page.
- Both German and English versions should keep the same city and category signals so search intent remains consistent across locales.

## Current bikes and pricing

${rentalLocationConfigs
  .map((location) => {
    const inventory = getLocationInventory(getDatabase(), location.key);
    return `### ${location.city.en}\n\n${inventory.portfolioItems.map(formatFullBikeSection).join("\n\n") || "No currently catalogued bikes."}\n\nDiscounts:\n${inventory.discounts.map((discount) => `- ${discount.label.en}: ${discount.percentage}%`).join("\n") || "- No active discounts."}`;
  })
  .join("\n\n")}

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
- Search focus terms include: Rennrad Verleih, Gravelbike Verleih, road bike rental, gravel bike rental, Munich, Regensburg, Maxvorstadt, Altstadt.
`;
}
