"use client";

import * as React from "react";
import DeviceList from "@/components/dashboard/device-list";
import DeviceActionsPanel from "@/components/dashboard/device-actions-panel";
import type { Device } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const UnauthenticatedMessage: React.FC = () => (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-[calc(100vh-200px)]">
        <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">Authentication Required</h3>
        <p className="mt-2 text-sm text-muted-foreground">
            Please sign in using the form in the header to access the dashboard.
        </p>
    </div>
);


export default function DashboardDevicesPage() {
  const [selectedDevice, setSelectedDevice] = React.useState<Device | null>(null);
  const { user, isLoading } = useAuth();

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device);
  };

  const handleClosePanel = () => {
    setSelectedDevice(null);
  };

  if (isLoading) {
      return (
        <div className="space-y-6">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-5 w-80" />
                </div>
                <Skeleton className="h-11 w-56" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
            ))}
            </div>
        </div>
      )
  }

  if (!user) {
    return <UnauthenticatedMessage />;
  }

  return (
    <>
      <DeviceList onSelectDevice={handleSelectDevice} />
      <DeviceActionsPanel
        device={selectedDevice}
        isOpen={!!selectedDevice}
        onClose={handleClosePanel}
      />
    </>
  );
}
