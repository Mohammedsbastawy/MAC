"use client";

import DashboardHeader from "@/components/dashboard/header";
import { AuthProvider } from "@/hooks/use-auth";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarItem, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Briefcase, FolderCog, HelpCircle, Network, Users, NotebookText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";


const AppSidebar = () => {
    const pathname = usePathname();
    const { isMobile, setOpenMobile } = useSidebar();

    const closeSidebar = () => {
      if (isMobile) {
        setOpenMobile(false);
      }
    }

    return (
        <Sidebar>
            <SidebarContent className="p-2">
                <SidebarGroup>
                   <SidebarMenu>
                        <SidebarMenuItem>
                            <Link href="/dashboard/devices" passHref legacyBehavior>
                                <SidebarMenuButton isActive={pathname.startsWith('/dashboard/devices')} onClick={closeSidebar}>
                                    <Network />
                                    <span>Network Devices</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                             <Link href="/dashboard/ad" passHref legacyBehavior>
                                <SidebarMenuButton isActive={pathname.startsWith('/dashboard/ad')} onClick={closeSidebar}>
                                    <Users />
                                    <span>Active Directory</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <Link href="/dashboard/logs" passHref legacyBehavior>
                                <SidebarMenuButton isActive={pathname.startsWith('/dashboard/logs')} onClick={closeSidebar}>
                                    <NotebookText />
                                    <span>System Logs</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <Link href="/dashboard/help" passHref legacyBehavior>
                                <SidebarMenuButton isActive={pathname.startsWith('/dashboard/help')} onClick={closeSidebar}>
                                    <HelpCircle />
                                    <span>Help & Prerequisites</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                   </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter />
        </Sidebar>
    )
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </SidebarProvider>
    </AuthProvider>
  );
}

const DashboardLayoutContent = ({ children }: { children: React.Node }) => {
  const { state } = useSidebar();
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AppSidebar />
        <div className={cn("flex flex-col sm:gap-4 sm:py-4 transition-[padding-left]",
            state === 'expanded' ? "sm:pl-56" : "sm:pl-14"
        )}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6 md:p-8">{children}</main>
        </div>
    </div>
  )
}
