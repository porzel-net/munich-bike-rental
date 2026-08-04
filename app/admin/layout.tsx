import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import "./admin.css";

import styles from "./admin-layout.module.css";
import { Toaster } from "../../components/ui/sonner";
import { canAccessAdmin, getServerSession } from "../../lib/auth/session";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = (await headers()).get("x-pathname");
  if (pathname === "/admin/login") {
    return <div className={styles.root}>{children}</div>;
  }
  if (pathname === "/admin/signup" || pathname?.startsWith("/admin/signup/")) {
    return <div className={styles.root}>{children}</div>;
  }

  const session = await getServerSession();
  // A pending Better Auth 2FA challenge deliberately has no full session yet.
  if (!session && pathname === "/admin/two-factor") return <div className={styles.root}>{children}</div>;
  if (!session) redirect("/admin/login");
  if (pathname === "/admin/calendar" || pathname?.startsWith("/admin/calendar/")) {
    return (
      <div className={styles.root}>
        {children}
        <Toaster richColors />
      </div>
    );
  }
  if (!canAccessAdmin(session.user)) redirect("/");
  if (session.user.mustChangePassword && pathname !== "/admin/change-password") redirect("/admin/change-password");
  if (pathname === "/admin/change-password") return <div className={styles.root}>{children}</div>;
  if (pathname === "/admin/two-factor") return <div className={styles.root}>{children}</div>;
  if (!session.user.twoFactorEnabled) redirect("/admin/two-factor");

  return (
    <div className={styles.root}>
      {children}
      <Toaster richColors />
    </div>
  );
}
