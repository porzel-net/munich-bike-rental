"use client";

import * as React from "react";

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
  ChartBarIcon,
  ChartNoAxesCombinedIcon,
  BoxesIcon,
  CalendarDaysIcon,
  EuroIcon,
  LayoutDashboardIcon,
  ListIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react";

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
    },
    {
      title: "Google Analysen",
      url: "/admin/google-analytics",
      icon: <ChartNoAxesCombinedIcon />,
      adminOnly: true,
    },
    {
      title: "Finanz Analysen",
      url: "/admin/financial-analytics",
      icon: <ChartBarIcon />,
      adminOnly: true,
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
      title: "Einstellungen",
      url: "/admin/settings",
      icon: <Settings2Icon />,
    },
  ],
};
export function AppSidebar({
  user,
  isAdmin,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    name: string;
    email: string;
  };
  isAdmin: boolean;
}) {
  const navItems = data.navMain.filter((item) => !item.adminOnly || isAdmin);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="data-[slot=sidebar-menu-button]:p-1.5!" render={<a href="/admin" />}>
              <BikeIcon className="size-5!" />
              <span className="text-base font-semibold">Munich Bike Rental</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ ...user, avatar: "/favicon.png" }} />
      </SidebarFooter>
    </Sidebar>
  );
}
