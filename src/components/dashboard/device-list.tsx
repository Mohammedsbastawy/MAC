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
  ChevronDown,
  Users,
  Briefcase,
  Zap,
  CheckCircle2,
  XCircle,
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
import type { Device, NetworkInterface } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type DeviceListProps = {
  onSelectDevice: (device: Device) => void;
};

const POLLING_INTERVAL = 2000;

type GpUpdateStatus = 'idle' | 'loading' | 'success' | 'error';
type GpUpdateResult = {
    status: GpUpdateStatus;
    output?: string;
};

export default function DeviceList({ onSelectDevice }: DeviceListProps) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [isGpUpdating, setIsGpUpdating] = React.useState(false);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [scanCount, setScanCount] = React.useState(0);
  const { toast } = useToast();
  const pollingTimer = React.useRef<NodeJS.Timeout | null>(null);

  const [interfaces, setInterfaces] = React.useState<NetworkInterface[]>([]);
  const [selectedInterface, setSelectedInterface] = React.useState<NetworkInterface | null>(null);
  const [networkError, setNetworkError] = React.useState<string | null>(null);

  const [gpUpdateStatus, setGpUpdateStatus] = React.useState<Record<string, GpUpdateResult>>({});
  const [errorDialog, setErrorDialog] = React.useState<{isOpen: boolean, content: string}>({ isOpen: false, content: '' });


  React.useEffect(() => {
    const fetchInterfaces = async () => {
        try {
            setNetworkError(null);
            const res = await fetch("/api/network-interfaces", { method: 'POST' });
            const data = await res.json();
            if(data.ok && data.interfaces.length > 0) {
                setInterfaces(data.interfaces);
                setSelectedInterface(data.interfaces[0]);
            } else {
                 const errorMsg = data.error || "Could not find any usable network interfaces.";
                 setNetworkError(errorMsg);
                 toast({ variant: "destructive", title: "Network Error", description: errorMsg});
            }
        } catch (err: any) {
             const errorMsg = err.message || "An unknown error occurred while fetching network interfaces.";
             setNetworkError(errorMsg);
             toast({ variant: "destructive", title: "Network Error", description: errorMsg});
        }
    };
    fetchInterfaces();
  }, [toast]);


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

  const stopPolling = React.useCallback(() => {
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
      pollingTimer.current = null;
    }
    setIsScanning(false);
  }, []);

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
            os: d.os || "Unknown",
            lastSeen: 'Now',
            domain: d.domain,
            isDomainMember: d.isDomainMember,
        }));
        setDevices(fetchedDevices);

        if (!data.running) {
          stopPolling();
          if (data.error) {
              toast({ variant: "destructive", title: "Scan Finished with Error", description: data.error });
          } else {
              toast({ title: "Scan Complete", description: `Found ${data.devices.length} devices.` });
          }
        }
      } else {
        stopPolling();
        toast({ variant: "destructive", title: "Scan Error", description: data.error });
      }
    } catch (err) {
      stopPolling();
      toast({ variant: "destructive", title: "Scan Error", description: "Could not get scan status." });
    }
  }, [toast, stopPolling]);


  const handleScan = async () => {
    if (!selectedInterface) {
        toast({ variant: "destructive", title: "No Network Selected", description: "Please select a network to scan."});
        return;
    }

    setIsScanning(true);
    setDevices([]);
    setScanCount(0);
    setGpUpdateStatus({});

    try {
      if (pollingTimer.current) clearInterval(pollingTimer.current);
      pollingTimer.current = setInterval(pollScanStatus, POLLING_INTERVAL);
      
      const res = await fetch("/api/arp-scan", { 
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cidr: selectedInterface.cidr })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start scan.");
      }

    } catch (err: any) {
        toast({ variant: "destructive", title: "Scan Error", description: err.message });
        stopPolling();
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
    return () => {
      if (pollingTimer.current) {
        clearInterval(pollingTimer.current);
      }
    };
  }, []);

  const handleMassGpUpdate = async () => {
    if (devices.length === 0) {
      toast({ title: "No Devices", description: "There are no devices to update." });
      return;
    }

    setIsGpUpdating(true);
    toast({ title: "Starting Mass GpUpdate", description: `Updating ${devices.length} devices...` });

    // Reset statuses and set all to loading
    const initialStatus: Record<string, GpUpdateResult> = {};
    devices.forEach(d => {
      initialStatus[d.id] = { status: 'loading' };
    });
    setGpUpdateStatus(initialStatus);

    for (const device of devices) {
        try {
            const response = await fetch('/api/psexec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: device.ipAddress, cmd: "gpupdate /force" }),
            });

            // Check if the response is JSON, otherwise handle as text
            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                // If parsing fails, it's not JSON. Treat it as an error.
                setGpUpdateStatus(prev => ({
                    ...prev,
                    [device.id]: {
                        status: 'error',
                        output: responseText // Show the raw non-JSON response
                    }
                }));
                continue; // Move to the next device
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
    toast({ title: "Mass GpUpdate Complete", description: "Finished updating all devices." });
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


  const renderContent = () => {
    if (networkError) {
        return (
             <Alert variant="destructive" className="h-80 flex flex-col items-center justify-center text-center">
                <WifiOff className="h-12 w-12" />
                <AlertTitle className="mt-4 text-lg">Failed to Load Network Interfaces</AlertTitle>
                <AlertDescription className="mt-2">
                    {networkError}
                    <br/>
                    Please ensure the backend is running and the user has appropriate permissions.
                </AlertDescription>
            </Alert>
        )
    }

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
          <Wifi className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No devices found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a network and click "Discover Devices" to scan.
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
              className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 flex flex-col"
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
                    <p className="text-xs text-muted-foreground">
                      {device.status === 'online' ? 'Online' : `Offline - ${device.lastSeen}`}
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
                ? `Scanning ${selectedInterface?.cidr}... Found ${scanCount} device(s) so far.`
                : `Discovered ${devices.length} devices on your network.`
            }
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-11 min-w-[250px] justify-between" disabled={interfaces.length === 0 || isScanning || isGpUpdating}>
                        <div className="flex items-center gap-2">
                           <Network className="h-4 w-4" />
                           {selectedInterface ? (
                               <span>{selectedInterface.name} ({selectedInterface.cidr})</span>
                           ) : (
                               <span>{networkError ? "No networks found" : "Select a Network"}</span>
                           )}
                        </div>
                        <ChevronDown className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[300px]">
                    {interfaces.map(iface => (
                        <DropdownMenuItem key={iface.id} onClick={() => setSelectedInterface(iface)}>
                            {iface.name} ({iface.cidr})
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {isScanning ? (
                <Button onClick={handleCancelScan} variant="destructive" size="lg" className="h-11">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancel Scan
                </Button>
            ) : (
                <Button onClick={handleScan} disabled={isScanning || isGpUpdating || !selectedInterface} size="lg" className="h-11">
                    <Wifi className="mr-2 h-4 w-4" />
                    Discover Devices
                </Button>
            )}

            <Button onClick={handleMassGpUpdate} disabled={isScanning || isGpUpdating || devices.length === 0} size="lg" className="h-11">
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
