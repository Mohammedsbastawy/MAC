import type { Metadata } from "next";
import Link from "next/link";
import { Devices, Zap } from "lucide-react";
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

export const metadata: Metadata = {
  title: "Dashboard - Dominion Control Panel",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full flex-col">
          <DashboardHeader />
          <div className="flex flex-1">
            <Sidebar>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Network Devices" isActive>
                            <Link href="/dashboard/devices">
                                <Devices />
                                <span>Network Devices</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Quick Tools">
                            <Link href="/dashboard/gpupdate">
                                <Zap />
                                <span>Quick Tools</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
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
