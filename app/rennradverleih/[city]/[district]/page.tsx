import { notFound } from "next/navigation";

import { generateRentalMetadata, RentalPage } from "../../../page";
import { getRentalLocation, rentalLocationConfigs } from "../../../../lib/rental-locations";

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

export async function generateMetadata({ params, searchParams }: PageProps) {
  const { city, district } = await params;
  const location = getRentalLocation(city, district);

  if (!location) {
    return {};
  }

  return generateRentalMetadata({ searchParams, location });
}

export default async function LocationRentalPage({ params, searchParams }: PageProps) {
  const { city, district } = await params;
  const location = getRentalLocation(city, district);

  if (!location) {
    notFound();
  }

  return <RentalPage searchParams={searchParams} location={location} />;
}
