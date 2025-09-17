
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
  Users,
  Briefcase,
  Search,
  RefreshCw,
  NotebookText,
  Siren,
  FileText,
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
import type { Device, NetworkInterface, ADComputer } from "@/lib/types";
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
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import DeviceActionsPanel from "@/components/dashboard/device-actions-panel";
import { useDeviceContext } from "@/hooks/use-device-context";


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

type ScanErrorState = {
    isError: boolean;
    title: string;
    message: string;
    details?: string;
    errorCode?: 'MASSCAN_NOT_FOUND' | 'MASSCAN_FAILED';
}

const DeviceCard: React.FC<{ device: Device, onSelect: () => void }> = ({ device, onSelect }) => {
    const Icon = ICONS[device.type] || Laptop;

    return (
        <Card
            onClick={onSelect}
            className={cn("cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 flex flex-col",
             device.status === 'offline' && "opacity-60 hover:opacity-100",
             device.status === 'online' && "border-2 border-primary"
            )}
        >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{device.name}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1 flex-grow">
                <p className="text-sm text-muted-foreground">{device.ipAddress}</p>
                <div className="flex items-center pt-2">
                    <div className={cn(
                        "h-2.5 w-2.5 rounded-full mr-2",
                        device.status === 'online' ? "bg-green-500 animate-pulse" : 
                        device.status === 'offline' ? "bg-gray-400" :
                        "bg-yellow-400"
                    )} />
                    {device.isLoadingDetails ? (
                        <div className="flex items-center">
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Checking...</span>
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
};

const DeviceList: React.FC<DeviceListProps & { devices: Device[], isLoading: boolean }> = ({ onSelectDevice, devices, isLoading }) => {
    const getUniqueKey = (device: Device) => device.id;
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-40" />
                ))}
            </div>
        )
    }

     if (devices.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-40">
              <h3 className="text-lg font-semibold text-foreground">No devices found</h3>
              <p className="mt-2 text-sm text-muted-foreground">Scan the network to discover devices.</p>
          </div>
        )
    }

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {devices.map((device) => (
                  <DeviceCard key={getUniqueKey(device)} device={device} onSelect={() => onSelectDevice(device)} />
              ))}
        </div>
    )
}


