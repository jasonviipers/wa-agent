import type React from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

interface ProtectedLayoutProps {
  children: React.ReactNode;
  organizationId?: Promise<string>;
}
export default async function ProtectedLayout({
  children,
  organizationId,
}: Readonly<ProtectedLayoutProps>) {
  return (
      <DashboardLayout>{children}</DashboardLayout>
  );
}
