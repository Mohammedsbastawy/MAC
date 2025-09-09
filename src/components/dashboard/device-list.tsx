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
  HelpCircle,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "../ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";


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

type GpUpdateStatus = 'idle' | 'loading' | 'success' | 'error';
type GpUpdateResult = {
    status: GpUpdateStatus;
    output?: string;
};

export default function DeviceList({ onSelectDevice }: DeviceListProps) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [isGpUpdating, setIsGpUpdating] = React.useState(false);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const { toast } = useToast();
  
  const [interfaces, setInterfaces] = React.useState<NetworkInterface[]>([]);
  const [selectedCidr, setSelectedCidr] = React.useState<string | undefined>();
  const [networkError, setNetworkError] = React.useState<string | null>(null);

  const [gpUpdateStatus, setGpUpdateStatus] = React.useState<Record<string, GpUpdateResult>>({});
  const [errorDialog, setErrorDialog] = React.useState<{isOpen: boolean, content: string}>({ isOpen: false, content: '' });


  React.useEffect(() => {
    const fetchInterfaces = async () => {
        try {
            // Don't set scanning true here, it's just a background fetch
            setNetworkError(null);
            const res = await fetch("/api/network-interfaces", { method: 'POST' });
            const data = await res.json();
            if(data.ok && data.interfaces.length > 0) {
                setInterfaces(data.interfaces);
                // Automatically select the first interface
                if (!selectedCidr) {
                    setSelectedCidr(data.interfaces[0].cidr);
                }
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
  }, [toast, selectedCidr]);


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


  const fetchDeviceDetails = React.useCallback(async (ip: string) => {
    try {
        const res = await fetch('/api/device-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip }),
        });
        
        const details = await res.json().catch(() => ({ok: false, os: `Non-JSON response`}));
        
        setDevices(prev => 
            prev.map(d => 
                d.ipAddress === ip 
                ? { ...d, 
                    isLoadingDetails: false, 
                    os: details.os || 'Fetch failed', 
                    domain: details.domain, 
                    isDomainMember: details.isDomainMember 
                  } 
                : d
            )
        );
    } catch (e) {
        console.error(`Error fetching details for ${ip}:`, e);
         setDevices(prev => 
            prev.map(d => 
                d.ipAddress === ip 
                ? { ...d, isLoadingDetails: false, os: "Error fetching details" } 
                : d
            )
        );
    }
  }, []);

  const handleScan = async () => {
    if (!selectedCidr) {
        toast({ variant: "destructive", title: "No Network Selected", description: "Please select a network to scan."});
        return;
    }

    setIsScanning(true);
    setDevices([]);
    setGpUpdateStatus({});
    toast({ title: "Scan Initiated", description: `Performing scan on ${selectedCidr}...`});

    try {
      const res = await fetch("/api/discover-devices", { 
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cidr: selectedCidr })
      });
      
      if (!res.ok) {
        // IMPORTANT: Only read the body ONCE.
        const responseBody = await res.text();
        let errorMsg = `Scan failed with status: ${res.status}`;
        try {
            // Try to parse it as JSON
            const errorData = JSON.parse(responseBody);
            errorMsg = errorData.error || errorMsg;
        } catch (e) {
             // If parsing fails, use the raw text
             errorMsg = responseBody || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();

      const initialDevices: Device[] = data.devices.map((d: any) => ({
          id: d.ip,
          name: d.hostname === "Unknown" ? d.ip : d.hostname,
          ipAddress: d.ip,
          macAddress: d.mac || "-",
          status: 'online',
          type: determineDeviceType(d.hostname),
          os: "Loading...",
          lastSeen: 'Now',
          domain: "Loading...",
          isDomainMember: false,
          isLoadingDetails: true,
      }));
      
      if (initialDevices.length === 0) {
        toast({ title: "Scan Complete", description: "No online devices were found on this network."});
      } else {
        toast({ title: "Discovery Complete", description: `Found ${initialDevices.length} devices. Now fetching details...`});
      }
      
      setDevices(initialDevices);

      // Now, fetch details for each device.
      initialDevices.forEach(device => {
        fetchDeviceDetails(device.ipAddress);
      });

    } catch (err: any) {
        toast({ variant: "destructive", title: "Scan Error", description: err.message });
        console.error(err);
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
    toast({ title: "Starting Mass GpUpdate", description: `Updating ${onlineDevices.length} devices...` });

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

            const result = await response.json();
            
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
      const gpStatus = gpUpdateStatus[device.id]?.status;

      switch(gpStatus) {
          case 'loading':
              return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
          case 'success':
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>GPUpdate successful!</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
          case 'error':
              return (
                 <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-auto w-auto text-red-500 hover:text-red-500" onClick={(e) => {
                              e.stopPropagation();
                              setErrorDialog({ isOpen: true, content: gpUpdateStatus[device.id]?.output || "No error details available." });
                          }}>
                            <HelpCircle className="h-5 w-5" />
                          </Button>
                    </TooltipTrigger>
                     <TooltipContent>
                        <p>GPUpdate Failed. Click for details.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
          default:
              const Icon = ICONS[device.type] || Laptop;
              return <Icon className="h-5 w-5 text-muted-foreground" />;
      }
  }


  const renderContent = () => {
    if (networkError && interfaces.length === 0) {
        return (
             <Alert variant="destructive" className="h-80 flex flex-col items-center justify-center text-center">
                <WifiOff className="h-12 w-12" />
                <AlertTitle className="mt-4 text-lg">Failed to Load Network Interfaces</AlertTitle>
                <AlertDescription className="mt-2">
                    {networkError}
                    <br/>
                    Please ensure the backend is running and has the necessary permissions.
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
            Select a network and click "Discover Devices" to begin scanning.
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
                     {device.isLoadingDetails ? (
                        <div className="flex items-center">
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Loading details...</span>
                        </div>
                     ) : (
                        <p className="text-xs text-muted-foreground truncate" title={device.os}>
                            {device.os}
                        </p>
                    )}
                </div>
              </CardContent>
              <CardFooter>
                {device.isLoadingDetails ? <Skeleton className="h-5 w-24" /> : (
                    device.isDomainMember ? (
                        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                            <Users className="mr-1 h-3 w-3" />
                            Domain Member
                        </Badge>
                    ) : (
                        <Badge variant="secondary">
                            <Briefcase className="mr-1 h-3 w-3" />
                            Workgroup
                        </Badge>
                    )
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
                ? `Scanning ${selectedCidr}...`
                : `Discovered ${devices.length} online devices.`
            }
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
             <Select value={selectedCidr} onValueChange={setSelectedCidr} disabled={interfaces.length === 0 || isScanning || isGpUpdating}>
                <SelectTrigger className="h-11 min-w-[250px] justify-between">
                    <div className="flex items-center gap-2">
                        <Network className="h-4 w-4" />
                        <SelectValue placeholder={networkError ? "No networks found" : "Select a Network"} />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    {interfaces.map(iface => (
                        <SelectItem key={iface.id} value={iface.cidr}>
                             {iface.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button onClick={handleScan} disabled={isScanning || isGpUpdating || !selectedCidr} size="lg" className="h-11">
                {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
                Discover Devices
            </Button>
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
                    The `gpupdate /force` command failed. Here is the output from the remote machine. Common issues include firewall blocks or incorrect permissions.
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

    