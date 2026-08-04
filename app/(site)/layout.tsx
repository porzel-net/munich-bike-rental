import type { ReactNode } from "react";

import "../globals.css";

export default function PublicSiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
