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
  ShieldAlert,
  DownloadCloud,
  Siren,
  FileText,
  Search,
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import Link from "next/link";
import { Input } from "../ui/input";


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

type ScanErrorState = {
    isError: boolean;
    title: string;
    message: string;
    details?: string;
    errorCode?: 'MASSCAN_NOT_FOUND' | 'MASSCAN_FAILED';
}

export default function DeviceList({ onSelectDevice }: DeviceListProps) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [isGpUpdating, setIsGpUpdating] = React.useState(false);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const { toast } = useToast();
  
  const [interfaces, setInterfaces] = React.useState<NetworkInterface[]>([]);
  const [selectedCidr, setSelectedCidr] = React.useState<string | undefined>();
  const [networkError, setNetworkError] = React.useState<string | null>(null);
  const [scanError, setScanError] = React.useState<ScanErrorState | null>(null);

  const [gpUpdateStatus, setGpUpdateStatus] = React.useState<Record<string, GpUpdateResult>>({});
  const [errorDialog, setErrorDialog] = React.useState<{isOpen: boolean, title: string, content: string}>({ isOpen: false, title: '', content: '' });
  const [macPrompt, setMacPrompt] = React.useState<{isOpen: boolean, details: string}>({isOpen: false, details: ''});


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


  const handleScan = async (manualRouterMac: string | null = null) => {
    if (!selectedCidr) {
        toast({ variant: "destructive", title: "No Network Selected", description: "Please select a network to scan."});
        return;
    }

    setIsScanning(true);
    setDevices([]);
    setGpUpdateStatus({});
    setScanError(null);
    toast({ title: "Scan Initiated", description: `Discovering devices and querying AD on ${selectedCidr}...` });

    try {
        let router_mac = manualRouterMac;

        // Step 1: Try to get router MAC automatically if not provided manually
        if (!router_mac) {
             const macRes = await fetch("/api/get-router-mac", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cidr: selectedCidr })
             });
             const macData = await macRes.json();
             if (macData.ok && macData.mac) {
                router_mac = macData.mac;
                toast({ title: "Router Detected", description: `Using router MAC: ${router_mac}`});
             }
        }

        const res = await fetch("/api/discover-devices", { 
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cidr: selectedCidr, router_mac: router_mac })
        });
        
        const data = await res.json();

        if (!res.ok || !data.ok) {
            // If the scan failed with a specific MASSCAN_FAILED error, prompt for MAC
            if (data.error_code === 'MASSCAN_FAILED') {
                setMacPrompt({isOpen: true, details: data.details || "The scan failed. Please provide the router MAC address."});
                setIsScanning(false); // Stop the loading spinner
                return;
            }

            setScanError({
                isError: true,
                title: data.error || "Scan Error",
                message: data.message || `The scan failed due to an unexpected server error.`,
                details: data.details,
                errorCode: data.error_code
            });
            toast({ variant: "destructive", title: data.error || "Scan Failed", description: data.message });
            setIsScanning(false);
            return; 
        }

        const discoveredDevices: Device[] = data.devices.map((d: any) => ({
            id: d.mac || d.ip, // Use MAC address as ID if available, else IP
            name: d.hostname === "Unknown" ? d.ip : d.hostname,
            ipAddress: d.ip,
            macAddress: d.mac || "-",
            status: 'online',
            type: determineDeviceType(d.hostname),
            os: d.os || "Unknown OS",
            lastSeen: 'Now',
            domain: d.domain || "WORKGROUP",
            isDomainMember: d.isDomainMember || false,
            isLoadingDetails: false, // Details are now loaded in one go
        }));
        
        if (discoveredDevices.length === 0) {
            toast({ title: "Scan Complete", description: "No online devices were found on this network."});
        } else {
            toast({ title: "Discovery Complete", description: `Found and categorized ${discoveredDevices.length} devices.`});
        }
        
        setDevices(discoveredDevices);
        setIsScanning(false);


    } catch (err: any) {
        const errorMessage = err.message || "An unknown client-side error occurred.";
        setScanError({ isError: true, title: "Client Error", message: errorMessage });
        toast({ variant: "destructive", title: "Scan Error", description: errorMessage });
        console.error(err);
        setIsScanning(false);
    }
  };

  const handleDeviceSelect = (device: Device) => {
    onSelectDevice(device);
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
                              setErrorDialog({ isOpen: true, title: "GPUpdate Execution Failed", content: gpUpdateStatus[device.id]?.output || "No error details available." });
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

    if (scanError?.isError) {
         return (
             <Alert variant="destructive" className="h-80 flex flex-col items-center justify-center text-center">
                <Siren className="h-12 w-12" />
                <AlertTitle className="mt-4 text-lg">{scanError.title}</AlertTitle>
                <AlertDescription className="mt-2 max-w-md space-y-4">
                    <p>{scanError.message}</p>
                    <div className="flex justify-center items-center gap-4">
                        {scanError.errorCode === 'MASSCAN_NOT_FOUND' && (
                             <>
                                <Button asChild>
                                <a href="https://github.com/robertdavidgraham/masscan/releases" target="_blank" rel="noopener noreferrer">
                                    <DownloadCloud className="mr-2 h-4 w-4" />
                                    Download Masscan
                                </a>
                                </Button>
                                <Button asChild variant="secondary">
                                    <Link href="/dashboard/help">View Instructions</Link>
                                </Button>
                             </>
                        )}
                        {scanError.errorCode === 'MASSCAN_FAILED' && (
                            <>
                                <Button asChild variant="secondary">
                                    <Link href="/dashboard/help">Troubleshooting Guide</Link>
                                </Button>
                                {scanError.details && (
                                    <Button onClick={() => setErrorDialog({isOpen: true, title: "Masscan Error Log", content: scanError.details ?? "No details available."})}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Show Error Log
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
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
            Select a network and click "Discover Devices" to begin the Masscan.
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
              onClick={() => handleDeviceSelect(device)}
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
                {device.isDomainMember ? (
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                        <Users className="mr-1 h-3 w-3" />
                        Domain Member
                    </Badge>
                ) : (
                    <Badge variant="secondary">
                         <Briefcase className="mr-1 h-3 w-3" />
                        {device.domain}
                    </Badge>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  };
  
  const handleManualMacSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const mac = formData.get('mac') as string;
    setMacPrompt({isOpen: false, details: ''});
    handleScan(mac);
  }

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
            <Button onClick={() => handleScan()} disabled={isScanning || isGpUpdating || !selectedCidr} size="lg" className="h-11">
                {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
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

    <AlertDialog open={errorDialog.isOpen} onOpenChange={(open) => !open && setErrorDialog({isOpen: false, title:'', content:''})}>
        <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle>{errorDialog.title}</AlertDialogTitle>
                <AlertDialogDescription>
                    This is the raw error output. This information can help diagnose issues with permissions, firewalls, or application setup.
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
                <AlertDialogCancel onClick={() => setErrorDialog({isOpen: false, title:'', content:''})}>Close</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
     <AlertDialog open={macPrompt.isOpen} onOpenChange={(open) => !open && setMacPrompt({isOpen: false, details: ''})}>
        <form onSubmit={handleManualMacSubmit}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Router MAC Address Required</AlertDialogTitle>
                    <AlertDialogDescription>
                        Masscan failed to automatically resolve the router. Please provide the router's MAC address to continue.
                        <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted p-2 rounded-md">{macPrompt.details}</p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-4">
                    <Label htmlFor="mac-input">Router MAC</Label>
                    <Input
                        id="mac-input"
                        name="mac"
                        placeholder="e.g., 00:1A:2B:3C:4D:5E"
                        required
                        className="mt-1 font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                        You can find this on the router's label or by running `arp -a` in your command prompt and finding the entry for your router's IP.
                    </p>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel type="button" onClick={() => setMacPrompt({isOpen: false, details: ''})}>Cancel</AlertDialogCancel>
                    <AlertDialogAction type="submit">Scan Again</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </form>
    </AlertDialog>
    </>
  );
}
