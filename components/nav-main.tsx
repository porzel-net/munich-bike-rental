"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { ChevronRightIcon } from "lucide-react";

const NAV_OPEN_ITEMS_COOKIE = "admin_nav_open_items";
const NAV_OPEN_ITEMS_MAX_AGE = 60 * 60 * 24 * 30;

export function NavMain({
  items,
  initialOpenItems,
}: {
  items: {
    title: string;
    url: string;
    icon?: React.ReactNode;
    adminOnly?: boolean;
    badge?: number;
    items?: { title: string; url: string; badge?: number }[];
  }[];
  initialOpenItems?: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>(initialOpenItems ?? {});

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {(() => {
                const isOpen =
                  openItems[item.title] ?? Boolean(item.items?.some((subItem) => pathname === subItem.url));
                const toggleItem = () => {
                  setOpenItems((current) => {
                    const next = { ...current, [item.title]: !isOpen };
                    document.cookie = `${NAV_OPEN_ITEMS_COOKIE}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${NAV_OPEN_ITEMS_MAX_AGE}`;
                    return next;
                  });
                };
                return (
                  <>
                    <SidebarMenuButton
                      render={
                        item.items?.length ? <button type="button" onClick={toggleItem} /> : <a href={item.url} />
                      }
                      tooltip={item.title}
                      isActive={
                        pathname === item.url || Boolean(item.items?.some((subItem) => pathname === subItem.url))
                      }
                    >
                      {item.icon}
                      <span>{item.title}</span>
                      {item.badge ? (
                        <span
                          className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[11px] leading-none font-semibold tracking-[-0.01em] text-white shadow-sm tabular-nums"
                          aria-label={`${item.badge} offene Buchungen`}
                          title={`${item.badge} offene Buchungen`}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </SidebarMenuButton>
                    {item.items?.length ? (
                      <SidebarMenuAction
                        aria-label={`${item.title} Unterseiten anzeigen`}
                        aria-expanded={isOpen}
                        onClick={toggleItem}
                      >
                        <ChevronRightIcon className={isOpen ? "rotate-90" : undefined} />
                      </SidebarMenuAction>
                    ) : null}
                    {item.items?.length && isOpen ? (
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton render={<a href={subItem.url} />} isActive={pathname === subItem.url}>
                              {subItem.title}
                              {subItem.badge ? (
                                <span
                                  className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[11px] leading-none font-semibold tracking-[-0.01em] text-white shadow-sm tabular-nums"
                                  aria-label={`${subItem.badge} offene Banktransaktionen`}
                                  title={`${subItem.badge} offene Banktransaktionen`}
                                >
                                  {subItem.badge}
                                </span>
                              ) : null}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    ) : null}
                  </>
                );
              })()}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
