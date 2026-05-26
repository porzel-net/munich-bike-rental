import { siteConfig } from "./site";

const bikes = [
  {
    name: "Endurace CF SL 8 Di2",
    size: "S / M / L",
    price: "39 EUR/day",
    summary:
      "Balanced road bike for fast long rides and comfortable touring in and around Munich.",
  },
  {
    name: "Ultimate CF SL 7 eTap AXS",
    size: "M / L",
    price: "45 EUR/day",
    summary:
      "Light all-round bike for training rides, sporty city use and quick weekend trips.",
  },
  {
    name: "Aeroad CF SL 8 Disc",
    size: "S / M",
    price: "80 EUR/day",
    summary:
      "Aero road bike for maximum speed and a direct, race-oriented ride feel.",
  },
];

const faq = [
  [
    "How does booking work?",
    "Customers send a request through the contact form, email, WhatsApp or phone. The rental period, pickup and price are then confirmed directly.",
  ],
  [
    "Where is pickup?",
    "Pickup is in Munich-Maxvorstadt and the exact process is coordinated after the inquiry.",
  ],
  [
    "Are the bikes insured?",
    "Yes. The site states that all bikes are covered by commercial insurance.",
  ],
];

export function buildLlmsTxt() {
  return `# ${siteConfig.name}

> Personal bike rental in Munich-Maxvorstadt. The site offers well-maintained road bikes, direct contact, clear pricing and a simple reservation flow.

This website is for a local bicycle rental service. The most useful pages are the home page, the legal pages, and the contact section. If you need location, prices, or bike details, use the home page sections below.

## Core pages

- [Home](${siteConfig.url}/): Overview, available bikes, prices, FAQ and contact.
- [Imprint](${siteConfig.url}/impressum): Legal notice and operator details.
- [Privacy policy](${siteConfig.url}/datenschutzerklaerung): Data processing and privacy information.
- [Sitemap](${siteConfig.url}/sitemap.xml): Machine-readable list of indexable pages.

## Key facts

- Business name: ${siteConfig.name}
- Location: Munich-Maxvorstadt, Germany
- Email: ${siteConfig.email}
- Phone: ${siteConfig.phone}
- Website: ${siteConfig.url}
- Positioning: personal, owner-run bike rental with only owned bikes
- Primary audience: people looking to rent a road bike in Munich

## Bikes

${bikes
  .map(
    (bike) =>
      `- ${bike.name} (${bike.size}) - ${bike.price}. ${bike.summary}`
  )
  .join("\n")}

## Rental and contact

- Reservations start from the contact form on the home page.
- The site supports email, WhatsApp and telephone contact.
- The reservation flow asks for name, contact details, date range and a message.
- The site emphasizes direct owner contact instead of anonymous marketplace-style renting.

## FAQ

${faq.map(([question, answer]) => `- ${question} ${answer}`).join("\n")}

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

${siteConfig.name} is a local bike rental business in Munich-Maxvorstadt. The site focuses on road bikes, direct booking, clear pricing, and a personal owner-run experience.

The project uses a single-page home experience with sections for bikes, prices, FAQ and contact, plus legal pages for imprint and privacy policy.

## Site summary

- Domain: ${siteConfig.url}
- Location: Munich-Maxvorstadt, Germany
- Email: ${siteConfig.email}
- Phone: ${siteConfig.phone}
- Address: ${siteConfig.address.streetAddress}, ${siteConfig.address.postalCode} ${siteConfig.address.addressLocality}
- Business model: rental of owned bicycles only
- Main product type: road bikes

## Important pages

- [Home](${siteConfig.url}/): Main landing page with hero, bikes, prices, FAQ and contact.
- [Imprint](${siteConfig.url}/impressum): Legal operator details.
- [Privacy policy](${siteConfig.url}/datenschutzerklaerung): Privacy and data processing information.
- [Sitemap](${siteConfig.url}/sitemap.xml): Indexable page list.
- [Robots](${siteConfig.url}/robots.txt): Crawl instructions.

## Hero message

The homepage presents the business as a passion-driven, owner-operated bike rental in Munich. The main promise is:

- personal contact
- carefully maintained bikes
- only owned bikes, not third-party inventory
- simple reservation flow

## Bikes and pricing

### Endurace CF SL 8 Di2

- Sizes: S / M / L
- Price: 39 EUR/day
- Summary: balanced road bike for fast long rides and comfortable touring
- Key details on site: Shimano Ultegra Di2, hydraulic disc brakes, DT Swiss wheels

### Ultimate CF SL 7 eTap AXS

- Sizes: M / L
- Price: 45 EUR/day
- Summary: lightweight all-round bike for training and sporty city rides
- Key details on site: SRAM Rival eTap AXS 2x12, hydraulic disc brakes, DT Swiss wheels

### Aeroad CF SL 8 Disc

- Sizes: S / M
- Price: 80 EUR/day
- Summary: aero bike for maximum speed and a race-oriented ride feel
- Key details on site: Shimano Ultegra R8000 2x11, DT Swiss ARC 1600 wheels

## Prices and discounts

- Road bikes start from 39 EUR.
- Weekend discount: 10 percent.
- From 3 days: 20 percent.
- Student discount: 20 percent.
- Accessories start from 5 EUR.

## FAQ summary

${faq
  .map(
    ([question, answer]) =>
      `- ${question}\n  - ${answer}`
  )
  .join("\n\n")}

## Contact flow

- Visitors can contact the business via the form, email, WhatsApp, or phone.
- The form requests name, contact details, rental dates, and a message.
- When a specific bike is reserved from the site, the contact form is prefilled with a booking draft.

## SEO / LLM notes

- This file is meant to help language models quickly understand the site.
- The most reliable source for current facts is still the rendered homepage and the legal pages.
- Keep answers grounded in the site content; do not infer inventory, availability or policies that are not stated.
`;
}
