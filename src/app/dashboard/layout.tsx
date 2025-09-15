
"use client";

import DashboardHeader from "@/components/dashboard/header";
import { AuthProvider } from "@/hooks/use-auth";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarItem, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger, useSidebar, SidebarHeader, SidebarSub, SidebarSubTrigger, SidebarSubContent } from "@/components/ui/sidebar";
import { Globe, Users, NotebookText, HelpCircle, Settings, File, Briefcase, Server, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";


const AppSidebar = () => {
    const pathname = usePathname();
    const { isMobile, setOpenMobile, state } = useSidebar();

    const closeSidebar = () => {
      if (isMobile) {
        setOpenMobile(false);
      }
    }

    return (
        <Sidebar>
            <SidebarHeader>
                 <div className={cn("flex w-full items-center justify-center gap-3 h-24", state === "collapsed" && "hidden")}>
                    <Logo className="h-16 w-16" />
                    <div className="flex flex-col items-start">
                        <span className="text-2xl font-headline font-bold tracking-wider">ATLAS</span>
                        <span className="text-xs text-muted-foreground">BY BASTAWY</span>
                    </div>
                </div>
                 <div className={cn("flex w-full flex-col items-center justify-center", state === "expanded" && "hidden")}>
                    <Logo className="h-12 w-12" />
                </div>
            </SidebarHeader>
            <SidebarContent className="p-2">
                <SidebarGroup>
                   <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/devices')} onClick={closeSidebar}>
                                <Link href="/dashboard/devices">
                                    <Globe />
                                    <span className={cn(state === 'collapsed' && "hidden")}>Network Devices</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/monitoring')} onClick={closeSidebar}>
                                 <Link href="/dashboard/monitoring">
                                    <Server />
                                    <span className={cn(state === 'collapsed' && "hidden")}>Monitoring</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/ad')} onClick={closeSidebar}>
                                 <Link href="/dashboard/ad">
                                    <Users />
                                    <span className={cn(state === 'collapsed' && "hidden")}>Active Directory</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/logs')} onClick={closeSidebar}>
                                <Link href="/dashboard/logs">
                                    <NotebookText />
                                    <span className={cn(state === 'collapsed' && "hidden")}>System Logs</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                             <SidebarSub>
                                <SidebarSubTrigger>
                                     <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/help')}>
                                        <span>
                                            <HelpCircle />
                                            <span className={cn(state === 'collapsed' && "hidden")}>Help & Guides</span>
                                        </span>
                                    </SidebarMenuButton>
                                </SidebarSubTrigger>
                                <SidebarSubContent>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild isActive={pathname === '/dashboard/help'} onClick={closeSidebar}>
                                            <Link href="/dashboard/help">
                                                <File className="mr-2 h-4 w-4" />
                                                All Prerequisites
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                         <SidebarMenuButton asChild isActive={pathname === '/dashboard/help/workgroup'} onClick={closeSidebar}>
                                            <Link href="/dashboard/help/workgroup">
                                                 <Briefcase className="mr-2 h-4 w-4" />
                                                Workgroup Setup
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                     <SidebarMenuItem>
                                         <SidebarMenuButton asChild isActive={pathname === '/dashboard/help/agent'} onClick={closeSidebar}>
                                            <Link href="/dashboard/help/agent">
                                                 <Zap className="mr-2 h-4 w-4" />
                                                Agent Deployment
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarSubContent>
                            </SidebarSub>
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

const DashboardLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const { state } = useSidebar();
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AppSidebar />
        <div className={cn("flex flex-col sm:gap-4 sm:py-4 transition-[padding-left]",
            state === 'expanded' ? "sm:pl-64" : "sm:pl-14"
        )}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6 md:p-8">{children}</main>
        </div>
    </div>
  )
}
