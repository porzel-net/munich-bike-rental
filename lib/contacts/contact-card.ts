import { siteConfig } from "../site";

export type ContactCardPerson = {
  name: string;
  phone: string;
};

export function escapeVCard(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([,;])/g, "\\$1")
    .replace(/[\r\n]+/g, "\\n");
}

export function personToVCard(person: ContactCardPerson) {
  const name = person.name.trim();
  const phone = person.phone.trim();
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(name)}`,
    `N:${escapeVCard(name)};;;;`,
    `TEL;TYPE=CELL,VOICE:${escapeVCard(phone)}`,
    "ORG:Your Bike Rental",
    "END:VCARD",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function companyToVCard(staff: ContactCardPerson[]) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "PRODID:-//Your Bike Rental//Customer Contact//DE",
    "FN:Your Bike Rental",
    "N:Your Bike Rental;;;;",
    "ORG:Your Bike Rental",
    `TEL;TYPE=WORK,VOICE;PREF=1:${siteConfig.phoneE164}`,
    `EMAIL;TYPE=WORK;PREF=1:${escapeVCard(siteConfig.email)}`,
    `URL:${escapeVCard(siteConfig.url)}`,
    `ADR;TYPE=WORK:;;${escapeVCard(siteConfig.address.streetAddress)};${escapeVCard(siteConfig.address.addressLocality)};${escapeVCard(siteConfig.address.addressRegion)};${escapeVCard(siteConfig.address.postalCode)};${escapeVCard(siteConfig.address.addressCountry)}`,
    "X-ABShowAs:COMPANY",
  ];
  for (const [index, person] of staff.entries()) {
    const group = `item${index + 1}`;
    lines.push(`${group}.TEL;TYPE=WORK,VOICE:${escapeVCard(person.phone.trim())}`);
    lines.push(`${group}.X-ABLabel:${escapeVCard(person.name.trim())}`);
  }
  lines.push("END:VCARD");
  return `${lines.join("\r\n")}\r\n`;
}

export function contactCardFileName() {
  return "Your-Bike-Rental.vcf";
}
