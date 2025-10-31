"use client";

import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { organization } from "@/lib/auth-client";

interface Organization {
  id: string;
  name: string;
  slug: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export function WorkspaceSwitcher() {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const response = await organization.list();
      if (response.data && Array.isArray(response.data)) {
        setOrganizations(response.data);

        // Get active organization
        const active = await organization.getFullOrganization();

        if (active.data) {
          setActiveOrg(active.data);
        } else if (response.data.length > 0) {
          // If no active org but user has orgs, set the first one as active
          const firstOrg = response.data[0];
          await organization.setActive({
            organizationId: firstOrg.id,
          });
          setActiveOrg(firstOrg);
        }
      }
    } catch (error) {
      console.error("Failed to load organizations:", error);
      toast.error("Failed to load workspaces");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchOrganization = async (orgId: string) => {
    try {
      await organization.setActive({ organizationId: orgId });
      const newActive = organizations.find((org) => org.id === orgId);
      if (newActive) {
        setActiveOrg(newActive);
        toast.success(`Switched to ${newActive.name}`);
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to switch organization:", error);
      toast.error("Failed to switch workspace");
    }
  };

  const handleCreateWorkspace = () => {
    // router.push("/onboarding");
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="data-[state=open]:bg-sidebar-accent"
            size="lg"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Loading...</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!activeOrg) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="cursor-pointer hover:bg-sidebar-accent"
            onClick={handleCreateWorkspace}
            size="lg"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Plus className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Create Workspace</span>
              <span className="truncate text-muted-foreground text-xs">
                Get started
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              size="lg"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                  {getInitials(activeOrg.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{activeOrg.name}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {activeOrg.slug}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Workspaces
            </DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                className="cursor-pointer gap-2 p-2"
                key={org.id}
                onClick={() => handleSwitchOrganization(org.id)}
              >
                <Avatar className="h-6 w-6 rounded-md">
                  <AvatarFallback className="rounded-md bg-muted text-xs">
                    {getInitials(org.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col">
                  <span className="font-medium">{org.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {org.slug}
                  </span>
                </div>
                {activeOrg.id === org.id && (
                  <Check className="ml-auto size-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2 p-2"
              onClick={handleCreateWorkspace}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">
                Add workspace
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
