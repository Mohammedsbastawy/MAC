"use client";

import * as React from "react";
import {
  Laptop,
  Loader2,
  Monitor,
  Network,
  Router,
  Server,
  Smartphone,
  ToyBrick,
  Wifi,
  WifiOff,
  Users,
  Briefcase,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Device } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "../ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

const ICONS: Record<Device["type"], React.ElementType> = {
  laptop: Laptop,
  server: Server,
  router: Router,
  mobile: Smartphone,
  desktop: Monitor,
  iot: ToyBrick,
  unknown: Laptop,
};

type GpUpdateStatus = 'idle' | 'loading' | 'success' | 'error';
type GpUpdateResult = {
    status: GpUpdateStatus;
    output?: string;
};

export default function DeviceList({ onSelectDevice }: { onSelectDevice: (device: Device) => void; }) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [isGpUpdating, setIsGpUpdating] = React.useState(false);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const { toast } = useToast();

  const [gpUpdateStatus, setGpUpdateStatus] = React.useState<Record<string, GpUpdateResult>>({});
  const [errorDialog, setErrorDialog] = React.useState<{isOpen: boolean, content: string}>({ isOpen: false, content: '' });


  React.useEffect(() => {
    // Initially load devices from the backend if any are cached
    const fetchInitialDevices = async () => {
        try {
            const res = await fetch("/api/devices", { method: 'POST' });
            const data = await res.json();
            if (data.ok && data.devices.length > 0) {
                 const fetchedDevices: Device[] = data.devices.map((d: any) => ({
                    id: d.ip,
                    name: d.hostname === "Unknown" ? d.ip : d.hostname,
                    ipAddress: d.ip,
                    macAddress: d.mac,
                    status: 'online',
                    type: determineDeviceType(d.hostname),
                    os: d.os || "Unknown",
                    lastSeen: 'Now',
                    domain: d.domain,
                    isDomainMember: d.isDomainMember,
                }));
                setDevices(fetchedDevices);
            }
        } catch (err) {}
    };
    fetchInitialDevices();
  }, []);


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
  
  const handleScan = async () => {
    setIsScanning(true);
    setDevices([]);
    setGpUpdateStatus({});
    toast({ title: "Discovering Devices...", description: "Querying Active Directory for domain computers. This may take a moment."});

    try {
      const res = await fetch("/api/discover-devices", { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to start discovery.");
      }
      
      const fetchedDevices: Device[] = data.devices.map((d: any) => ({
            id: d.ip,
            name: d.hostname === "Unknown" ? d.ip : d.hostname,
            ipAddress: d.ip,
            macAddress: d.mac,
            status: d.status,
            type: determineDeviceType(d.hostname),
            os: d.os || "Unknown",
            lastSeen: 'Now',
            domain: d.domain,
            isDomainMember: d.isDomainMember,
      }));
      
      setDevices(fetchedDevices);
      const onlineCount = fetchedDevices.filter(d => d.status === 'online').length;
      toast({ title: "Discovery Complete", description: `Found ${fetchedDevices.length} total computers. ${onlineCount} are currently online.` });

    } catch (err: any) {
        toast({ variant: "destructive", title: "Discovery Error", description: err.message });
    } finally {
        setIsScanning(false);
    }
  };

  const handleMassGpUpdate = async () => {
    const onlineDevices = devices.filter(d => d.status === 'online');
    if (onlineDevices.length === 0) {
      toast({ title: "No Online Devices", description: "There are no online devices to update." });
      return;
    }

    setIsGpUpdating(true);
    toast({ title: "Starting Mass GpUpdate", description: `Updating ${onlineDevices.length} online devices...` });

    const initialStatus: Record<string, GpUpdateResult> = {};
    onlineDevices.forEach(d => {
      initialStatus[d.id] = { status: 'loading' };
    });
    setGpUpdateStatus(initialStatus);

    for (const device of onlineDevices) {
        try {
            const response = await fetch('/api/psexec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: device.ipAddress, cmd: "gpupdate /force" }),
            });

            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                setGpUpdateStatus(prev => ({
                    ...prev,
                    [device.id]: {
                        status: 'error',
                        output: `Invalid response from server: ${responseText}`
                    }
                }));
                continue;
            }
            
            setGpUpdateStatus(prev => ({
                ...prev,
                [device.id]: {
                    status: result.rc === 0 ? 'success' : 'error',
                    output: result.stdout || result.stderr
                }
            }));

        } catch (error: any) {
            setGpUpdateStatus(prev => ({
                ...prev,
                [device.id]: {
                    status: 'error',
                    output: error.message || "A client-side error occurred."
                }
            }));
        }
    }
    
    setIsGpUpdating(false);
    toast({ title: "Mass GpUpdate Complete", description: "Finished updating all targeted devices." });
  };

  const renderStatusIcon = (device: Device) => {
      const status = gpUpdateStatus[device.id]?.status;

      switch(status) {
          case 'loading':
              return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
          case 'success':
              return <CheckCircle2 className="h-5 w-5 text-green-500" />;
          case 'error':
              return (
                  <Button variant="ghost" size="icon" className="h-auto w-auto text-red-500 hover:text-red-500" onClick={(e) => {
                      e.stopPropagation();
                      setErrorDialog({ isOpen: true, content: gpUpdateStatus[device.id]?.output || "No error details available." });
                  }}>
                    <XCircle className="h-5 w-5" />
                  </Button>
              );
          default:
              const Icon = ICONS[device.type] || Laptop;
              return <Icon className="h-5 w-5 text-muted-foreground" />;
      }
  }

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const offlineDevices = devices.length - onlineDevices;

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
              <CardFooter>
                 <Skeleton className="h-5 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      );
    }

    if (!isScanning && devices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-80">
          <Network className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">Discover Your Network</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Click "Discover Devices" to query Active Directory for all computers.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {devices.map((device) => {
          return (
            <Card
              key={device.id}
              onClick={() => onSelectDevice(device)}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 flex flex-col",
                device.status === 'offline' && "opacity-50 hover:opacity-100"
                )}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{device.name}</CardTitle>
                {renderStatusIcon(device)}
              </CardHeader>
              <CardContent className="space-y-1 flex-grow">
                <p className="text-sm text-muted-foreground">{device.ipAddress}</p>
                 <div className="flex items-center pt-2">
                    <div className={cn(
                        "h-2.5 w-2.5 rounded-full mr-2",
                        device.status === 'online' ? "bg-green-500" : "bg-gray-400"
                    )} />
                    <p className="text-xs text-muted-foreground capitalize">
                      {device.status}
                    </p>
                </div>
              </CardContent>
              <CardFooter>
                {device.isDomainMember ? (
                    <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                        <Users className="mr-1 h-3 w-3" />
                        Domain Member
                    </Badge>
                ) : (
                    <Badge variant="secondary">
                        <Briefcase className="mr-1 h-3 w-3" />
                        Workgroup
                    </Badge>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">Network Devices</h1>
           <p className="text-muted-foreground">
            {isScanning 
                ? `Querying domain for computers...`
                : devices.length > 0 
                    ? `Found ${devices.length} total devices. ${onlineDevices} online, ${offlineDevices} offline.`
                    : "No devices discovered yet."
            }
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleScan} disabled={isScanning || isGpUpdating} size="lg" className="h-11">
                {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Discover Devices
            </Button>
            <Button onClick={handleMassGpUpdate} disabled={isScanning || isGpUpdating || onlineDevices === 0} size="lg" className="h-11">
                {isGpUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                Mass GpUpdate
            </Button>
        </div>
      </div>
      {renderContent()}
    </div>

    <AlertDialog open={errorDialog.isOpen} onOpenChange={(open) => !open && setErrorDialog({isOpen: false, content:''})}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>GPUpdate Execution Failed</AlertDialogTitle>
                <AlertDialogDescription>
                    The `gpupdate /force` command failed. Here is the output from the remote machine.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4">
                <Label htmlFor="error-output">Error Log</Label>
                <Textarea 
                    id="error-output"
                    readOnly 
                    value={errorDialog.content}
                    className="mt-2 h-60 font-mono text-xs bg-muted"
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setErrorDialog({isOpen: false, content:''})}>Close</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
