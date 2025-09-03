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
  WifiOff,
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
import { useToast } from "@/hooks/use-toast";

const ICONS: Record<Device["type"], React.ElementType> = {
  laptop: Laptop,
  server: Server,
  router: Router,
  mobile: Smartphone,
  desktop: Monitor,
  iot: ToyBrick,
  unknown: Laptop,
};

type DeviceListProps = {
  onSelectDevice: (device: Device) => void;
};

// Polling interval for scan status (in milliseconds)
const POLLING_INTERVAL = 2000;

export default function DeviceList({ onSelectDevice }: DeviceListProps) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [scanCount, setScanCount] = React.useState(0);
  const { toast } = useToast();
  const pollingTimer = React.useRef<NodeJS.Timeout | null>(null);

  const determineDeviceType = (hostname: string): Device["type"] => {
    const lowerHostname = hostname.toLowerCase();
    if (lowerHostname.includes("laptop")) return "laptop";
    if (lowerHostname.includes("server")) return "server";
    if (lowerHostname.includes("router") || lowerHostname.includes("gateway")) return "router";
    if (lowerHostname.includes("phone") || lowerHostname.includes("mobile")) return "mobile";
    if (lowerHostname.includes("desktop") || lowerHostname.includes("pc")) return "desktop";
    if (lowerHostname.includes("iot") || lowerHostname.includes("thermostat") || lowerHostname.includes("light")) return "iot";
    return "unknown";
  };

  const pollScanStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/arp-scan-status", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setScanCount(data.count);
        const fetchedDevices: Device[] = data.devices.map((d: any, i: number) => ({
            id: d.ip,
            name: d.hostname === "Unknown" ? d.ip : d.hostname,
            ipAddress: d.ip,
            macAddress: d.mac,
            status: 'online',
            type: determineDeviceType(d.hostname),
            os: 'Unknown',
            lastSeen: 'Now'
        }));
        setDevices(fetchedDevices);

        if (!data.running) {
          stopPolling();
          toast({ title: "Scan Complete", description: `Found ${data.devices.length} devices.` });
        }
      } else {
        stopPolling();
        toast({ variant: "destructive", title: "Scan Error", description: data.error });
      }
    } catch (err) {
      stopPolling();
      toast({ variant: "destructive", title: "Scan Error", description: "Could not get scan status." });
    }
  }, [toast]);

  const stopPolling = React.useCallback(() => {
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
      pollingTimer.current = null;
    }
    setIsScanning(false);
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    setDevices([]);
    setScanCount(0);

    try {
      const res = await fetch("/api/arp-scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to start scan.");
      }
      // Start polling for status
      if (pollingTimer.current) clearInterval(pollingTimer.current);
      pollingTimer.current = setInterval(pollScanStatus, POLLING_INTERVAL);
    } catch (err: any) {
        toast({ variant: "destructive", title: "Scan Error", description: err.message });
        setIsScanning(false);
    }
  };

  const handleCancelScan = async () => {
    stopPolling();
    try {
        await fetch("/api/arp-scan-cancel", { method: "POST"});
        toast({ title: "Scan Cancelled", description: "The network scan has been stopped." });
    } catch (err) {
        toast({ variant: "destructive", title: "Error", description: "Could not cancel scan." });
    }
  };
  
  React.useEffect(() => {
    // Cleanup polling on component unmount
    return () => {
      if (pollingTimer.current) {
        clearInterval(pollingTimer.current);
      }
    };
  }, []);

  const renderContent = () => {
    if (isScanning && devices.length === 0) {
      return (
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
      );
    }

    if (!isScanning && devices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-80">
          <Wifi className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No devices found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Click "Discover Devices" to scan your network.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {devices.map((device) => {
          const Icon = ICONS[device.type] || Laptop;
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
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">Network Devices</h1>
          <p className="text-muted-foreground">
            {isScanning 
                ? `Scanning... Found ${scanCount} device(s) so far.`
                : `Discovered ${devices.length} devices on your network.`
            }
          </p>
        </div>
        {isScanning ? (
            <Button onClick={handleCancelScan} variant="destructive" size="lg">
                <WifiOff className="mr-2 h-4 w-4" />
                Cancel Scan
            </Button>
        ) : (
            <Button onClick={handleScan} disabled={isScanning} size="lg">
                <Wifi className="mr-2 h-4 w-4" />
                Discover Devices
            </Button>
        )}
      </div>
      {renderContent()}
    </div>
  );
}
