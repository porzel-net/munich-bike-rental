import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Anmeldung",
};

/** Login and enrollment must remain reachable before a full admin session exists. */
export default function AdminPublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
