"use client";

import { Fragment } from "react";
import { RedirectToSignUp, SignedIn } from "@daveyplate/better-auth-ui";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashoard-header";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <Fragment>
      <RedirectToSignUp />
      <SignedIn>
        <SidebarProvider defaultOpen={false}>
          <DashboardSidebar />
          <SidebarInset className="flex flex-col">
            <DashboardHeader />
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">{children}</div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </SignedIn>
    </Fragment>
  );
}
