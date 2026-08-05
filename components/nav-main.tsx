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

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: React.ReactNode;
    adminOnly?: boolean;
    items?: { title: string; url: string }[];
  }[];
}) {
  const pathname = usePathname();
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({});
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {(() => {
                const isOpen = openItems[item.title] ?? Boolean(item.items?.some((subItem) => pathname === subItem.url));
                const toggleItem = () => setOpenItems((current) => ({ ...current, [item.title]: !isOpen }));
                return (
                  <>
                    <SidebarMenuButton
                      render={
                        item.items?.length ? (
                          <button type="button" onClick={toggleItem} />
                        ) : (
                          <a href={item.url} />
                        )
                      }
                      tooltip={item.title}
                      isActive={pathname === item.url || Boolean(item.items?.some((subItem) => pathname === subItem.url))}
                    >
                      {item.icon}
                      <span>{item.title}</span>
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
