import type {
  BookingImportLocale,
  BookingImportLocation,
  BookingImportMail,
  BookingRequestImport,
  RequestedBikeImport,
} from "./types";

const DEFAULT_EMAIL = "unknown@example.invalid";
const DEFAULTS = {
  name: "Unknown",
  email: DEFAULT_EMAIL,
  phone: "unknown",
  location: "munich" as BookingImportLocation,
  periodFrom: "1970-01-01",
  periodTo: "1970-01-01",
  pickupTime: "00:00",
  dropoffTime: "00:00",
  requestedLabel: "Unknown bike",
  heightCm: 0,
};

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  januar: 1,
  february: 2,
  feb: 2,
  februar: 2,
  march: 3,
  mar: 3,
  märz: 3,
  maerz: 3,
  april: 4,
  apr: 4,
  may: 5,
  mai: 5,
  june: 6,
  jun: 6,
  juni: 6,
  july: 7,
  jul: 7,
  juli: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  october: 10,
  okt: 10,
  oct: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  december: 12,
  dez: 12,
  dec: 12,
};

const BIKE_MODELS = ["Endurace CF SL 8", "Grail CF SL 7", "Ultimate CF SL 7", "Aeroad CF SL 8"] as const;
const BIKE_RE =
  /\b(?<model>(?:Canyon\s+)?(?:Endurace(?:\s*[-\/.]?\s*CF)?(?:\s*[-\/.]?\s*SL)?\s*[-\/.]?\s*8|Grail(?:\s*[-\/.]?\s*CF)?(?:\s*[-\/.]?\s*SL)?\s*[-\/.]?\s*7|Ultimate(?:\s*[-\/.]?\s*CF)?(?:\s*[-\/.]?\s*SL)?\s*[-\/.]?\s*7|Aeroad(?:\s*[-\/.]?\s*CF)?(?:\s*[-\/.]?\s*SL)?\s*[-\/.]?\s*8))\b/giu;
const DATE_RE =
  /\b(?:\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\.?\s+[A-Za-zÄÖÜäöü]+\s+\d{4}|[A-Za-zÄÖÜäöü]+\s+\d{1,2},?\s+\d{4})\b/gu;
const TIME_RE = /\b\d{1,2}(?:(?::|\.)\d{2}|\s*(?:am|pm|uhr|h))\b/giu;
const HEIGHT_RE =
  /\b(?:height|body\s+height|körpergröße|koerpergroesse|größe|groesse|rider\s+height)\s*(?:\([^\n)]*\))?\s*[:=\-]?\s*(\d{2,3})\s*(?:cm)?\b/giu;
const HEIGHT_FALLBACK_RE = /\b(\d{2,3})\s*cm\b/giu;
const EMAIL_RE = /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/giu;
const PHONE_RE = /(?<!\w)(?:\+?\d[\d ()/.-]{6,}\d)(?!\w)/gu;

const CANYON_HEIGHT_RANGES: Record<string, Record<string, [number, number]>> = {
  endurace: {
    "3XS": [152, 158],
    "2XS": [160, 166],
    XS: [166, 172],
    S: [172, 178],
    M: [178, 184],
    L: [184, 190],
    XL: [190, 196],
    "2XL": [196, 202],
  },
  grail: {
    "2XS": [163, 169],
    XS: [167, 175],
    S: [172, 181],
    M: [179, 187],
    L: [185, 193],
    XL: [190, 199],
    "2XL": [196, 202],
  },
  ultimate: {
    "3XS": [154, 160],
    "2XS": [160, 166],
    XS: [166, 172],
    S: [172, 178],
    M: [178, 184],
    L: [184, 190],
    XL: [190, 196],
    "2XL": [196, 202],
  },
  aeroad: {
    "3XS": [154, 160],
    "2XS": [160, 166],
    XS: [166, 172],
    S: [172, 178],
    M: [178, 184],
    L: [184, 190],
    XL: [190, 196],
    "2XL": [196, 202],
  },
};

