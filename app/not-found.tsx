import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import "./globals.css";
import { resolveLocale } from "@/lib/home-content";
import { defaultRentalLocation, getLocalizedLocationPath } from "@/lib/rental-locations";

export const metadata: Metadata = {
  title: "404 – Seite nicht gefunden | Your Bike Rental",
  description: "Diese Seite wurde nicht gefunden. Zurück zu Your Bike Rental.",
};

export default async function NotFound() {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "";
  const searchParams = new URLSearchParams(requestHeaders.get("x-search") ?? "");
  const pathLocale = pathname.match(/^\/(de|en)(?:\/|$)/)?.[1];
  const lang = resolveLocale(pathLocale ?? searchParams.get("lang") ?? undefined);
  const homePath = getLocalizedLocationPath(defaultRentalLocation, lang);
  const copy =
    lang === "de"
      ? {
          eyebrow: "404 · SEITE NICHT GEFUNDEN",
          title: "Diese Route gibt es leider nicht.",
          description:
            "Vielleicht hat sich ein Abzweig geändert oder der Link ist veraltet. Wir bringen dich gern zurück auf die richtige Strecke.",
          home: "Zur Startseite",
        }
      : {
          eyebrow: "404 · PAGE NOT FOUND",
          title: "This route doesn’t exist.",
          description:
            "The turn may have changed or the link may be out of date. We’ll help you get back on the right track.",
          home: "Back to the homepage",
        };

  return (
    <main className="not-found-page">
      <header className="not-found-header">
        <div className="container not-found-header__inner">
          <Link className="brand" href={homePath} aria-label="Your Bike Rental">
            <span className="brand__text">Your Bike Rental</span>
          </Link>
          <Link className="not-found-header__link" href={homePath}>
            <ArrowLeft aria-hidden="true" size={16} />
            <span>{copy.home}</span>
          </Link>
        </div>
      </header>

      <section className="not-found-hero" aria-labelledby="not-found-title">
        <div className="container not-found-hero__grid">
          <div className="not-found-copy">
            <p className="not-found-eyebrow">
              <span aria-hidden="true" className="not-found-eyebrow__dot" />
              {copy.eyebrow}
            </p>
            <p className="not-found-code" aria-hidden="true">
              404
            </p>
            <h1 id="not-found-title">{copy.title}</h1>
            <p className="not-found-description">{copy.description}</p>
            <div className="not-found-actions">
              <Link className="not-found-button" href={homePath}>
                {copy.home}
                <ArrowUpRight aria-hidden="true" size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
