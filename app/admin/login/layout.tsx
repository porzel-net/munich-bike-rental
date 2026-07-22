import type { ReactNode } from "react";

/** Login and enrollment must remain reachable before a full admin session exists. */
export default function AdminPublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
