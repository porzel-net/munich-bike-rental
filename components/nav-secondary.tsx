"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string;
    url: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
    badge?: number;
  }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname();
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton render={<a href={item.url} />} isActive={pathname === item.url}>
                {item.icon}
                <span>{item.title}</span>
                {item.badge ? (
                  <span
                    className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[11px] leading-none font-semibold tracking-[-0.01em] text-white shadow-sm tabular-nums"
                    aria-label={`${item.badge} offene E-Mails`}
                    title={`${item.badge} offene E-Mails`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
