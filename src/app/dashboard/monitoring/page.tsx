"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  ServerCrash,
  NotebookText,
  Siren,
  ChevronRight,
  Wifi,
  WifiOff,
  Search
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { SnmpTrap, ADComputer } from "@/lib/types";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type DeviceSnmpStatus = ADComputer & {
  snmpStatus: 'active' | 'inactive';
  lastTrap?: SnmpTrap;
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
                     <Button variant="secondary" className="w-full" onClick={() => router.push('/dashboard/devices')}>
                        Configure SNMP
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
  const [deviceStatuses, setDeviceStatuses] = React.useState<DeviceSnmpStatus[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeDeviceTraps, setActiveDeviceTraps] = React.useState<{ deviceId: string; traps: SnmpTrap[] } | null>(null);
  const [allTraps, setAllTraps] = React.useState<SnmpTrap[]>([]);
  const router = useRouter();

  const fetchData = React.useCallback(async () => {
    try {
      const [trapsRes, computersRes] = await Promise.all([
        fetch("/api/network/get-snmp-traps"),
        fetch("/api/ad/get-computers", { method: 'POST' }),
      ]);

      const trapsData = await trapsRes.json();
      const computersData = await computersRes.json();

      if (!trapsData.ok) throw new Error(trapsData.error || "Failed to fetch SNMP traps.");
      if (!computersData.ok) throw new Error(computersData.error || "Failed to fetch AD computers.");
      
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
          lastTrap: activeDeviceIPs.get(comp.dns_hostname)
      }));

      setDeviceStatuses(statuses);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
         <Button onClick={() => router.push('/dashboard/devices')} size="lg">
            Configure Devices
            <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
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
