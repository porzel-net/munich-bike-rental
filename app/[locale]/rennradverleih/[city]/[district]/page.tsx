import { notFound } from "next/navigation";

import { generateRentalMetadata, RentalPage } from "../../../../page";
import { type Locale } from "../../../../../lib/home-content";
import { getRentalLocation, rentalLocationConfigs } from "../../../../../lib/rental-locations";

type PageProps = {
  params: Promise<{
    locale: string;
    city: string;
    district: string;
  }>;
  searchParams?: Promise<{
    lang?: string | string[];
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return (["de", "en"] as const).flatMap((locale) =>
    rentalLocationConfigs.map((location) => ({
      locale,
      city: location.citySlug,
      district: location.districtSlug,
    })),
  );
}

async function getPageContext(params: PageProps["params"]) {
  const { locale: localeParam, city, district } = await params;
  const locale = localeParam === "en" || localeParam === "de" ? (localeParam as Locale) : null;
  const location = getRentalLocation(city, district);

  if (!locale || !location) {
    notFound();
  }

  return { locale, location };
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const { locale, location } = await getPageContext(params);
  return generateRentalMetadata({ searchParams, location, locale });
}

export default async function LocalizedLocationRentalPage({ params, searchParams }: PageProps) {
  const { locale, location } = await getPageContext(params);
  return <RentalPage searchParams={searchParams} location={location} locale={locale} />;
}
