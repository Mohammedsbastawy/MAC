

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
  Wrench,
  Check,
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";


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
    id: adComputer.dn, // Use the guaranteed unique Distinguished Name
    name: adComputer.name,
    ipAddress: adComputer.dns_hostname,
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

type SnmpLogEntry = {
    deviceId: string;
    deviceName: string;
    log: string;
    status: 'pending' | 'success' | 'error';
}

export default function DeviceList({ onSelectDevice }: DeviceListProps) {
  const [isAdLoading, setIsAdLoading] = React.useState(true);
  const [isScanLoading, setIsScanLoading] = React.useState(false);
  const [domainDevices, setDomainDevices] = React.useState<Device[]>([]);
  const [workgroupDevices, setWorkgroupDevices] = React.useState<Device[]>([]);
  const { toast } = useToast();
  
  const [interfaces, setInterfaces] = React.useState<NetworkInterface[]>([]);
  const [selectedCidr, setSelectedCidr] = React.useState<string | undefined>();
  const [networkError, setNetworkError] = React.useState<string | null>(null);
  const [scanError, setScanError] = React.useState<ScanErrorState | null>(null);
  const [errorDialog, setErrorDialog] = React.useState<{isOpen: boolean, title: string, content: string}>({ isOpen: false, title: '', content: '' });

  // State for SNMP configuration dialog
  const [isSnmpDialogOpen, setIsSnmpDialogOpen] = React.useState(false);
  const [selectedDevicesForSnmp, setSelectedDevicesForSnmp] = React.useState<Set<string>>(new Set());
  const [snmpConfigProgress, setSnmpConfigProgress] = React.useState(0);
  const [isSnmpConfiguring, setIsSnmpConfiguring] = React.useState(false);
  const [snmpLogs, setSnmpLogs] = React.useState<SnmpLogEntry[]>([]);


  // Fetch initial data (AD computers and network interfaces) on mount
  React.useEffect(() => {
    const fetchInitialData = async () => {
        setIsAdLoading(true);
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

        setIsAdLoading(false);
    };
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefreshStatus = async () => {
      const allDevices = [...domainDevices, ...workgroupDevices];
      const ipsToCheck = allDevices.map(d => d.ipAddress).filter(Boolean);

      if (ipsToCheck.length === 0) {
          toast({ title: "No devices to check" });
          return;
      }

      toast({ title: "Refreshing Status...", description: `Checking ${ipsToCheck.length} devices.` });

      const updateDeviceLists = (updateFn: (d: Device) => Partial<Device>) => {
          setDomainDevices(prev => prev.map(d => ({ ...d, ...updateFn(d) })));
          setWorkgroupDevices(prev => prev.map(d => ({ ...d, ...updateFn(d) })));
      };

      // Set all devices to loading
      updateDeviceLists(() => ({ isLoadingDetails: true, status: 'unknown' }));

      let onlineIps = new Set<string>();

      try {
          // --- Phase 1: Ping Scan ---
          const pingRes = await fetch("/api/network/check-status-ping", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ips: ipsToCheck })
          });
          
          let pingData;
          try {
              pingData = await pingRes.json();
          } catch (e) {
              const resClone = pingRes.clone();
              try {
                const textError = await resClone.text();
                throw new Error(`Received an invalid response from the server during ping scan. Details: ${textError}`);
              } catch {
                throw new Error("Received an invalid and unreadable response from the server during ping scan.");
              }
          }
          if (!pingData.ok) throw new Error(pingData.error || "Ping scan failed on the server.");
          onlineIps = new Set<string>(pingData.online_ips);
          
          const ipsForPortScan = ipsToCheck.filter(ip => !onlineIps.has(ip));
          toast({ title: "Ping Scan Complete", description: `Found ${onlineIps.size} devices. Now checking ${ipsForPortScan.length} more.` });

          updateDeviceLists(d => {
              const isOnline = onlineIps.has(d.ipAddress) || onlineIps.has(d.name);
              return {
                  status: isOnline ? 'online' : 'unknown',
                  isLoadingDetails: !isOnline
              };
          });

          // --- Phase 2: Port Scan ---
          if (ipsForPortScan.length > 0) {
              const portScanRes = await fetch("/api/network/check-status-ports", {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ips: ipsForPortScan })
              });
              
              let portScanData;
              try {
                  portScanData = await portScanRes.json();
              } catch(e) {
                 const resClone = portScanRes.clone();
                 try {
                    const textError = await resClone.text();
                    throw new Error(`Received an invalid response from the server during Port scan. Details: ${textError}`);
                 } catch {
                    throw new Error("Received an invalid and unreadable response from the server during Port scan.");
                 }
              }
              
              if (!portScanData.ok) throw new Error(portScanData.error || "Port scan failed on the server.");
              
              portScanData.online_ips.forEach((ip: string) => onlineIps.add(ip));
              toast({ title: "Status Refresh Complete", description: `Total online: ${onlineIps.size}.` });
          } else {
              toast({ title: "Status Refresh Complete", description: "All responsive devices found by ping." });
          }

      } catch (err: any) {
          toast({ variant: "destructive", title: "Error Refreshing Status", description: err.message });
      } finally {
          updateDeviceLists(d => ({
              status: (onlineIps.has(d.ipAddress) || onlineIps.has(d.name)) ? 'online' : 'offline',
              isLoadingDetails: false
          }));
      }
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

        const domainIps = new Set(domainDevices.map(d => d.ipAddress).filter(Boolean));
        const domainNames = new Set(domainDevices.map(d => d.name.toLowerCase()));

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

  const handleToggleSelectDevice = (deviceId: string) => {
      setSelectedDevicesForSnmp(prev => {
          const newSet = new Set(prev);
          if (newSet.has(deviceId)) {
              newSet.delete(deviceId);
          } else {
              newSet.add(deviceId);
          }
          return newSet;
      });
  };

  const handleSelectAllDevices = () => {
    if (selectedDevicesForSnmp.size === allDevices.length) {
        setSelectedDevicesForSnmp(new Set());
    } else {
        setSelectedDevicesForSnmp(new Set(allDevices.map(d => d.id)));
    }
  };

  const handleConfigureSnmp = async () => {
      if (selectedDevicesForSnmp.size === 0) {
          toast({ variant: "destructive", title: "No Devices Selected", description: "Please select at least one device to configure." });
          return;
      }
      
      const devicesToConfigure = allDevices.filter(d => selectedDevicesForSnmp.has(d.id));
      
      setSnmpLogs(devicesToConfigure.map(d => ({
          deviceId: d.id,
          deviceName: d.name,
          log: "Queued...",
          status: 'pending'
      })));
      setIsSnmpConfiguring(true);
      setSnmpConfigProgress(0);
      
      toast({ title: "Starting SNMP Configuration", description: `Configuring ${devicesToConfigure.length} devices...` });

      let successfulCount = 0;
      let failedCount = 0;

      for (let i = 0; i < devicesToConfigure.length; i++) {
          const device = devicesToConfigure[i];
          
          setSnmpLogs(prev => prev.map(log => log.deviceId === device.id ? { ...log, log: "Configuring...", status: 'pending' } : log));

          try {
              const res = await fetch('/api/pstools/enable-snmp', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ip: device.ipAddress, server_ip: interfaces[0]?.ip || '127.0.0.1' })
              });
              const data = await res.json();
              
              if (res.ok && data.ok) {
                  successfulCount++;
                   setSnmpLogs(prev => prev.map(log => log.deviceId === device.id ? { ...log, log: data.details || "Success", status: 'success' } : log));
              } else {
                  failedCount++;
                   setSnmpLogs(prev => prev.map(log => log.deviceId === device.id ? { ...log, log: data.details || data.error || "An unknown error occurred.", status: 'error' } : log));
              }
          } catch (e: any) {
              failedCount++;
              setSnmpLogs(prev => prev.map(log => log.deviceId === device.id ? { ...log, log: e.message, status: 'error' } : log));
          }
          setSnmpConfigProgress(((i + 1) / devicesToConfigure.length) * 100);
      }
      
      toast({
          title: "Configuration Complete",
          description: `Successfully configured ${successfulCount} devices. Failed to configure ${failedCount} devices.`
      });

      // Keep dialog open for review, but re-enable the button for another run
      setIsSnmpConfiguring(false);
  };

  const allDevices = [...domainDevices, ...workgroupDevices];
  const getUniqueKey = (device: Device) => device.id;

  const renderContent = () => {
    return (
      <div className="space-y-8">
        {allDevices.length > 0 ? (
           <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allDevices.map((device) => (
                  <DeviceCard key={getUniqueKey(device)} device={device} onSelect={() => onSelectDevice(device)} />
              ))}
          </div>
        ) : isAdLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-40" />
                ))}
            </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-40">
              <h3 className="text-lg font-semibold text-foreground">No devices found</h3>
              <p className="mt-2 text-sm text-muted-foreground">Scan the network to discover devices.</p>
          </div>
        )}

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
            { isScanLoading && (
                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-40" />
                    ))}
                </div>
            )}
            { scanError?.isError && (
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
            Browse domain-joined and newly discovered workgroup devices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
             <Button onClick={() => window.open('/dashboard/logs', '_blank')} variant="outline" size="lg" className="h-11">
                <NotebookText className="mr-2 h-4 w-4" />
                View Logs
            </Button>
            <Button onClick={handleRefreshStatus} disabled={isAdLoading || (domainDevices.length === 0 && workgroupDevices.length === 0)} size="lg" className="h-11">
                {(domainDevices.some(d => d.isLoadingDetails) || workgroupDevices.some(d => d.isLoadingDetails)) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh Online Status
            </Button>
             <Dialog open={isSnmpDialogOpen} onOpenChange={(isOpen) => {
                 if (!isOpen) {
                     // Reset state when closing the dialog
                     setIsSnmpDialogOpen(false);
                     setIsSnmpConfiguring(false);
                     setSnmpLogs([]);
                     setSnmpConfigProgress(0);
                 } else {
                     setIsSnmpDialogOpen(true);
                 }
             }}>
                <DialogTrigger asChild>
                    <Button size="lg" className="h-11" disabled={allDevices.length === 0}>
                        <Wrench className="mr-2 h-4 w-4" /> Configure SNMP
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Configure SNMP on Devices</DialogTitle>
                        <DialogDescription>
                            Select devices to configure them to send SNMP traps to this server. This requires the SNMP Service to be installed on the target machines.
                        </DialogDescription>
                    </DialogHeader>
                    {snmpLogs.length > 0 ? (
                         <div className="flex flex-col gap-4 py-4">
                            <Progress value={snmpConfigProgress} />
                            <ScrollArea className="h-96 w-full rounded-md border p-4 font-mono text-xs">
                                {snmpLogs.map(log => (
                                    <div key={log.deviceId} className="mb-4">
                                        <div className="font-bold flex items-center gap-2">
                                            {log.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin" />}
                                            {log.status === 'success' && <Check className="h-4 w-4 text-green-500" />}
                                            {log.status === 'error' && <Siren className="h-4 w-4 text-red-500" />}
                                            {log.deviceName}
                                        </div>
                                        <pre className={cn("whitespace-pre-wrap mt-1 pl-6", log.status === 'error' && 'text-red-500')}>{log.log}</pre>
                                    </div>
                                ))}
                            </ScrollArea>
                         </div>
                    ) : (
                    <>
                    <div className="flex items-center space-x-2 py-4">
                        <Checkbox id="select-all" onCheckedChange={handleSelectAllDevices} checked={selectedDevicesForSnmp.size === allDevices.length && allDevices.length > 0} />
                        <Label htmlFor="select-all" className="font-medium">
                            Select All ({selectedDevicesForSnmp.size} / {allDevices.length} selected)
                        </Label>
                    </div>
                    <ScrollArea className="h-[50vh] rounded-md border">
                        <div className="p-1">
                        {allDevices.map((device) => (
                            <div key={device.id} className="flex items-center p-3 border-b last:border-b-0">
                                <Checkbox 
                                    id={`device-${device.id}`}
                                    checked={selectedDevicesForSnmp.has(device.id)}
                                    onCheckedChange={() => handleToggleSelectDevice(device.id)}
                                    className="mr-3"
                                />
                                <div className="flex-1">
                                    <Label htmlFor={`device-${device.id}`} className="font-medium">{device.name}</Label>
                                    <p className="text-xs text-muted-foreground">{device.ipAddress}</p>
                                </div>
                                <Badge variant={device.status === 'online' ? 'default' : 'secondary'} className={cn(device.status === 'online' && 'bg-green-600')}>
                                    {device.status}
                                </Badge>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                    </>
                    )}
                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => setIsSnmpDialogOpen(false)} disabled={isSnmpConfiguring}>
                            {snmpLogs.length > 0 ? "Close" : "Cancel"}
                        </Button>
                        {snmpLogs.length === 0 && (
                            <Button onClick={handleConfigureSnmp} disabled={selectedDevicesForSnmp.size === 0}>
                                <Check className="mr-2 h-4 w-4" /> Configure {selectedDevicesForSnmp.size} Devices
                            </Button>
                        )}
                         {snmpLogs.length > 0 && !isSnmpConfiguring && (
                            <Button onClick={() => setSnmpLogs([])}>
                                Configure More
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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

