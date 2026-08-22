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

export function contactCardFileName(name: string) {
  const safeName = name
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${safeName || "Your-Bike-Rental"}.vcf`;
}
