"use client";

import * as React from "react";
import {
  Laptop,
  Loader2,
  Monitor,
  Router,
  Server,
  Smartphone,
  ToyBrick,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Device } from "@/lib/types";
import { cn } from "@/lib/utils";

const MOCK_DEVICES: Device[] = [
  { id: "1", name: "DEV-LAPTOP-01", ipAddress: "192.168.1.10", macAddress: "00:1B:44:11:3A:B7", status: "online", type: "laptop", os: "Windows 11", lastSeen: "2 minutes ago" },
  { id: "2", name: "PROD-SERVER-01", ipAddress: "192.168.1.5", macAddress: "00:0A:95:9D:68:16", status: "online", type: "server", os: "Ubuntu 22.04", lastSeen: "Now" },
  { id: "3", name: "Main Gateway", ipAddress: "192.168.1.1", macAddress: "A8:5E:45:C4:5D:2C", status: "online", type: "router", os: "RouterOS", lastSeen: "Now" },
  { id: "4", name: "Admin's iPhone", ipAddress: "192.168.1.15", macAddress: "F0:D5:BF:9B:F3:B1", status: "offline", type: "mobile", os: "iOS 17", lastSeen: "1 hour ago" },
  { id: "5", name: "OFFICE-PC-12", ipAddress: "192.168.1.22", macAddress: "3C:7C:3F:8C:9B:AA", status: "online", type: "desktop", os: "Windows 10", lastSeen: "15 minutes ago" },
  { id: "6", name: "Smart Thermostat", ipAddress: "192.168.1.30", macAddress: "E0:76:D0:3F:8A:7E", status: "online", type: "iot", os: "Custom Linux", lastSeen: "5 minutes ago" },
  { id: "7", name: "BACKUP-SERVER", ipAddress: "192.168.1.6", macAddress: "00:0A:95:9D:68:17", status: "offline", type: "server", os: "FreeNAS", lastSeen: "3 days ago" },
  { id: "8", name: "Guest Laptop", ipAddress: "192.168.1.45", macAddress: "9C:B6:D0:FF:1E:E4", status: "online", type: "laptop", os: "macOS Sonoma", lastSeen: "30 minutes ago" },
];

const ICONS: Record<Device["type"], React.ElementType> = {
  laptop: Laptop,
  server: Server,
  router: Router,
  mobile: Smartphone,
  desktop: Monitor,
  iot: ToyBrick,
};

type DeviceListProps = {
  onSelectDevice: (device: Device) => void;
};

export default function DeviceList({ onSelectDevice }: DeviceListProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [devices, setDevices] = React.useState<Device[]>([]);

  const handleScan = async () => {
    setIsLoading(true);
    setDevices([]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setDevices(MOCK_DEVICES);
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">Network Devices</h1>
            <p className="text-muted-foreground">
              Discover and manage devices connected to your network.
            </p>
          </div>
          <Button onClick={handleScan} disabled={isLoading} size="lg">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Wifi className="mr-2 h-4 w-4" />
                Discover Devices
              </>
            )}
          </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && devices.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {devices.map((device) => {
            const Icon = ICONS[device.type];
            return (
              <Card
                key={device.id}
                onClick={() => onSelectDevice(device)}
                className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">{device.name}</CardTitle>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-sm text-muted-foreground">{device.ipAddress}</p>
                   <div className="flex items-center pt-2">
                      <div className={cn(
                          "h-2.5 w-2.5 rounded-full mr-2",
                          device.status === 'online' ? "bg-green-500" : "bg-gray-400"
                      )} />
                      <p className="text-xs text-muted-foreground">
                        {device.status === 'online' ? 'Online' : `Offline - ${device.lastSeen}`}
                      </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && devices.length === 0 && (
         <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-80">
            <Wifi className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No devices found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                Click "Discover Devices" to scan your network.
            </p>
        </div>
      )}
    </div>
  );
}
