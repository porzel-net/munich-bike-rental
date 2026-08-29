"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes server-rendered booking attention badges while the admin is open. */
export function AdminMailPoller() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [router]);

  return null;
}
