"use client";

import * as React from "react";
import DeviceList from "@/components/dashboard/device-list";
import DeviceActionsPanel from "@/components/dashboard/device-actions-panel";
import type { Device } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Lock } from "lucide-react";

const UnauthenticatedMessage: React.FC = () => (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-[calc(100vh-200px)]">
        <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">Authentication Required</h3>
        <p className="mt-2 text-sm text-muted-foreground">
            Please sign in using the form in the header to access the dashboard.
        </p>
    </div>
);


export default function DashboardPage() {
  const [selectedDevice, setSelectedDevice] = React.useState<Device | null>(null);
  const { user, isLoading } = useAuth();

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device);
  };

  const handleClosePanel = () => {
    setSelectedDevice(null);
  };

  if (isLoading) {
    return null; // Or a loading spinner for the whole page
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
