import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { BUSINESS_TIME_ZONE } from "../datetime";
import { calculateBikeSubtotalCents } from "../inventory/pricing";
import type { OfferQuote } from "./quotes";
import { getOfferItemPriceSchedule } from "./quotes";

const execFileAsync = promisify(execFile);

export type InvoiceInput = {
  invoiceNumber: string;
  issuedAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderNumber: string;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  location: string;
  quote: OfferQuote;
  paidAmountCents: number;
};

export type InvoicePriceSummary = {
  bikeSubtotalCents: number;
  equipmentSubtotalCents: number;
  standardDiscountCents: number;
  customDiscountCents: number;
  customSurchargeCents: number;
  standardTotalCents: number;
  totalCents: number;
};

function latex(value: string | number) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\r?\n/g, " ")
    .replaceAll("\\", "\\textbackslash{}")
    .replaceAll("&", "\\&")
    .replaceAll("%", "\\%")
    .replaceAll("$", "\\$")
    .replaceAll("#", "\\#")
    .replaceAll("_", "\\_")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("~", "\\textasciitilde{}")
    .replaceAll("^", "\\textasciicircum{}");
}

function euro(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} EUR`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long", timeZone: BUSINESS_TIME_ZONE }).format(value);
}

function row(description: string, amountCents: number) {
  return `\\textbf{${latex(description)}} & ${latex(euro(amountCents))} \\\\[1.7ex]\\hline`;
}

function getBikeBaseCents(input: Pick<InvoiceInput, "periodFrom" | "quote">, item: OfferQuote["offeredItems"][number]) {
  const line = input.quote.bikePriceLines?.find((candidate) => candidate.assetId === item.assetId);
  if (line) return line.baseCents;
  const schedule = getOfferItemPriceSchedule(item);
  if (!schedule) throw new Error("Für die Rechnungsposition fehlt der kanonische Preis-Snapshot.");
  return calculateBikeSubtotalCents({
    ...schedule,
    periodFrom: input.periodFrom,
    rentalDays: input.quote.rentalDays,
  });
}

export function getInvoicePriceSummary(input: Pick<InvoiceInput, "periodFrom" | "quote">): InvoicePriceSummary {
  const bikeSubtotalCents = input.quote.offeredItems.length
    ? input.quote.offeredItems.reduce((total, item) => total + getBikeBaseCents(input, item), 0)
    : input.quote.bikeSubtotalCents;
  const equipmentSubtotalCents = input.quote.equipmentSubtotalCents;
  const standardTotalCents =
    input.quote.standardTotalCents ??
    input.quote.calculatedTotalCents ??
    Math.max(0, bikeSubtotalCents + equipmentSubtotalCents - input.quote.discountCents);
  const standardDiscountCents = Math.max(0, input.quote.discountCents);
  const customDiscountCents =
    input.quote.customDiscountCents ?? Math.max(0, standardTotalCents - input.quote.totalCents);
  const customSurchargeCents =
    input.quote.customSurchargeCents ?? Math.max(0, input.quote.totalCents - standardTotalCents);

  return {
    bikeSubtotalCents,
    equipmentSubtotalCents,
    standardDiscountCents,
    customDiscountCents,
    customSurchargeCents,
    standardTotalCents,
    totalCents: input.quote.totalCents,
  };
}

function renderTex(input: InvoiceInput) {
  const bikeRows = input.quote.offeredItems
    .map((item) =>
      row(`Fahrradmiete: ${item.assetName} (${input.quote.rentalDays} Tage)`, getBikeBaseCents(input, item)),
    )
    .join("\n");
  const accessoryRow = input.quote.equipmentSubtotalCents ? row("Zubehör", input.quote.equipmentSubtotalCents) : "";
  const priceSummary = getInvoicePriceSummary(input);
  const discountRows = [
    priceSummary.standardDiscountCents ? row("Regulärer Mietrabatt", -priceSummary.standardDiscountCents) : "",
    priceSummary.customDiscountCents ? row("Zusätzlicher individueller Rabatt", -priceSummary.customDiscountCents) : "",
    priceSummary.customSurchargeCents ? row("Individueller Aufpreis", priceSummary.customSurchargeCents) : "",
  ].join("\n");
  const openAmountCents = Math.max(0, priceSummary.totalCents - input.paidAmountCents);
  const paymentNotice =
    openAmountCents === 0
      ? "Diese Rechnung ist vollständig bezahlt."
      : `Offener Betrag: ${euro(openAmountCents)}. Bitte begleiche den offenen Betrag.`;

  const tex = String.raw`\\documentclass[10pt]{letter}
