

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
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  ServerCrash,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";


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
    isAgentDeployed: false, // Will be checked later
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


export default function MonitoringPage() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const { toast } = useToast();
  const router = useRouter();
  const [error, setError] = React.useState<{title: string, message: string, details?:string} | null>(null);
  const [deploymentState, setDeploymentState] = React.useState<{isOpen: boolean, device: Device | null}>({isOpen: false, device: null});
  const [isDeploying, setIsDeploying] = React.useState(false);
  const [deploymentLog, setDeploymentLog] = React.useState("");
  
  const checkAgentStatus = React.useCallback(async (devicesToCheck: Device[]): Promise<Device[]> => {
      const agentChecks = devicesToCheck.map(async (device) => {
        // Only check agent status for online devices
        if (device.status !== 'online') {
            return device;
        }
        try {
            const res = await fetch("/api/pstools/psinfo", {
              method: "POST",
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ip: device.ipAddress, name: device.name })
            });
            const data = await res.json();
            return { ...device, isAgentDeployed: data.ok };
        } catch {
            return { ...device, isAgentDeployed: false };
        }
      });

      return await Promise.all(agentChecks);
  }, []);

  const checkOnlineStatus = React.useCallback(async (deviceList: Device[]): Promise<Device[]> => {
      const ipsToCheck = deviceList.map(d => d.ipAddress).filter(Boolean);
      if (ipsToCheck.length === 0) {
        return deviceList;
      };

      try {
          const res = await fetch("/api/network/check-status", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ips: ipsToCheck })
          });
          const data = await res.json();
          if (!data.ok) throw new Error(data.error || "Status check failed on the server.");
          
          const onlineIps = new Set<string>(data.online_ips);
          
          return deviceList.map(d => ({
              ...d,
              status: onlineIps.has(d.ipAddress) ? 'online' : 'offline',
          }));

      } catch (err: any) {
          toast({ variant: "destructive", title: "Error Refreshing Status", description: err.message });
           return deviceList.map(d => ({ ...d, status: 'unknown' }));
      }
  }, [toast]);

  const fetchAllDevices = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        // Step 1: Fetch AD Computers
        const response = await fetch("/api/ad/get-computers", { method: "POST" });
        const data = await response.json();
        if (!data.ok) {
            throw data;
        }
        const adDevices = data.computers.map(mapAdComputerToDevice);
        setDevices(adDevices.map(d => ({ ...d, isLoadingDetails: true })));

        // Step 2: Check online status for all of them
        const devicesWithStatus = await checkOnlineStatus(adDevices);

        // Step 3: Check agent status ONLY for the ones that are online
        const finalDevices = await checkAgentStatus(devicesWithStatus);
        
        // Step 4: Set final state once with all information
        setDevices(finalDevices.map(d => ({ ...d, isLoadingDetails: false })));

    } catch (err: any) {
        setError({
            title: err.error || "Server Error",
            message: err.message || "Failed to connect to the server to get devices.",
            details: err.details,
        });
        setDevices([]); // Clear devices on error
    } finally {
        setIsLoading(false);
    }
  }, [checkOnlineStatus, checkAgentStatus]);

  React.useEffect(() => {
    fetchAllDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeployAgent = async () => {
    if (!deploymentState.device) return;
    setIsDeploying(true);
    setDeploymentLog("Starting deployment...");

    try {
        const res = await fetch("/api/pstools/deploy-agent", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: deploymentState.device.ipAddress, name: deploymentState.device.name })
        });
        const data = await res.json();
        setDeploymentLog(prev => prev + `\n\n--- SERVER RESPONSE ---\n` + (data.details || data.stdout || JSON.stringify(data, null, 2)));
        if (data.ok) {
            toast({ title: "Deployment Successful", description: `Agent has been deployed to ${deploymentState.device.name}.`});
             setDevices(prev => prev.map(d => d.id === deploymentState.device!.id ? {...d, isAgentDeployed: true} : d));
        } else {
             toast({ variant: "destructive", title: "Deployment Failed", description: data.error || "An unknown error occurred."});
        }
    } catch (err: any) {
         setDeploymentLog(prev => prev + `\n\n--- CLIENT ERROR ---\n` + err.message);
         toast({ variant: "destructive", title: "Client Error", description: "Failed to send request to the server."});
    }

    setIsDeploying(false);
  }


  if (isLoading && devices.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-2">Loading Domain Computers...</p>
        </div>
      )
  }

  if (error) {
    return (
        <div className="flex items-center justify-center h-full">
            <Alert variant="destructive" className="max-w-lg">
                <ServerCrash className="h-4 w-4" />
                <AlertTitle>{error.title}</AlertTitle>
                <AlertDescription>
                    {error.message}
                    {error.details && (
                         <pre className="mt-2 text-xs bg-muted p-2 rounded-md">{error.details}</pre>
                    )}
                </AlertDescription>
            </Alert>
        </div>
    )
  }


  return (
    <>
    <div className="space-y-6">
       <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
                <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">Performance Monitoring</h1>
                <p className="text-muted-foreground">
                    Deploy agents and monitor the performance of your domain computers.
                </p>
            </div>
             <div className="flex items-center gap-2">
                <Button onClick={() => fetchAllDevices()} disabled={isLoading || devices.some(d => d.isLoadingDetails)}>
                    {isLoading || devices.some(d => d.isLoadingDetails) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh Status
                </Button>
            </div>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Monitored Devices</CardTitle>
                <CardDescription>List of all domain computers and their monitoring agent status.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Device Name</TableHead>
                            <TableHead>IP Address</TableHead>
                            <TableHead>Online Status</TableHead>
                            <TableHead>Agent Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {devices.length > 0 ? devices.map(device => (
                            <TableRow key={device.id}>
                                <TableCell className="font-medium">{device.name}</TableCell>
                                <TableCell className="font-mono text-xs">{device.ipAddress}</TableCell>
                                <TableCell>
                                    {device.isLoadingDetails ? (
                                        <div className="flex items-center text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...</div>
                                    ) : (
                                        <Badge variant={device.status === 'online' ? 'default' : 'secondary'} className={cn(device.status === 'online' && 'bg-green-600')}>
                                            {device.status === 'online' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                            {device.status}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                     <Badge variant={device.isAgentDeployed ? 'default' : 'destructive'} className={cn(device.isAgentDeployed && 'bg-blue-600')}>
                                        {device.isAgentDeployed ? "Deployed" : "Not Deployed"}
                                     </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                     <Button variant="outline" size="sm" className="mr-2" onClick={() => { setDeploymentLog(""); setDeploymentState({isOpen: true, device}); }} disabled={device.status !== 'online'}>
                                        <ShieldCheck className="mr-2 h-4 w-4" /> Deploy Agent
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/monitoring/${encodeURIComponent(device.id)}`)} disabled={!device.isAgentDeployed}>
                                        View Dashboard <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                             <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    No domain computers found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>

    <AlertDialog open={deploymentState.isOpen} onOpenChange={(open) => !open && setDeploymentState({isOpen: false, device: null})}>
        <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle>Deploy Monitoring Agent to {deploymentState.device?.name}</AlertDialogTitle>
                <AlertDialogDescription>
                    This will install a lightweight monitoring agent on the target device. The agent runs as a scheduled task every minute to collect performance data.
                </AlertDialogDescription>
            </AlertDialogHeader>
            
            {isDeploying || deploymentLog ? (
                <div className="my-4">
                    <Label htmlFor="deploy-log">Deployment Log</Label>
                    <Textarea id="deploy-log" readOnly value={deploymentLog} className="mt-2 h-60 font-mono text-xs bg-muted" />
                </div>
            ) : (
                 <Alert className="my-4">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Ready to Deploy</AlertTitle>
                    <AlertDescription>
                        Click &quot;Deploy Now&quot; to begin the remote installation. PsExec will be used to execute the deployment script.
                    </AlertDescription>
                </Alert>
            )}

            <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeployAgent} disabled={isDeploying}>
                    {isDeploying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Deploy Now
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    </>
  );
}


    

    




    