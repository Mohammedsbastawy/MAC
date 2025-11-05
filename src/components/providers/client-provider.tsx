"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { DeviceProvider } from "@/hooks/use-device-context";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <div className={cn(
        "flex flex-col sm:gap-4 sm:py-4 transition-[padding-left]",
        state === 'expanded' ? "sm:pl-64" : "sm:pl-14"
      )}>
        {children}
      </div>
    </div>
  );
}


export function ClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
        <DeviceProvider>
          <SidebarProvider>
            <DashboardLayoutContent>
              {children}
            </DashboardLayoutContent>
          </SidebarProvider>
        </DeviceProvider>
    </AuthProvider>
  );
}