export default function DevicesPage() {
  const { 
    devices, 
    isLoading: isAdLoading, 
    isUpdating,
    error,
    fetchAllDevices,
    refreshAllDeviceStatus 
  } = useDeviceContext();
  
  const { toast } = useToast();
  
  const [isScanLoading, setIsScanLoading] = React.useState(false);
  const [workgroupDevices, setWorkgroupDevices] = React.useState<Device[]>([]);
  const [interfaces, setInterfaces] = React.useState<NetworkInterface[]>([]);
  const [selectedCidr, setSelectedCidr] = React.useState<string | undefined>();
  const [networkError, setNetworkError] = React.useState<string | null>(null);
  const [scanError, setScanError] = React.useState<ScanErrorState | null>(null);
  const [errorDialog, setErrorDialog] = React.useState<{isOpen: boolean, title: string, content: string}>({ isOpen: false, title: '', content: '' });

  // State for side panel
  const [selectedDevice, setSelectedDevice] = React.useState<Device | null>(null);
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device);
    setIsPanelOpen(true);
  };
  
  const determineDeviceType = (hostname: string): Device["type"] => {
    if (!hostname) return 'unknown';
    const lowerHostname = hostname.toLowerCase();
    if (lowerHostname.includes("laptop")) return "laptop";
    if (lowerHostname.includes("server")) return "server";
    if (lowerHostname.includes("router") || lowerHostname.includes("gateway")) return "router";
    if (lowerHostname.includes("phone") || lowerHostname.includes("mobile")) return "mobile";
    if (lowerHostname.includes("desktop") || lowerHostname.includes("pc")) return "desktop";
    if (lowerHostname.includes("iot") || lowerHostname.includes("thermostat") || lowerHostname.includes("light")) return "iot";
    return "unknown";
};


  // Fetch initial data (AD computers and network interfaces) on mount
  React.useEffect(() => {
    const fetchInterfaceData = async () => {
        setNetworkError(null);
        try {
            const res = await fetch("/api/network-interfaces", { method: 'POST' });
            const data = await res.json();
            if(data.ok && data.interfaces.length > 0) {
                setInterfaces(data.interfaces);
                if (!selectedCidr) {
                    setSelectedCidr(data.interfaces[0].cidr);
                }
            } else {
                 setNetworkError(data.error || "Could not find any usable network interfaces.");
            }
        } catch (err) {
             setNetworkError("Failed to fetch network interfaces.");
        }
    };
    
    fetchInterfaceData();
    if (devices.length === 0) {
      fetchAllDevices();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefreshStatus = async () => {
      const allIps = [...devices, ...workgroupDevices].map(d => d.ipAddress).filter(Boolean);
      if (allIps.length === 0) {
          toast({ title: "No devices to check" });
          return;
      }
      await refreshAllDeviceStatus();
  };


  const handleDiscoverWorkgroup = async () => {
    if (!selectedCidr) {
        toast({ variant: "destructive", title: "No Network Selected", description: "Please select a network to scan."});
        return;
    }

    setIsScanLoading(true);
    setWorkgroupDevices([]);
    setScanError(null);
    toast({ title: "Scan Initiated", description: `Discovering workgroup devices on ${selectedCidr}...` });

    try {
        const res = await fetch("/api/discover-devices", { 
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cidr: selectedCidr })
        });
        
        const data = await res.json();

        if (!res.ok || !data.ok) {
            setScanError({
                isError: true,
                title: data.error || "Scan Error",
                message: data.message || `The scan failed due to an unexpected server error.`,
                details: data.details,
                errorCode: data.error_code
            });
            setIsScanLoading(false);
            return; 
        }
        
        const discoveredRaw = data.devices.map((d: any) => ({
            id: d.mac || d.ip,
            name: d.hostname === "Unknown" ? d.ip : d.hostname,
            ipAddress: d.ip,
            macAddress: d.mac || "-",
            status: 'online', // Masscan only finds online devices
            type: determineDeviceType(d.hostname),
            os: d.os || "Unknown OS",
            lastSeen: 'Now',
            domain: "WORKGROUP",
            isDomainMember: false,
            isLoadingDetails: false,
            source: 'scan',
        } as Device));

        const domainIps = new Set(devices.map(d => d.ipAddress).filter(Boolean));
        const domainNames = new Set(devices.map(d => d.name.toLowerCase()));

        const filteredWorkgroupDevices = discoveredRaw.filter((scannedDevice: Device) => {
            const isIpInDomain = domainIps.has(scannedDevice.ipAddress);
            const isNameInDomain = domainNames.has(scannedDevice.name.toLowerCase());
            return !isIpInDomain && !isNameInDomain;
        });

        toast({ title: "Workgroup Scan Complete", description: `Found ${filteredWorkgroupDevices.length} new non-domain devices.`});
        setWorkgroupDevices(filteredWorkgroupDevices);

    } catch (err: any) {
        setScanError({ isError: true, title: "Client Error", message: err.message || "An unknown client-side error occurred." });
    } finally {
      setIsScanLoading(false);
    }
  };

  const allDevices = [...devices, ...workgroupDevices];
  
  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">Network Devices</h1>
          <p className="text-muted-foreground">
            Browse domain-joined and newly discovered workgroup devices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
             <Button onClick={() => window.open('/dashboard/logs', '_blank')} variant="outline" size="lg" className="h-11">
                <NotebookText className="mr-2 h-4 w-4" />
                View Logs
            </Button>
            <Button onClick={handleRefreshStatus} disabled={isAdLoading || isUpdating || allDevices.length === 0} size="lg" className="h-11">
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh Online Status
            </Button>
        </div>
      </div>
      
        <div className="space-y-8">
            {error && <Alert variant="destructive">
                <Siren className="h-4 w-4" />
                <AlertTitle>{error.title}</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
            </Alert>}
            <DeviceList onSelectDevice={handleSelectDevice} devices={devices} isLoading={isAdLoading && devices.length === 0}/>

            <Separator />
            <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                        <CardTitle className="mb-1 text-xl flex items-center gap-2">
                            <Briefcase /> Discover Workgroup Devices
                        </CardTitle>
                        <CardDescription className="mb-4">
                            Use the network scanner to find devices that are not in the domain.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-4 md:mb-0">
                        <Select value={selectedCidr} onValueChange={setSelectedCidr} disabled={interfaces.length === 0 || isScanLoading}>
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
                        <Button onClick={handleDiscoverWorkgroup} disabled={isScanLoading || !selectedCidr} size="lg" className="h-11">
                            {isScanLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Scan Network
                        </Button>
                    </div>
                </div>
                 { isScanLoading ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-40" />
                        ))}
                    </div>
                ) : scanError?.isError ? (
                    <Alert variant="destructive" className="mt-4">
                        <Siren className="h-4 w-4" />
                        <AlertTitle>{scanError.title}</AlertTitle>
                        <AlertDescription>
                            {scanError.message}
                            {scanError.details && (
                                <Button variant="secondary" size="sm" className="mt-2" onClick={() => setErrorDialog({isOpen: true, title: "Error Log", content: scanError.details ?? "No details available."})}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Show Error Log
                                </Button>
                            )}
                        </AlertDescription>
                    </Alert>
                ) : (
                     <DeviceList onSelectDevice={handleSelectDevice} devices={workgroupDevices} isLoading={false} />
                )}
            </div>
        </div>
    </div>

    <DeviceActionsPanel 
        device={selectedDevice}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
    />

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
    </>
  );
}