\\usepackage{fontspec}
\\setmainfont[
  BoldFont=poppins-700.ttf,
  ItalicFont=poppins-400.ttf,
  BoldItalicFont=poppins-700.ttf
]{poppins-400.ttf}
\\usepackage{setspace}
\\setstretch{1.18}
\\usepackage[left=1in,top=0.8in,right=1in,bottom=0.8in]{geometry}
\\usepackage{graphicx}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{hhline}
\\usepackage[hidelinks]{hyperref}
\\newcolumntype{R}[1]{>{\\raggedleft\\arraybackslash}p{#1}}
\\begin{document}
\\thispagestyle{empty}
\\begin{tabularx}{\\textwidth}{X r}
  {\\Huge\\bfseries Munich Rental} & \\raisebox{-0.2cm}{\\includegraphics[height=2.2cm]{logo.png}}\\\\[-0.2ex]
  Rennrad- und Gravelbike-Verleih & {\\footnotesize\\bfseries RECHNUNG}\\\\
  ${latex("hallo@munich-bike-rental.de")} & {\\footnotesize ${latex(input.invoiceNumber)}}\\\\
  ${latex("+49 89 54193577")} & {\\footnotesize ${latex(formatDate(input.issuedAt))}}\\\\
\\end{tabularx}

\\vspace{1cm}
\\textbf{RECHNUNGSEMPFÄNGER}\\par

\\vspace{0.15cm}
\\Large\\textbf{${latex(input.customerName)}}\\normalsize\\\\
${latex(input.customerEmail)}\\\\
${latex(input.customerPhone)}\\par

\\vspace{0.7cm}
\\textbf{Buchung} ${latex(input.orderNumber)}\\\\
\\textbf{Mietzeitraum} ${latex(input.periodFrom)} bis ${latex(input.periodTo)}\\\\
\\textbf{Abholung / Rückgabe} ${latex(input.pickupTime)} / ${latex(input.dropoffTime)}\\\\
\\textbf{Standort} ${latex(input.location)}\\par

\\vspace{0.8cm}
\\noindent\\begin{tabularx}{\\linewidth}{X r}
\\hline
\\textbf{Leistung} & \\textbf{Betrag}\\[1ex]\\hline
${bikeRows}
${accessoryRow}
${discountRows}
\\textbf{Gesamtbetrag} & \\textbf{${latex(euro(priceSummary.totalCents))}}\\[1.9ex]\\hhline{~-}
\\textbf{Zahlung erhalten} & \\textbf{${latex(euro(input.paidAmountCents))}}\\[1.9ex]\\hhline{~-}
\\textbf{Offener Betrag} & \\textbf{${latex(euro(openAmountCents))}}\\[1.9ex]\\hhline{==}
\\end{tabularx}

\\vfill
Vielen Dank für deine Buchung. ${latex(paymentNotice)}

\\vspace{0.25cm}
Munich Rental · ${latex("Josephine-Lang-Weg 3, 81245 München")} · ${latex("hallo@munich-bike-rental.de")}
\\par\\vspace{0.15cm}\\footnotesize Steuerbefreiung gemäß \\S 19 UStG
\\end{document}
`;
  const lineBreakPlaceholder = "__LATEX_LINE_BREAK__";
  return tex
    .replaceAll("\\\\\\\\", lineBreakPlaceholder)
    .replaceAll("\\\\[", `${lineBreakPlaceholder}[`)
    .replaceAll("\\\\", "\\")
    .replaceAll(lineBreakPlaceholder, "\\\\");
}

export async function renderInvoicePdf(input: InvoiceInput) {
  const directory = await mkdtemp(join(tmpdir(), "munich-bike-invoice-"));
  const texPath = join(directory, "invoice.tex");
  try {
    await Promise.all([
      copyFile(join(process.cwd(), "public/assets/img/logo.png"), join(directory, "logo.png")),
      copyFile(join(process.cwd(), "public/fonts/poppins-400.ttf"), join(directory, "poppins-400.ttf")),
      copyFile(join(process.cwd(), "public/fonts/poppins-700.ttf"), join(directory, "poppins-700.ttf")),
    ]);
    await writeFile(texPath, renderTex(input), "utf8");
    try {
      await execFileAsync(
        process.env.LATEX_PATH || process.env.PDFLATEX_PATH || "xelatex",
        ["-interaction=nonstopmode", "-halt-on-error", "invoice.tex"],
        {
          cwd: directory,
          maxBuffer: 2 * 1024 * 1024,
          env: { ...process.env, TEXMFVAR: join(directory, "texmf-var") },
        },
      );
    } catch (error) {
      const stderr = typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr) : "";
      const stdout = typeof error === "object" && error !== null && "stdout" in error ? String(error.stdout) : "";
      const details = [stderr, stdout].filter(Boolean).join(" ").trim();
      throw new Error(`Die Rechnung konnte nicht erzeugt werden.${details ? ` ${details}` : ""}`);
    }
    const pdf = await readFile(join(directory, "invoice.pdf"));
    if (pdf.length === 0 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("xelatex hat keine gültige Rechnung-PDF erzeugt.");
    }
    return pdf;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
