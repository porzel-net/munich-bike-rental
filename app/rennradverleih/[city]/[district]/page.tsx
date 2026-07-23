import { notFound, permanentRedirect } from "next/navigation";

import { resolveLocale } from "../../../../lib/home-content";
import { getLocalizedLocationPath, getRentalLocation, rentalLocationConfigs } from "../../../../lib/rental-locations";

type PageProps = {
  params: Promise<{
    city: string;
    district: string;
  }>;
  searchParams?: Promise<{
    lang?: string | string[];
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return rentalLocationConfigs.map((location) => ({ city: location.citySlug, district: location.districtSlug }));
}

export default async function LocationRentalPage({ params, searchParams }: PageProps) {
  const { city, district } = await params;
  const location = getRentalLocation(city, district);

  if (!location) {
    notFound();
  }

  const query = await searchParams;
  const locale = resolveLocale(query?.lang);
  permanentRedirect(getLocalizedLocationPath(location, locale));
}
