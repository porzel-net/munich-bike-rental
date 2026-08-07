import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import type { OfferQuote } from "./quotes";

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

function latex(value: string | number) {
  return String(value)
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
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(value);
}

function row(description: string, amountCents: number) {
  return `\\textbf{${latex(description)}} & ${latex(euro(amountCents))} \\\\[1.2ex]\\hline`;
}

function renderTex(input: InvoiceInput) {
  const bikeRows = input.quote.offeredItems
    .map((item) =>
      row(
        `Fahrradmiete: ${item.assetName} (${input.quote.rentalDays} Tage)`,
        item.dailyPriceCents * input.quote.rentalDays,
      ),
    )
    .join("\n");
  const accessoryRow = input.quote.equipmentSubtotalCents ? row("Zubehör", input.quote.equipmentSubtotalCents) : "";
  const discountRow = input.quote.discountCents ? row("Rabatt", -input.quote.discountCents) : "";

  return String.raw`\documentclass[10pt]{letter}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[left=1in,top=0.8in,right=1in,bottom=0.8in]{geometry}
\usepackage{tabularx}
\usepackage{array}
\usepackage{hhline}
\usepackage[colorlinks]{hyperref}
\hypersetup{urlcolor=blue}
\newcolumntype{R}[1]{>{\raggedleft\arraybackslash}p{#1}}
\begin{document}
\thispagestyle{empty}
\begin{tabularx}{\textwidth}{X r}
  {\Huge\bfseries Munich Rental} & {\footnotesize\bfseries RECHNUNG}\\[-0.2ex]
  Rennrad- und Gravelbike-Verleih & {\footnotesize ${latex(input.invoiceNumber)}}\\
  ${latex("hallo@munich-bike-rental.de")} & {\footnotesize ${latex(formatDate(input.issuedAt))}}\\
  ${latex("+49 89 54193577")} & \\
\end{tabularx}

\vspace{1cm}
\textbf{RECHNUNGSEMPFÄNGER}\par

\vspace{0.15cm}
\Large\textbf{${latex(input.customerName)}}\normalsize\\
${latex(input.customerEmail)}\\
${latex(input.customerPhone)}\par

\vspace{0.7cm}
\textbf{Buchung} ${latex(input.orderNumber)}\\
\textbf{Mietzeitraum} ${latex(input.periodFrom)} bis ${latex(input.periodTo)}\\
\textbf{Abholung / Rückgabe} ${latex(input.pickupTime)} / ${latex(input.dropoffTime)}\\
\textbf{Standort} ${latex(input.location)}\par

\vspace{0.8cm}
\noindent\begin{tabularx}{\linewidth}{X r}
\hline
\textbf{Leistung} & \textbf{Betrag}\\[1ex]\hline
${bikeRows}
${accessoryRow}
${discountRow}
\textbf{Gesamtbetrag} & \textbf{${latex(euro(input.quote.totalCents))}}\\[1.5ex]\hhline{~-}
\textbf{Zahlung erhalten} & \textbf{${latex(euro(input.paidAmountCents))}}\\[1.5ex]\hhline{~-}
\textbf{Offener Betrag} & \textbf{${latex(euro(Math.max(0, input.quote.totalCents - input.paidAmountCents)))}}\\[1.5ex]\hhline{==}
\end{tabularx}

\vfill
Vielen Dank für deine Buchung. Diese Rechnung ist vollständig bezahlt.

\vspace{0.25cm}
Munich Rental · ${latex("Josephine-Lang-Weg 3, 81245 München")} · ${latex("hallo@munich-bike-rental.de")}
\end{document}
`;
}

export async function renderInvoicePdf(input: InvoiceInput) {
  const directory = await mkdtemp(join(tmpdir(), "munich-bike-invoice-"));
  const texPath = join(directory, "invoice.tex");
  try {
    await writeFile(texPath, renderTex(input), "utf8");
    await execFileAsync(
      process.env.PDFLATEX_PATH || "pdflatex",
      ["-interaction=nonstopmode", "-halt-on-error", "invoice.tex"],
      {
        cwd: directory,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    return await readFile(join(directory, "invoice.pdf"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