const FIELD_LABELS = {
  name: ["full name", "name", "your name", "customer", "kunde", "kundename", "vorname", "nachname"],
  email: ["email address", "e-mail address", "e-mail-adresse", "e-mail", "email", "mail", "kontakt"],
  phone: ["phone number", "phone", "mobile", "telefonnummer", "telefon", "tel", "mobil"],
  location: [
    "pickup location",
    "pick-up location",
    "rental location",
    "location",
    "abholort",
    "ausgabeort",
    "standort",
    "ort",
    "filiale",
  ],
  period: ["rental period", "rental dates", "period", "zeitraum", "mietzeitraum", "mietdauer"],
  periodFrom: ["date from", "start date", "from", "von", "mietbeginn", "beginn", "pickup date", "abholdatum"],
  periodTo: [
    "date to",
    "end date",
    "to",
    "bis",
    "mietende",
    "ende",
    "drop-off date",
    "dropoff date",
    "rückgabedatum",
    "rueckgabedatum",
  ],
  pickupTime: [
    "pickup time",
    "pick-up time",
    "pickup",
    "pick-up",
    "start time",
    "abholzeit",
    "abholung",
    "ausgabezeit",
  ],
  dropoffTime: [
    "drop-off time",
    "dropoff time",
    "drop off",
    "dropoff",
    "return time",
    "end time",
    "rückgabezeit",
    "rueckgabezeit",
    "rückgabe",
    "rueckgabe",
  ],
  message: [
    "additional notes",
    "additional information",
    "message",
    "comment",
    "comments",
    "notes",
    "bemerkung",
    "nachricht",
    "hinweise",
    "zusätzliche hinweise",
    "zusaetzliche hinweise",
  ],
  locale: ["language", "sprache"],
} as const;

function norm(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/giu, "")
    .replace(/<br\s*\/?>(?=\s*)/giu, "\n")
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>/giu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&quot;/giu, '"');
}

export function normalizeBookingBody(bodyText?: string | null, bodyHtml?: string | null) {
  const source = bodyText || (bodyHtml ? decodeHtml(bodyHtml) : "");
  return source
    .split(/\r?\n/u)
    .map((line) => norm(line.replace(/^\s*>+\s?/u, "")))
    .filter(Boolean)
    .join("\n");
}

function requestBlock(text: string) {
  const strong = ["neue bike-anfrage", "new bike inquiry", "new bike request"];
  const markers = strong.some((marker) => text.toLocaleLowerCase().includes(marker)) ? strong : ["bike inquiry"];
  const lowered = text.toLocaleLowerCase();
  const positions: number[] = [];
  for (const marker of markers) {
    let cursor = 0;
    while (true) {
      const position = lowered.indexOf(marker, cursor);
      if (position < 0) break;
      positions.push(position);
      cursor = position + marker.length;
    }
  }
  positions.sort((a, b) => a - b);
  if (!positions.length) return text;
  return text.slice(positions[0], positions[1] ?? text.length);
}

function valuesAfterLabels(text: string, labels: readonly string[]) {
  const aliases = [...labels]
    .sort((a, b) => b.length - a.length)
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  if (!aliases.length) return [];
  const pattern = new RegExp(`^\\s*(?:${aliases.join("|")})\\s*(?:\\([^\\n)]*\\))?\\s*[:=\\-]\\s*(.*?)\\s*$`, "gimu");
  return [...text.matchAll(pattern)].map((match) => norm(match[1])).filter(Boolean);
}

function firstValue(text: string, key: keyof typeof FIELD_LABELS) {
  return valuesAfterLabels(text, FIELD_LABELS[key])[0] ?? null;
}

function parseYear(value: string) {
  const year = Number(value);
  return year < 100 ? year + 2000 : year;
}

