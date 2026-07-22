import type { ReactNode } from "react";

import "../globals.css";
import { BookingConfirmationDialog } from "@/components/booking-confirmation-dialog";

export default function PublicSiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <BookingConfirmationDialog />
    </>
  );
}
