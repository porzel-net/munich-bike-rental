import { permanentRedirect } from "next/navigation";

import { defaultRentalLocation } from "../../lib/rental-locations";

export default function MuenchenPage() {
  permanentRedirect(defaultRentalLocation.path);
}
