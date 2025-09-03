"use client";

import * as React from "react";
import DeviceList from "@/components/dashboard/device-list";
import DeviceActionsPanel from "@/components/dashboard/device-actions-panel";
import type { Device } from "@/lib/types";

export default function DashboardPage() {
  const [selectedDevice, setSelectedDevice] = React.useState<Device | null>(null);

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device);
  };

  const handleClosePanel = () => {
    setSelectedDevice(null);
  };

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
