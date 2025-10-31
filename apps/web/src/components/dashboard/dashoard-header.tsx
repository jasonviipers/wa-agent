"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DynamicBreadcrumb } from "@/components/global/dynamic-breadcrumb";
import { ModeToggle } from "@/components/global/mode-toggle";


export function DashboardHeader() {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b p-3 transition-all ease-linear">
      <div className="flex flex-1 items-center gap-2">
        <SidebarTrigger className="rounded-full" />
        <div className="max-lg:hidden lg:contents">
          <Separator
            className="me-2 data-[orientation=vertical]:h-4"
            orientation="vertical"
          />
          <DynamicBreadcrumb />
        </div>
      </div>
      <ModeToggle />
    </header>
  );
}