function dateFromMatch(value: string, locale: BookingImportLocale) {
  const raw = norm(value).replace(/^[.,]|[.,]$/gu, "");
  let year: number;
  let month: number;
  let day: number;
  let match: RegExpMatchArray | null;
  if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}$/u.test(raw)) {
    [year, month, day] = raw.split(/[./-]/u).map(Number) as [number, number, number];
  } else if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/u.test(raw)) {
    const [first, second, yearValue] = raw.split(/[./-]/u).map(Number);
    year = parseYear(String(yearValue));
    if (first > 12) [day, month] = [first, second];
    else if (second > 12) [month, day] = [first, second];
    else if (locale === "en") [month, day] = [first, second];
    else [day, month] = [first, second];
  } else {
    match = raw.match(/^(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})$/u);
    if (match) {
      day = Number(match[1]);
      month = MONTHS[match[2].toLocaleLowerCase()] ?? 0;
      year = Number(match[3]);
    } else {
      match = raw.match(/^([A-Za-zÄÖÜäöü]+)\s+(\d{1,2}),?\s+(\d{4})$/u);
      if (!match) return null;
      month = MONTHS[match[1].toLocaleLowerCase()] ?? 0;
      day = Number(match[2]);
      year = Number(match[3]);
    }
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!month || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function dateCandidates(value: string, locale: BookingImportLocale) {
  DATE_RE.lastIndex = 0;
  return [...value.matchAll(DATE_RE)]
    .map((match) => dateFromMatch(match[0], locale))
    .filter((value): value is string => Boolean(value));
}

