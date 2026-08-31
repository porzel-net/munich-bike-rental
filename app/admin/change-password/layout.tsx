import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Passwort ändern",
};

export default function ChangePasswordLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
