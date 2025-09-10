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
  HelpCircle,
  ShieldAlert,
  DownloadCloud,
  Siren,
  FileText,
  Search,
  RefreshCw
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
import { Badge } from "../ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import Link from "next/link";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";


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

const mapAdComputerToDevice = (adComputer: ADComputer): Device => ({
    id: adComputer.dns_hostname || adComputer.name,
    name: adComputer.name,
    ipAddress: adComputer.dns_hostname, // Primary identifier for status check
    macAddress: "-",
    status: 'unknown', // Initially unknown
    type: determineDeviceType(adComputer.name),
    os: adComputer.os,
    lastSeen: adComputer.last_logon,
    domain: adComputer.domain || "Domain",
    isDomainMember: true,
    isLoadingDetails: false,
    source: 'ad',
});

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


const DeviceCard: React.FC<{ device: Device, onSelect: () => void }> = ({ device, onSelect }) => {
    const Icon = ICONS[device.type] || Laptop;

    return (
        <Card
            onClick={onSelect}
            className={cn("cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 flex flex-col",
             device.status === 'offline' && "opacity-60 hover:opacity-100"
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


export default function DeviceList({ onSelectDevice }: DeviceListProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [domainDevices, setDomainDevices] = React.useState<Device[]>([]);
  const [workgroupDevices, setWorkgroupDevices] = React.useState<Device[]>([]);
  const { toast } = useToast();
  
  const [interfaces, setInterfaces] = React.useState<NetworkInterface[]>([]);
  const [selectedCidr, setSelectedCidr] = React.useState<string | undefined>();
  const [networkError, setNetworkError] = React.useState<string | null>(null);
  const [scanError, setScanError] = React.useState<ScanErrorState | null>(null);
  const [errorDialog, setErrorDialog] = React.useState<{isOpen: boolean, title: string, content: string}>({ isOpen: false, title: '', content: '' });

  // Fetch initial data (AD computers and network interfaces) on mount
  React.useEffect(() => {
    const fetchInitialData = async () => {
        setIsLoading(true);
        setNetworkError(null);
        setScanError(null);

        // Fetch network interfaces
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

        // Fetch AD Computers
        try {
            const response = await fetch("/api/ad/get-computers", { method: "POST" });
            const data = await response.json();
            if (data.ok) {
                const adDevices = data.computers.map(mapAdComputerToDevice);
                setDomainDevices(adDevices);
            } else {
                 setScanError({
                    isError: true,
                    title: data.error || "AD Error",
                    message: data.message || `Failed to fetch devices from Active Directory.`,
                    details: data.details,
                });
            }
        } catch (err) {
            setScanError({ isError: true, title: "Server Error", message: "Failed to connect to the server to get AD devices." });
        }

        setIsLoading(false);
    };
    fetchInitialData();
  }, []);

  const handleRefreshStatus = async () => {
      const allDevices = [...domainDevices, ...workgroupDevices];
      const ipsToCheck = allDevices.map(d => d.ipAddress).filter(Boolean);

      if (ipsToCheck.length === 0) {
          toast({ title: "No devices to check", description: "There are no devices with IP addresses to check." });
          return;
      }

      toast({ title: "Refreshing Status...", description: `Pinging ${ipsToCheck.length} devices.` });

      setDomainDevices(prev => prev.map(d => ({ ...d, isLoadingDetails: true })));
      setWorkgroupDevices(prev => prev.map(d => ({ ...d, isLoadingDetails: true })));

      try {
          const res = await fetch("/api/network/check-status", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ips: ipsToCheck })
          });
          const data = await res.json();

          if (!data.ok) {
              throw new Error(data.error || "Failed to check device status.");
          }
          
          const onlineIps = new Set(data.online_ips);

          setDomainDevices(prev => prev.map(d => ({ 
              ...d, 
              status: onlineIps.has(d.ipAddress) ? 'online' : 'offline',
              isLoadingDetails: false 
          })));

          setWorkgroupDevices(prev => prev.map(d => ({ 
              ...d, 
              status: onlineIps.has(d.ipAddress) ? 'online' : 'offline',
              isLoadingDetails: false
          })));

          toast({ title: "Status Refresh Complete", description: `Found ${onlineIps.size} devices online.` });

      } catch (err: any) {
          toast({ variant: "destructive", title: "Error Refreshing Status", description: err.message });
          // Reset loading state on error
          setDomainDevices(prev => prev.map(d => ({ ...d, isLoadingDetails: false })));
          setWorkgroupDevices(prev => prev.map(d => ({ ...d, isLoadingDetails: false })));
      }
  };


  const handleDiscoverWorkgroup = async () => {
    if (!selectedCidr) {
        toast({ variant: "destructive", title: "No Network Selected", description: "Please select a network to scan."});
        return;
    }

    setIsLoading(true);
    setWorkgroupDevices([]);
    setScanError(null);
    toast({ title: "Scan Initiated", description: `Discovering workgroup devices on ${selectedCidr}...` });

    try {
        const domainHostnames = new Set(domainDevices.map(d => d.name.toLowerCase()));

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
            setIsLoading(false);
            return; 
        }
        
        const discoveredButNotDomain = data.devices
            .filter((d: any) => !domainHostnames.has(d.hostname.toLowerCase()))
            .map((d: any) => ({
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

        toast({ title: "Workgroup Scan Complete", description: `Found ${discoveredButNotDomain.length} non-domain devices.`});
        setWorkgroupDevices(discoveredButNotDomain);
        setIsLoading(false);

    } catch (err: any) {
        setScanError({ isError: true, title: "Client Error", message: err.message || "An unknown client-side error occurred." });
        console.error(err);
        setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      );
    }

    if (scanError?.isError) {
         return (
             <Alert variant="destructive" className="h-80 flex flex-col items-center justify-center text-center">
                <Siren className="h-12 w-12" />
                <AlertTitle className="mt-4 text-lg">{scanError.title}</AlertTitle>
                <AlertDescription className="mt-2 max-w-md space-y-4">
                    <p>{scanError.message}</p>
                    {scanError.details && (
                        <Button onClick={() => setErrorDialog({isOpen: true, title: "Error Log", content: scanError.details ?? "No details available."})}>
                            <FileText className="mr-2 h-4 w-4" />
                            Show Error Log
                        </Button>
                    )}
                </AlertDescription>
            </Alert>
        )
    }

    const onlineDomainDevices = domainDevices.filter(d => d.status === 'online').length;
    const onlineWorkgroupDevices = workgroupDevices.filter(d => d.status === 'online').length;

    return (
      <div className="space-y-8">
        {/* Domain Devices Section */}
        <div>
            <CardTitle className="mb-1 text-xl flex items-center gap-2">
                <Users /> Domain Devices ({domainDevices.length} total / {onlineDomainDevices} online)
            </CardTitle>
            <CardDescription className="mb-4">
                Devices found in Active Directory. Click 'Refresh Online Status' to check which are online.
            </CardDescription>
            {domainDevices.length > 0 ? (
                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {domainDevices.map((device) => (
                        <DeviceCard key={device.id} device={device} onSelect={() => onSelectDevice(device)} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-40">
                    <h3 className="text-lg font-semibold text-foreground">No domain devices found</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Could not retrieve devices from Active Directory.</p>
                </div>
            )}
        </div>

        <Separator />

        {/* Workgroup Devices Section */}
        <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                     <CardTitle className="mb-1 text-xl flex items-center gap-2">
                        <Briefcase /> Discovered Workgroup Devices ({workgroupDevices.length} found)
                    </CardTitle>
                    <CardDescription className="mb-4">
                        Use the network scanner to find devices that are not in the domain.
                    </CardDescription>
                </div>
                 <div className="flex flex-wrap items-center gap-2 mb-4 md:mb-0">
                    <Select value={selectedCidr} onValueChange={setSelectedCidr} disabled={interfaces.length === 0 || isLoading}>
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
                    <Button onClick={handleDiscoverWorkgroup} disabled={isLoading || !selectedCidr} size="lg" className="h-11">
                        <Search className="mr-2 h-4 w-4" />
                        Discover Workgroup Devices
                    </Button>
                </div>
            </div>

            {workgroupDevices.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
                    {workgroupDevices.map((device) => (
                        <DeviceCard key={device.id} device={device} onSelect={() => onSelectDevice(device)} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-40 mt-4">
                     <Wifi className="mx-auto h-12 w-12 text-muted-foreground" />
                     <h3 className="mt-4 text-lg font-semibold text-foreground">No workgroup devices discovered</h3>
                     <p className="mt-2 text-sm text-muted-foreground">
                        Select a network and scan to find non-domain devices.
                     </p>
                </div>
            )}
        </div>

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
            Manage domain-joined and workgroup devices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleRefreshStatus} disabled={isLoading || (domainDevices.length === 0 && workgroupDevices.length === 0)} size="lg" className="h-11">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh Online Status
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
    </>
  );
}
