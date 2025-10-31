"use client";

import {
  FolderArchiveIcon,
  MessageSquareIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  ShredderIcon,
  Users,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { BotIcon, DashboardIcon, IntegrationIcon } from "@/components/icons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { DashboardUser } from "./dashboard-user";

const data = {
  navMain: [
    {
      title: "General",
      items: [
        { title: "Dashboard", url: "/workspace/workspace", icon: DashboardIcon },
        {
          title: "Conversations",
          url: "/conversations",
          icon: MessageSquareIcon,
        },
        { title: "Customers", url: "/workspace/customers", icon: Users },
      ],
    },
    {
      title: "Agents",
      items: [
        { title: "Agents", url: "/workspace/agents", icon: BotIcon },
        { title: "Knowledge Base", url: "/workspace/knowledge", icon: ShredderIcon },
        { title: "Integrations", url: "/workspace/integrations", icon: IntegrationIcon },
      ],
    },
    {
      title: "Products",
      items: [
        { title: "Products", url: "/workspace/products", icon: ShoppingBagIcon },
        {
          title: "Categories/Statuses",
          url: "/workspace/products/category",
          icon: FolderArchiveIcon,
        },
        { title: "Orders", url: "/workspace/orders", icon: ShoppingCartIcon },
      ],
    },
  ],
};

export function DashboardSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="h-16 border-sidebar-border border-b">
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent className="pt-4">
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel className="text-muted-foreground/65 uppercase">
              {item.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((item) => {
                  const isActive = pathname === item.url;

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className="group/menu-button group-data-[collapsible=icon]:px-[5px]! h-9 gap-3 font-medium transition-all duration-300 ease-out [&>svg]:size-auto"
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link
                          className="flex items-center gap-3"
                          href={item.url as Route}
                        >
                          {item.icon && (
                            <item.icon
                              aria-hidden="true"
                              className="size-12 text-muted-foreground/65 group-data-[active=true]/menu-button:text-primary"
                            />
                          )}
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <DashboardUser />
      </SidebarFooter>
    </Sidebar>
  );
}
