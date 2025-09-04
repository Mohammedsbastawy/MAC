"use client";

import type { Metadata } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Network, Zap } from "lucide-react";
import DashboardHeader from "@/components/dashboard/header";
import { AuthProvider } from "@/hooks/use-auth";
import {
  SidebarProvider,
  Sidebar,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from "@/components/ui/sidebar";

// We can't have metadata in a client component.
// export const metadata: Metadata = {
//   title: "Dashboard - Dominion Control Panel",
// };

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  return (
    <AuthProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full flex-col">
          <DashboardHeader />
          <div className="flex flex-1">
            <Sidebar>
                <SidebarMenu>
                    <SidebarMenuButton asChild tooltip="Network Devices" isActive={pathname === '/dashboard/devices'}>
                        <Link href="/dashboard/devices">
                            <Network />
                            <span>Network Devices</span>
                        </Link>
                    </SidebarMenuButton>
                    <SidebarMenuButton asChild tooltip="Quick Tools" isActive={pathname === '/dashboard/gpupdate'}>
                        <Link href="/dashboard/gpupdate">
                            <Zap />
                            <span>Quick Tools</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenu>
            </Sidebar>
            <SidebarInset>
              <main className="flex-1 p-4 sm:p-6 md:p-8">{children}</main>
            </SidebarInset>
          </div>
        </div>
      </SidebarProvider>
    </AuthProvider>
  );
}
