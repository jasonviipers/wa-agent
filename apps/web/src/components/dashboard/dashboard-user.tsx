"use client";

import {
  CreditCardIcon,
  EllipsisVerticalIcon,
  HomeIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { signOut, useSession } from "@/lib/auth-client";

// Better Auth UI Profile types
interface Profile {
  avatarUrl?: string | null;
  avatar?: string | null;
  image?: string | null;
  emailVerified?: boolean | null;
  isAnonymous?: boolean | null;
  fullName?: string | null;
  firstName?: string | null;
  displayName?: string | null;
  username?: string | null;
  displayUsername?: string | null;
  name?: string | null;
  email?: string | null;
  id?: string | number;
}

export function DashboardUser() {
  const router = useRouter();
  const { isMobile } = useSidebar();

  // Use Better Auth session hook to get real user data
  const { data: session, isPending } = useSession();

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/");
          },
        },
      });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Show loading state or return null if no session
  if (isPending) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <Avatar className="in-data-[state=expanded]:size-6 transition-[width,height] duration-200 ease-in-out">
              <AvatarFallback>...</AvatarFallback>
            </Avatar>
            <div className="ms-1 grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Loading...</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!session?.user) {
    return null;
  }

  const user = session.user as Profile;

  // Get user's display name with fallbacks
  const displayName =
    user.displayName || user.fullName || user.name || user.firstName || "User";

  // Get user's avatar with fallbacks
  const avatarSrc = user.avatarUrl || user.avatar || user.image;

  // Generate initials for fallback
  const initials =
    displayName
      .split(" ")
      .map((name) => name.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:active:bg-transparent group-data-[collapsible=icon]:hover:bg-transparent"
              size="lg"
            >
              <Avatar className="in-data-[state=expanded]:size-6 transition-[width,height] duration-200 ease-in-out group-data-[collapsible=icon]:size-8">
                <AvatarImage alt={displayName} src={avatarSrc || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="ms-1 grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{displayName}</span>
                {user.email && (
                  <span className="truncate text-muted-foreground text-xs">
                    {user.email}
                  </span>
                )}
              </div>
              <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-accent/50 in-[[data-slot=dropdown-menu-trigger]:hover]:bg-transparent group-data-[collapsible=icon]:hidden">
                <EllipsisVerticalIcon className="size-5 opacity-40" size={20} />
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <Link href="/workspace">
              <DropdownMenuItem className="gap-3 px-1">
                <HomeIcon
                  aria-hidden="true"
                  className="text-muted-foreground/70"
                  size={20}
                />
                <span>Dashboard</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/workspace/settings">
              <DropdownMenuItem className="gap-3 px-1">
                <UserIcon
                  aria-hidden="true"
                  className="text-muted-foreground/70"
                  size={20}
                />
                <span>Account</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/workspace/billing">
              <DropdownMenuItem className="gap-3 px-1">
                <CreditCardIcon
                  aria-hidden="true"
                  className="text-muted-foreground/70"
                  size={20}
                />
                <span>Billing</span>
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />

            <Link href="/workspace/settings">
              <DropdownMenuItem className="cursor-pointer gap-3 px-1">
                <SettingsIcon
                  aria-hidden="true"
                  className="text-muted-foreground/70"
                  size={20}
                />
                <span>Setting</span>
              </DropdownMenuItem>
            </Link>
            <DropdownMenuItem
              className="cursor-pointer gap-3 px-1"
              onClick={handleSignOut}
            >
              <LogOutIcon
                aria-hidden="true"
                className="text-muted-foreground/70"
                size={20}
              />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
