import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zwei-Faktor-Authentifizierung",
};

/** Better Auth holds an in-progress 2FA challenge in an httpOnly cookie, not a session. */
export default function TwoFactorPublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
