

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
import { useDeviceContext } from "@/hooks/use-device-context";


export default function MonitoringPage() {
  const { 
    devices, 
    isLoading, 
    error,
    fetchAllDevices, 
    fetchLiveData,
    isUpdating,
  } = useDeviceContext();
  const { toast } = useToast();
  const router = useRouter();
  
  const [deploymentState, setDeploymentState] = React.useState<{isOpen: boolean, device: Device | null}>({isOpen: false, device: null});
  const [isDeploying, setIsDeploying] = React.useState(false);
  const [deploymentLog, setDeploymentLog] = React.useState("");
  
  React.useEffect(() => {
    if (devices.length === 0 && !isLoading) {
      fetchAllDevices();
    }
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
            toast({ title: "Update Successful", description: `Statics script has been run on ${deploymentState.device.name}.`});
            // Immediately fetch the new status for this device
            fetchLiveData(deploymentState.device);
        } else {
             toast({ variant: "destructive", title: "Update Failed", description: data.error || "An unknown error occurred."});
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

  if (error && devices.length === 0) {
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
                <Button onClick={() => fetchAllDevices()} disabled={isLoading || isUpdating}>
                    {isLoading || isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
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
                            <TableHead>Last Status Update</TableHead>
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
                                      {device.agentLastUpdate && (
                                        <p className="text-xs text-muted-foreground mt-1">{`Last update: ${new Date(device.agentLastUpdate).toLocaleTimeString()}`}</p>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                     <Button variant="outline" size="sm" className="mr-2" onClick={() => { setDeploymentLog(""); setDeploymentState({isOpen: true, device}); }} disabled={device.status !== 'online'}>
                                        <RefreshCw className="mr-2 h-4 w-4" /> Update Statics
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
                <AlertDialogTitle>Update Statics for {deploymentState.device?.name}</AlertDialogTitle>
                <AlertDialogDescription>
                    This will run the script on the target device to create/update the performance data file and ensure the scheduled task is running correctly.
                </AlertDialogDescription>
            </AlertDialogHeader>
            
            {isDeploying || deploymentLog ? (
                <div className="my-4">
                    <Label htmlFor="deploy-log">Execution Log</Label>
                    <Textarea id="deploy-log" readOnly value={deploymentLog} className="mt-2 h-60 font-mono text-xs bg-muted" />
                </div>
            ) : (
                 <Alert className="my-4">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Ready to Update</AlertTitle>
                    <AlertDescription>
                        Click &quot;Run Now&quot; to begin the remote execution.
                    </AlertDescription>
                </Alert>
            )}

            <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeployAgent} disabled={isDeploying}>
                    {isDeploying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Run Now
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    </>
  );
}
