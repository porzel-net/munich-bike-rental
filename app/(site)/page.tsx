import { permanentRedirect } from "next/navigation";

import { defaultRentalLocation } from "@/lib/rental-locations";

export default function RootRedirect() {
  permanentRedirect(`${defaultRentalLocation.path}?standortauswahl=1`);
}
