import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: {
    absolute: "AGB | Your Bike Rental",
  },
  description: "Allgemeine Geschäftsbedingungen für den Fahrradverleih von Your Bike Rental.",
  alternates: {
    canonical: "/de/agb",
  },
};

export default function AgbPage() {
  redirect("/de/agb");
}
