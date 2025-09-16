
"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  ServerCrash,
  Siren,
  ChevronRight,
  Wifi,
  WifiOff,
  Search,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { SnmpTrap, ADComputer, Device, NetworkInterface, SnmpLogEntry } from "@/lib/types";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

type DeviceSnmpStatus = ADComputer & {
  snmpStatus: 'active' | 'inactive';
  lastTrap?: SnmpTrap;
  status: 'online' | 'offline' | 'unknown';
};

const DeviceStatusCard: React.FC<{ device: DeviceSnmpStatus, onShowDeviceTraps: (deviceId: string) => void }> = ({ device, onShowDeviceTraps }) => {
    const router = useRouter();
    const isInactive = device.snmpStatus === 'inactive';
    
    return (
        <Card className={cn("flex flex-col", isInactive && "bg-muted/50")}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{device.name}</CardTitle>
                    {isInactive ? (
                        <WifiOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                        <Wifi className="h-5 w-5 text-green-500" />
                    )}
                </div>
                <CardDescription className="font-mono">{device.dns_hostname}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow text-sm text-muted-foreground">
                 {isInactive ? (
                    <p>No SNMP traps received from this device.</p>
                ) : (
                    <div>
                        <p className="font-medium text-foreground">Last Event:</p>
                        <p className="truncate">{device.lastTrap?.variables.find(v => v.oid.includes('snmpTrapOID.0'))?.value.split('::').pop() || 'Unknown'}</p>
                        <p className="text-xs">{new Date(device.lastTrap!.timestamp).toLocaleString()}</p>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 {isInactive ? (
                     <Button variant="secondary" className="w-full" disabled>
                        Configure in Monitoring
                        <ChevronRight className="ml-2 h-4 w-4" />
                     </Button>
                ) : (
                     <Button variant="outline" className="w-full" onClick={() => onShowDeviceTraps(device.dns_hostname)}>
                        View All Traps
                     </Button>
                )}
            </CardFooter>
        </Card>
    );
};

export default function MonitoringPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deviceStatuses, setDeviceStatuses] = React.useState<DeviceSnmpStatus[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeDeviceTraps, setActiveDeviceTraps] = React.useState<{ deviceId: string; traps: SnmpTrap[] } | null>(null);
  const [allTraps, setAllTraps] = React.useState<SnmpTrap[]>([]);
  const router = useRouter();

  // State for SNMP configuration dialog
  const [isSnmpDialogOpen, setIsSnmpDialogOpen] = React.useState(false);
  const [selectedDevicesForSnmp, setSelectedDevicesForSnmp] = React.useState<Set<string>>(new Set());
  const [snmpConfigProgress, setSnmpConfigProgress] = React.useState(0);
  const [isSnmpConfiguring, setIsSnmpConfiguring] = React.useState(false);
  const [snmpLogs, setSnmpLogs] = React.useState<SnmpLogEntry[]>([]);
  const [interfaces, setInterfaces] = React.useState<NetworkInterface[]>([]);

  const allDevices = React.useMemo(() => deviceStatuses.map(d => ({
      id: d.dn,
      name: d.name,
      ipAddress: d.dns_hostname,
      status: d.status,
      // Add other required Device fields if necessary
  } as Device)), [deviceStatuses]);


  const fetchData = React.useCallback(async () => {
    // Prevent re-fetching during configuration
    if (isSnmpConfiguring) return;

    try {
      const [trapsRes, computersRes, interfacesRes] = await Promise.all([
        fetch("/api/network/get-snmp-traps"),
        fetch("/api/ad/get-computers", { method: 'POST' }),
        fetch("/api/network-interfaces", { method: 'POST' }),
      ]);

      const trapsData = await trapsRes.json();
      const computersData = await computersRes.json();
      const interfacesData = await interfacesRes.json();

      if (!trapsData.ok) throw new Error(trapsData.error || "Failed to fetch SNMP traps.");
      if (!computersData.ok) throw new Error(computersData.error || "Failed to fetch AD computers.");
      if (interfacesData.ok) {
          setInterfaces(interfacesData.interfaces);
      }
      
      setAllTraps(trapsData.traps);

      const activeDeviceIPs = new Map<string, SnmpTrap>();
      for (const trap of trapsData.traps) {
          if (!activeDeviceIPs.has(trap.source)) {
              activeDeviceIPs.set(trap.source, trap);
          }
      }
      
      const statuses: DeviceSnmpStatus[] = computersData.computers.map((comp: ADComputer) => ({
          ...comp,
          snmpStatus: activeDeviceIPs.has(comp.dns_hostname) ? 'active' : 'inactive',
          lastTrap: activeDeviceIPs.get(comp.dns_hostname),
          status: 'unknown', // Will be updated by status check
      }));
      
      setDeviceStatuses(statuses);

      // Fetch online status after getting the devices
      const ipsToCheck = statuses.map(d => d.dns_hostname).filter(Boolean);
      if (ipsToCheck.length > 0) {
        const statusRes = await fetch("/api/network/check-status", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ips: ipsToCheck })
        });
        const statusData = await statusRes.json();
        if (statusData.ok) {
            const onlineIps = new Set<string>(statusData.online_ips);
            setDeviceStatuses(prev => prev.map(d => ({
                ...d,
                status: onlineIps.has(d.dns_hostname) ? 'online' : 'offline'
            })));
        }
      }

    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [isSnmpConfiguring]);

  React.useEffect(() => {
    if (user) {
      fetchData();
      const intervalId = setInterval(fetchData, 10000); // Poll every 10 seconds
      return () => clearInterval(intervalId);
    } else {
      setIsLoading(false);
    }
  }, [user, fetchData]);

  const showDeviceTraps = (deviceId: string) => {
      const trapsForDevice = allTraps.filter(t => t.source === deviceId);
      setActiveDeviceTraps({ deviceId, traps: trapsForDevice });
  }

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
      fetchData(); // Force a refresh of the main page data
  };


  const filteredDevices = deviceStatuses
    .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.dns_hostname.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
        if (a.snmpStatus === 'active' && b.snmpStatus === 'inactive') return -1;
        if (a.snmpStatus === 'inactive' && b.snmpStatus === 'active') return 1;
        return a.name.localeCompare(b.name);
    });

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Alert variant="destructive" className="max-w-lg">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please sign in to view the monitoring dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">
            Device Monitoring Status
          </h1>
          <p className="text-muted-foreground">
            Overview of devices configured to send SNMP data.
          </p>
        </div>
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
                                disabled={device.status === 'offline'}
                            />
                            <div className="flex-1">
                                <Label htmlFor={`device-${device.id}`} className={cn("font-medium", device.status === 'offline' && "text-muted-foreground")}>{device.name}</Label>
                                <p className="text-xs text-muted-foreground">{device.ipAddress}</p>
                            </div>
                            <Badge variant={device.status === 'online' ? 'default' : 'secondary'} className={cn(device.status === 'online' && 'bg-green-600', device.status === 'offline' && 'bg-destructive')}>
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
                        <Button onClick={() => { setSnmpLogs([]); setSelectedDevicesForSnmp(new Set()); }}>
                            Configure More
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>

       <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Siren />
                        Device Status
                    </CardTitle>
                    <CardDescription>
                        Found {deviceStatuses.length} devices in Active Directory.
                    </CardDescription>
                </div>
                <div className="relative w-full sm:w-auto sm:max-w-xs">
                     <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Filter by name or IP..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent>
           {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <ServerCrash className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : filteredDevices.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDevices.map(device => (
                    <DeviceStatusCard key={device.dn} device={device} onShowDeviceTraps={showDeviceTraps} />
                ))}
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-64">
                <Search className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                    No Devices Found
                </h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-md">
                    Your search for "{searchTerm}" did not match any devices.
                </p>
            </div>
          )}
        </CardContent>
       </Card>
    </div>

    <Dialog open={!!activeDeviceTraps} onOpenChange={() => setActiveDeviceTraps(null)}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Traps from {activeDeviceTraps?.deviceId}</DialogTitle>
                <DialogDescription>
                    Showing all received traps from this device.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto p-1">
                {activeDeviceTraps?.traps.map((trap, index) => (
                    <div key={index} className="mb-4">
                        <div className="flex justify-between items-center">
                            <p className="font-semibold">{trap.variables.find(v => v.oid.includes('snmpTrapOID.0'))?.value.split('::').pop() || 'Generic Trap'}</p>
                            <p className="text-xs text-muted-foreground">{new Date(trap.timestamp).toLocaleString()}</p>
                        </div>
                        <Separator className="my-2" />
                        <div className="grid grid-cols-[1fr_3fr] gap-x-4 gap-y-2 text-xs font-mono bg-muted p-3 rounded-md">
                            {trap.variables.map((variable, vIndex) => (
                            <React.Fragment key={vIndex}>
                                <div className="text-muted-foreground truncate" title={variable.oid}>{variable.oid.split('::').pop()}</div>
                                <div className="break-all">{variable.value}</div>
                            </React.Fragment>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}
