import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AgbPageContent } from "@/components/agb-page";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return [{ locale: "de" }, { locale: "en" }];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: {
      absolute: locale === "en" ? "Terms and Conditions | Your Bike Rental" : "AGB | Your Bike Rental",
    },
    description:
      locale === "en"
        ? "General terms and conditions for bicycle rental from Your Bike Rental."
        : "Allgemeine Geschäftsbedingungen für den Fahrradverleih von Your Bike Rental.",
    alternates: {
      canonical: `/${locale}/agb`,
    },
  };
}

export default async function LocalizedAgbPage({ params }: PageProps) {
  const { locale } = await params;

  if (locale !== "de" && locale !== "en") {
    notFound();
  }

  return <AgbPageContent locale={locale} />;
}
