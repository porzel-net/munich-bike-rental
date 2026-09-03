import * as React from "react";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import Link from "next/link";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  BikeIcon,
  BoxesIcon,
  CalendarDaysIcon,
  EuroIcon,
  LayoutDashboardIcon,
  ListIcon,
  MessageCircleIcon,
  ScrollTextIcon,
  Settings2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { getDatabase } from "@/lib/db/client";
import { bookings, dashboardActivityDismissals } from "@/lib/db/schema";
import { getAssignedLocation } from "@/lib/auth/authorization";
import { getPendingBookingAttentionBookingIds } from "@/lib/bookings/pending-email-action";
import { getDashboardActivities } from "@/lib/dashboard/activities";
import { getOpenFinancialTransactionCount } from "@/lib/financial/review-count";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/admin",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Buchungen",
      url: "/admin/bookings",
      icon: <ListIcon />,
    },
    {
      title: "Kalender",
      url: "/admin/calendar",
      icon: <CalendarDaysIcon />,
    },
    {
      title: "Inventar",
      url: "/admin/inventory",
      icon: <BoxesIcon />,
    },
    {
      title: "Buchhaltung",
      url: "/admin/accounting",
      icon: <EuroIcon />,
      adminOnly: true,
      items: [
        { title: "EÜR 2026", url: "/admin/accounting" },
        { title: "Banktransaktionen", url: "/admin/accounting/transactions" },
        { title: "Anlageverzeichnis", url: "/admin/accounting/assets" },
      ],
    },
    {
      title: "Kontakte",
      url: "/admin/contacts",
      icon: <UserIcon />,
    },
    {
      title: "Team",
      url: "/admin/team",
      icon: <UsersIcon />,
      adminOnly: true,
    },
  ],
  navSecondary: [
    {
      title: "AI Logs",
      url: "/admin/ai-logs",
      icon: <ScrollTextIcon />,
      adminOnly: true,
    },
    {
      title: "WhatsApp",
      url: "/admin/settings/whatsapp",
      icon: <MessageCircleIcon />,
      adminOnly: true,
    },
    {
      title: "Einstellungen",
      url: "/admin/settings",
      icon: <Settings2Icon />,
    },
  ],
};

const NAV_OPEN_ITEMS_COOKIE = "admin_nav_open_items";

function readOpenItemsCookie(value: string | undefined): Record<string, boolean> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // Ignore an invalid or stale navigation-state cookie.
  }

  return {};
}

export async function AppSidebar({
  user,
  isAdmin,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    id: string;
    name: string;
    email: string;
    locationKey?: string | null;
    role?: string | null;
  };
  isAdmin: boolean;
}) {
  const cookieStore = await cookies();
  const initialOpenItems = readOpenItemsCookie(cookieStore.get(NAV_OPEN_ITEMS_COOKIE)?.value);
  const db = getDatabase();
  const assignedLocation = getAssignedLocation(user);
  const dashboardActivities = getDashboardActivities(db, { isAdmin, location: assignedLocation });
  const dismissedDashboardActivityIds = new Set(
    db
      .select({ activityId: dashboardActivityDismissals.activityId })
      .from(dashboardActivityDismissals)
      .where(eq(dashboardActivityDismissals.userId, user.id))
      .all()
      .map((row) => row.activityId),
  );
  const dashboardActivityCount = dashboardActivities.filter(
    (activity) => !dismissedDashboardActivityIds.has(activity.id),
  ).length;
  const openBankTransactionCount = isAdmin ? getOpenFinancialTransactionCount(db) : 0;
  const openBookings = db
    .select({ id: bookings.id, status: bookings.status, createdAt: bookings.createdAt, updatedAt: bookings.updatedAt })
    .from(bookings)
    .where(and(assignedLocation ? eq(bookings.location, assignedLocation) : undefined))
    .all();
  const openBookingCount = getPendingBookingAttentionBookingIds(db, openBookings).size;
  const navItems = data.navMain
    .filter((item) => !item.adminOnly || isAdmin)
    .map((item) =>
      item.title === "Dashboard"
        ? { ...item, badge: dashboardActivityCount, badgeLabel: "offene Aktivitäten" }
        : item.title === "Buchungen"
          ? { ...item, badge: openBookingCount }
          : item.title === "Buchhaltung"
            ? {
                ...item,
                items: item.items?.map((subItem) =>
                  subItem.title === "Banktransaktionen" ? { ...subItem, badge: openBankTransactionCount } : subItem,
                ),
              }
            : item,
    );
  const secondaryNavItems = data.navSecondary.filter((item) => !item.adminOnly || isAdmin);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="data-[slot=sidebar-menu-button]:p-1.5!" render={<Link href="/admin" />}>
              <BikeIcon className="size-5!" />
              <span className="text-base font-semibold">Munich Bike Rental</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} initialOpenItems={initialOpenItems} />
        <NavSecondary items={secondaryNavItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ ...user, avatar: "/favicon.png" }} />
      </SidebarFooter>
    </Sidebar>
  );
}