function timeFromMatch(value: string) {
  let raw = norm(value).toLocaleLowerCase().replace("uhr", "").replace(/h$/u, "").trim();
  const meridiem = raw.endsWith("am") || raw.endsWith("pm") ? raw.slice(-2) : null;
  if (meridiem) raw = raw.slice(0, -2).trim();
  const [hourValue, minuteValue] = raw.includes(":") || raw.includes(".") ? raw.split(/[:.]/u) : [raw, "0"];
  let hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
    ? `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
    : null;
}

function timeCandidates(value: string) {
  TIME_RE.lastIndex = 0;
  return [...value.matchAll(TIME_RE)]
    .map((match) => timeFromMatch(match[0]))
    .filter((value): value is string => Boolean(value));
}

function detectLocale(text: string): { locale: BookingImportLocale; known: boolean } {
  if (/^\s*Neue\s+Bike-Anfrage\b/imu.test(text)) return { locale: "de", known: true };
  if (/^\s*New\s+(?:bike\s+inquiry|bike\s+request)\b/imu.test(text)) return { locale: "en", known: true };
  const explicit = firstValue(text, "locale")?.toLocaleLowerCase();
  if (["de", "deutsch", "german", "de-de"].includes(explicit ?? "")) return { locale: "de", known: true };
  if (["en", "english", "englisch", "en-gb", "en-us"].includes(explicit ?? "")) return { locale: "en", known: true };
  return { locale: "de", known: false };
}

function extractLocation(text: string) {
  const values = valuesAfterLabels(text, FIELD_LABELS.location);
  const haystacks = values.length
    ? values
    : text.split("\n").filter((line) => !line.includes("@") && !/bike rental/iu.test(line));
  const aliases: Record<BookingImportLocation, string[]> = {
    munich: ["munich", "münchen", "muenchen", "munich city", "munich center"],
    regensburg: ["regensburg"],
    lindau: ["lindau"],
    friedrichshafen: ["friedrichshafen"],
    konstanz: ["konstanz", "constance"],
  };
  for (const haystack of haystacks)
    for (const [location, names] of Object.entries(aliases) as Array<[BookingImportLocation, string[]]>)
      if (
        names.some((alias) =>
          new RegExp(`(?<!\\w)${alias.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?!\\w)`, "iu").test(haystack),
        )
      )
        return { location, known: true };
  return { location: DEFAULTS.location, known: false };
}

function extractName(text: string, fromName: string | null) {
  const full = valuesAfterLabels(text, ["full name", "name", "your name", "customer", "kunde", "kundename"]);
  if (full.length) return { name: full[0], known: true };
  const first = valuesAfterLabels(text, ["first name", "vorname"]);
  const last = valuesAfterLabels(text, ["last name", "surname", "nachname"]);
  if (first.length && last.length) return { name: `${first[0]} ${last[0]}`, known: true };
  if (fromName && !["hallo", "munich bike rental", "munich rental"].includes(fromName.toLocaleLowerCase()))
    return { name: norm(fromName), known: true };
  return { name: DEFAULTS.name, known: false };
}

function extractEmail(text: string, sender: string | null, replyToEmail: string | null) {
  const candidates: string[] = [];
  if (replyToEmail) candidates.push(...[...replyToEmail.matchAll(EMAIL_RE)].map((match) => match[0]));
  const answerMatches = text.matchAll(
    /(?:antwort\s+an|reply\s*[- ]?to|answer\s+to)\s*[:=\-]?\s*(?<email>\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b)/giu,
  );
  for (const match of answerMatches) candidates.push(match.groups?.email ?? match[0]);
  const labeled = valuesAfterLabels(text, FIELD_LABELS.email);
  candidates.push(...[...(labeled.length ? labeled.join("\n") : text).matchAll(EMAIL_RE)].map((match) => match[0]));
  const senderNorm = (sender ?? "").toLocaleLowerCase();
  const senderDomain = senderNorm.split("@")[1] ?? "";
  for (const candidate of candidates.flatMap((candidate) =>
    [...candidate.matchAll(EMAIL_RE)].map((match) => match[0]),
  )) {
    const lower = candidate.toLocaleLowerCase();
    if (lower !== senderNorm && (!senderDomain || lower.split("@")[1] !== senderDomain))
      return { email: lower, known: true };
  }
  return { email: DEFAULT_EMAIL, known: false };
}

function extractPhone(text: string) {
  const labeled = valuesAfterLabels(text, FIELD_LABELS.phone);
  PHONE_RE.lastIndex = 0;
  const candidates = [...(labeled.length ? labeled.join("\n") : text).matchAll(PHONE_RE)];
  for (const match of candidates) {
    const value = match[0].replace(/\s+/gu, " ").replace(/^[ .,-]+|[ .,-]+$/gu, "");
    if (!DATE_RE.test(value) && !TIME_RE.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7)
      return { phone: value, known: true };
  }
  return { phone: DEFAULTS.phone, known: false };
}

function parseDatesAndTimes(text: string, locale: BookingImportLocale) {
  const dateFrom = dateCandidates(valuesAfterLabels(text, FIELD_LABELS.periodFrom).join(" "), locale);
  const dateTo = dateCandidates(valuesAfterLabels(text, FIELD_LABELS.periodTo).join(" "), locale);
  const period = dateCandidates(valuesAfterLabels(text, FIELD_LABELS.period).join(" "), locale);
  const allDates = dateCandidates(text, locale);
  const pickup = timeCandidates(valuesAfterLabels(text, FIELD_LABELS.pickupTime).join(" "));
  const dropoff = timeCandidates(valuesAfterLabels(text, FIELD_LABELS.dropoffTime).join(" "));
  const generic = timeCandidates(valuesAfterLabels(text, ["time", "times", "zeit", "uhrzeit"]).join(" "));
  const allTimes = timeCandidates(text);
  return {
    periodFrom: dateFrom[0] ?? period[0] ?? allDates[0] ?? DEFAULTS.periodFrom,
    periodTo: dateTo[0] ?? period[1] ?? allDates[1] ?? DEFAULTS.periodTo,
    pickupTime: pickup[0] ?? generic[0] ?? allTimes[0] ?? DEFAULTS.pickupTime,
    dropoffTime: dropoff[0] ?? generic[1] ?? allTimes[1] ?? DEFAULTS.dropoffTime,
    known: {
      periodFrom: Boolean(dateFrom.length || period.length || allDates.length),
      periodTo: Boolean(dateTo.length || period.length > 1 || allDates.length > 1),
      pickupTime: Boolean(pickup.length || generic.length || allTimes.length),
      dropoffTime: Boolean(dropoff.length || generic.length > 1 || allTimes.length > 1),
    },
  };
}

function canonicalBikeLabel(model: string, size: string | undefined) {
  const compact = norm(model)
    .replace(/^Canyon\s+/iu, "")
    .replace(/[._/-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase();
  const canonical = compact.startsWith("endurace")
    ? "Endurace CF SL 8"
    : compact.startsWith("grail")
      ? "Grail CF SL 7"
      : compact.startsWith("ultimate")
        ? "Ultimate CF SL 7"
        : compact.startsWith("aeroad")
          ? "Aeroad CF SL 8"
          : (BIKE_MODELS.find((candidate) => candidate.toLocaleLowerCase() === compact) ?? norm(model));
  return size ? `${canonical} - ${size.toUpperCase()}` : canonical;
}

function recommendedHeight(label: string) {
  const size = label.match(/(?:^|\s)-\s*(XS|S|M|L|XL|2XL|3XS|2XS)\s*$/iu)?.[1]?.toUpperCase();
  const family = Object.keys(CANYON_HEIGHT_RANGES).find((key) => label.toLocaleLowerCase().includes(key));
  const range = family && size ? CANYON_HEIGHT_RANGES[family][size] : undefined;
  return range ? Math.floor((range[0] + range[1] + 1) / 2) : null;
}

type BikeMention = { label: string; position: number };
function bikeMentions(text: string): BikeMention[] {
  BIKE_RE.lastIndex = 0;
  const mentions: BikeMention[] = [];
  for (const match of text.matchAll(BIKE_RE)) {
    const nearby = text.slice(Math.max(0, (match.index ?? 0) - 100), (match.index ?? 0) + match[0].length + 180);
    const afterModel = text.slice((match.index ?? 0) + match[0].length);
    const size =
      afterModel.match(
        /^\s*(?:(?:[-/,()]?\s*)(?:di2|disc|eTap\s+AXS|mit\s+Schaltung|ohne\s+Schaltung)\b\s*)*[-/,()]?\s*(3XS|2XS|XS|XXL|2XL|XL|S|M|L)\b/iu,
      )?.[1] ??
      nearby.match(
        /\b(?:frame\s+size|bike\s+size|size|rahmengröße|rahmengroesse|fahrradgröße|fahrradgroesse|größe|groesse)\s*(?:[:=\-]\s*|\s+)(3XS|2XS|XS|XXL|2XL|XL|S|M|L)\b/iu,
      )?.[1] ??
      undefined;
    const label = canonicalBikeLabel(match.groups?.model ?? match[0], size);
    if (mentions.length && mentions.at(-1)?.label === label && (match.index ?? 0) - mentions.at(-1)!.position < 120)
      continue;
    mentions.push({ label, position: match.index ?? 0 });
  }
  return mentions;
}

function boolValue(text: string, labels: readonly string[]) {
  const values = valuesAfterLabels(text, labels);
  const present =
    values.length ||
    new RegExp(`(?:${labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|")})`, "iu").test(
      text,
    );
  if (!present) return { value: false, known: false };
  const lower = (values.length ? values.join(" ") : text).toLocaleLowerCase();
  if (/\b(?:no|nein|nicht|ohne|none|false|0|not needed|nicht benötigt|nicht benoetigt)\b/iu.test(lower))
    return { value: false, known: true };
  if (/\b(?:yes|ja|benötigt|benoetigt|included|inklusive|true|1|with|mit)\b/iu.test(lower))
    return { value: true, known: true };
  return { value: false, known: false };
}

function addonItem(block: string, index: number): { item: RequestedBikeImport; missing: string[] } {
  const missing: string[] = [];
  const pedals = boolValue(block, ["pedals", "pedal", "pedale"]);
  let needsPedals = pedals.value;
  let pedalType: string | null = null;
  if (/look\s*keo\s*2?\s*max/iu.test(block)) {
    pedalType = "lookKeo2Max";
    needsPedals = true;
  } else if (/\b(?:look\s+keo|keo)\b/iu.test(block)) {
    pedalType = "lookKeo";
    needsPedals = true;
  } else if (/\bspd\b/iu.test(block)) {
    pedalType = "spd";
    needsPedals = true;
  } else if (/flat\s+pedals?|flachpedale/iu.test(block)) {
    pedalType = "flat";
    needsPedals = true;
  }
  const pedalsKnown = pedals.known || Boolean(pedalType);
  if (!pedalsKnown) missing.push(`requestedItems[${index}].needsPedals`);
  if (needsPedals && !pedalType) missing.push(`requestedItems[${index}].pedalType`);

  const mount = boolValue(block, [
    "computer mount",
    "bike computer mount",
    "computerhalterung",
    "garmin halterung",
    "wahoo halterung",
  ]);
  let needsComputerMount = mount.value;
  let computerMountType: string | null = null;
  if (/\bgarmin\b/iu.test(block)) {
    computerMountType = "garmin";
    needsComputerMount = true;
  } else if (/\bwahoo\b/iu.test(block)) {
    computerMountType = "wahoo";
    needsComputerMount = true;
  } else if (needsComputerMount) {
    computerMountType = "unknown";
    missing.push(`requestedItems[${index}].computerMountType`);
  }
  if (!mount.known && !computerMountType) missing.push(`requestedItems[${index}].needsComputerMount`);
  const fields: Array<
    [
      keyof Pick<RequestedBikeImport, "needsHelmet" | "needsClothing" | "needsBikepackingBag" | "needsGlasses">,
      readonly string[],
    ]
  > = [
    ["needsHelmet", ["helmet", "helm"]],
    ["needsClothing", ["clothing", "bekleidung", "cycling clothes", "radbekleidung"]],
    ["needsBikepackingBag", ["bikepacking bag", "bikepacking-tasche", "bikepacking tasche", "satteltasche"]],
    ["needsGlasses", ["glasses", "brille", "eyewear"]],
  ];
  const values: Partial<RequestedBikeImport> = {
    needsPedals,
    pedalType,
    needsComputerMount,
    computerMountType,
    bottleHolderIncluded: true,
    repairKitIncluded: true,
  };
  for (const [field, labels] of fields) {
    const result = boolValue(block, labels);
    values[field] = result.value;
    if (!result.known) missing.push(`requestedItems[${index}].${field}`);
  }
  return { item: values as RequestedBikeImport, missing };
}

function requestedCount(subject: string | null) {
  const count = subject?.match(/\((\d+)\s+(?:bikes?|fahrräder?|raeder?)\)/iu)?.[1];
  return count ? Number(count) : null;
}

function extractItems(text: string, subject: string | null) {
  const sections = [...text.matchAll(/^\s*(?:bike|fahrrad)\s*\d+\s*:?\s*$/gimu)];
  const count = requestedCount(subject);
  const blocks =
    sections.length >= 2
      ? sections
          .slice(0, count ?? sections.length)
          .map((match, index) => text.slice(match.index, sections[index + 1]?.index ?? text.length))
      : null;
  const mentions = bikeMentions(text);
  let selected = count !== null ? mentions.slice(0, count) : mentions;
  if (!blocks) {
    const deduped: BikeMention[] = [];
    for (const mention of selected) {
      const base = mention.label.replace(/\s+-\s+(?:XS|S|M|L|XL|XXL)$/iu, "");
      const existing = deduped.findIndex((item) => item.label.replace(/\s+-\s+(?:XS|S|M|L|XL|XXL)$/iu, "") === base);
      if (existing < 0) deduped.push(mention);
      else if (!deduped[existing].label.includes(" - ") && mention.label.includes(" - ")) deduped[existing] = mention;
    }
    selected = deduped;
  }
  if (!selected.length) selected = [{ label: DEFAULTS.requestedLabel, position: 0 }];
  const selectedBlocks =
    blocks ??
    selected.map((mention, index) => text.slice(mention.position, selected[index + 1]?.position ?? text.length));
  HEIGHT_RE.lastIndex = 0;
  HEIGHT_FALLBACK_RE.lastIndex = 0;
  const globalHeights = [...text.matchAll(HEIGHT_RE)].map((match) => Number(match[1]));
  if (!globalHeights.length) {
    HEIGHT_FALLBACK_RE.lastIndex = 0;
    globalHeights.push(...[...text.matchAll(HEIGHT_FALLBACK_RE)].map((match) => Number(match[1])));
  }
  let usedHeights = 0;
  const items: RequestedBikeImport[] = [];
  const missing: string[] = [];
  const inferred: string[] = [];
  for (const [index, [mention, block]] of selected
    .map((mention, index) => [mention, selectedBlocks[index]] as const)
    .entries()) {
    HEIGHT_RE.lastIndex = 0;
    HEIGHT_FALLBACK_RE.lastIndex = 0;
    let blockHeights = [...block.matchAll(HEIGHT_RE)].map((match) => Number(match[1]));
    if (!blockHeights.length) blockHeights = [...block.matchAll(HEIGHT_FALLBACK_RE)].map((match) => Number(match[1]));
    const heightMissing = !blockHeights.length && usedHeights >= globalHeights.length;
    const height = blockHeights[0] ?? globalHeights[usedHeights] ?? DEFAULTS.heightCm;
    if (blockHeights.length || usedHeights < globalHeights.length) usedHeights += 1;
    const addon = addonItem(block, index);
    const item = { ...addon.item, requestedLabel: mention.label, heightCm: height };
    if (heightMissing) {
      const recommended = recommendedHeight(item.requestedLabel);
      if (recommended !== null) {
        item.heightCm = recommended;
        inferred.push(`requestedItems[${index}].heightCm`);
      }
    }
    items.push(item);
    if (mention.label === DEFAULTS.requestedLabel) missing.push(`requestedItems[${index}].requestedLabel`);
    if (heightMissing) missing.push(`requestedItems[${index}].heightCm`);
    missing.push(...addon.missing);
  }
  return { items, missing, inferred };
}

export function parseBookingRequest(mail: BookingImportMail): BookingRequestImport {
  const text = requestBlock(normalizeBookingBody(mail.bodyText, mail.bodyHtml) || norm(mail.subject));
  const locale = detectLocale(text);
  const name = extractName(text, mail.fromName);
  const email = extractEmail(text, mail.fromEmail, mail.replyToEmail);
  const phone = extractPhone(text);
  const location = extractLocation(text);
  const dates = parseDatesAndTimes(text, locale.locale);
  const items = extractItems(text, mail.subject);
  const message = firstValue(text, "message") ?? "";
  const missing = [
    ...(!name.known ? ["name"] : []),
    ...(!email.known ? ["email"] : []),
    ...(!phone.known ? ["phone"] : []),
    ...(!location.known ? ["location"] : []),
    ...(!dates.known.periodFrom ? ["periodFrom"] : []),
    ...(!dates.known.periodTo ? ["periodTo"] : []),
    ...(!dates.known.pickupTime ? ["pickupTime"] : []),
    ...(!dates.known.dropoffTime ? ["dropoffTime"] : []),
    ...(!message ? ["message"] : []),
    ...(!locale.known ? ["locale"] : []),
    ...items.missing,
  ];
  return {
    name: name.name,
    email: email.email,
    phone: phone.phone,
    location: location.location,
    periodFrom: dates.periodFrom,
    periodTo: dates.periodTo,
    pickupTime: dates.pickupTime,
    dropoffTime: dates.dropoffTime,
    message,
    locale: locale.locale,
    requestedItems: items.items,
    missingFields: [...new Set(missing)],
    inferredFields: items.inferred,
    _source: {
      emailId: mail.id,
      subject: mail.subject,
      sentAt: mail.sentAt?.toISOString() ?? null,
      from: mail.fromEmail,
      recipients: mail.recipients ?? "",
      inReplyTo: mail.inReplyTo ?? null,
      referencesHeader: mail.referencesHeader ?? null,
      threadMessageId: mail.threadMessageId ?? mail.id,
      bodyText: mail.bodyText ?? "",
    },
  };
}

export function isBookingInquiry(mail: Pick<BookingImportMail, "subject" | "bodyText" | "bodyHtml">) {
  const combined = `${mail.subject ?? ""}\n${mail.bodyText ?? ""}\n${mail.bodyHtml ?? ""}`.toLocaleLowerCase();
  return ["bike inquiry", "bike request", "neue bike-anfrage", "new bike inquiry", "new bike request"].some((marker) =>
    combined.includes(marker),
  );
}

export function isExportableBooking(record: BookingRequestImport) {
  return (
    record.email !== DEFAULT_EMAIL &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(record.email) &&
    record.requestedItems.length > 0 &&
    record.requestedItems.every((item) => item.requestedLabel !== DEFAULTS.requestedLabel) &&
    record.name.trim().toLocaleLowerCase() !== "julius porzel" &&
    record.email.toLocaleLowerCase() !== "julius.porzel@web.de"
  );
}

export function importExclusionReason(record: BookingRequestImport) {
  if (
    record.name.trim().toLocaleLowerCase() === "julius porzel" ||
    record.email.toLocaleLowerCase() === "julius.porzel@web.de"
  )
    return "excluded_customer" as const;
  if (record.email === DEFAULT_EMAIL || !record.email.includes("@")) return "missing_email" as const;
  if (record.requestedItems.some((item) => item.requestedLabel === DEFAULTS.requestedLabel))
    return "unknown_model" as const;
  return null;
}
