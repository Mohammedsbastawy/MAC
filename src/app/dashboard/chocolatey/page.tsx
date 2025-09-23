
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeviceContext } from "@/hooks/use-device-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  Terminal,
  CheckCircle2,
  XCircle,
  DownloadCloud,
  ChevronRight,
  ServerCrash
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import type { Device } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type TargetDevice = Device & { isSelected: boolean };
type TaskStatus = "pending" | "running" | "success" | "error";
type TaskResult = {
  deviceName: string;
  status: TaskStatus;
  log: string;
};

export default function ChocolateyPage() {
  const { devices, isLoading: isLoadingDevices, error: devicesError } = useDeviceContext();
  const { toast } = useToast();
  const [targetDevices, setTargetDevices] = React.useState<TargetDevice[]>([]);
  const [packageName, setPackageName] = React.useState("");
  const [taskResults, setTaskResults] = React.useState<TaskResult[]>([]);
  const [isTaskRunning, setIsTaskRunning] = React.useState(false);

  React.useEffect(() => {
    setTargetDevices(devices.map(d => ({ ...d, isSelected: d.status === 'online' })));
  }, [devices]);

  const handleSelectDevice = (deviceId: string) => {
    setTargetDevices(prev =>
      prev.map(d => (d.id === deviceId ? { ...d, isSelected: !d.isSelected } : d))
    );
  };
  
  const handleSelectAll = (select: boolean) => {
      setTargetDevices(prev => prev.map(d => ({...d, isSelected: select})));
  }

  const runTaskManager = async (endpoint: string, params: Record<string, any>, initialMessage: string) => {
    const selectedDevices = targetDevices.filter(d => d.isSelected);
    if (selectedDevices.length === 0) {
      toast({ variant: "destructive", title: "No devices selected" });
      return;
    }
    
    setIsTaskRunning(true);
    setTaskResults(selectedDevices.map(d => ({ deviceName: d.name, status: "pending", log: "" })));
    toast({ title: "Task Started", description: initialMessage });

    const devicePromises = selectedDevices.map(device => 
        new Promise<void>(async (resolve) => {
            setTaskResults(prev => prev.map(r => r.deviceName === device.name ? { ...r, status: 'running' } : r));
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...params, targets: [device.ipAddress] })
                });
                const data = await res.json();
                
                setTaskResults(prev => prev.map(r => r.deviceName === device.name ? { 
                    ...r, 
                    status: data.ok ? "success" : "error",
                    log: data.stdout || data.stderr || data.error || "No output."
                } : r));

            } catch (err: any) {
                 setTaskResults(prev => prev.map(r => r.deviceName === device.name ? { 
                    ...r, 
                    status: 'error',
                    log: err.message || "A client-side error occurred."
                } : r));
            } finally {
                resolve();
            }
        })
    );

    await Promise.all(devicePromises);
    setIsTaskRunning(false);
    toast({ title: "Task Finished", description: "All operations have completed." });
  }

  const handleInstallChoco = () => {
    runTaskManager(
        "/api/pstools/install-chocolatey",
        {},
        "Installing Chocolatey on selected devices..."
    )
  }

  const handlePackageAction = (action: "install" | "upgrade" | "uninstall") => {
    if (!packageName) {
      toast({ variant: "destructive", title: "Package name required" });
      return;
    }
    runTaskManager(
        "/api/pstools/manage-package",
        { package_name: packageName, action: action },
        `Running choco ${action} ${packageName}...`
    )
  };


  if (isLoadingDevices) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="ml-2">Loading Devices...</p>
      </div>
    );
  }
  
   if (devicesError) {
    return (
        <div className="flex items-center justify-center h-full">
            <Alert variant="destructive" className="max-w-lg">
                <ServerCrash className="h-4 w-4" />
                <AlertTitle>{devicesError.title}</AlertTitle>
                <AlertDescription>{devicesError.message}</AlertDescription>
            </Alert>
        </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">Software Management</h1>
        <p className="text-muted-foreground">
          Deploy, upgrade, and uninstall software on remote machines using Chocolatey.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>1. Select Target Devices</CardTitle>
                    <CardDescription>Choose which online devices to manage.</CardDescription>
                </CardHeader>
                <CardContent className="h-96 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    <Checkbox 
                                        checked={targetDevices.every(d => d.isSelected) && targetDevices.length > 0}
                                        onCheckedChange={(checked) => handleSelectAll(checked === true)}
                                    />
                                </TableHead>
                                <TableHead>Device Name</TableHead>
                                <TableHead>IP Address</TableHead>
                                <TableHead>OS</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {targetDevices.filter(d => d.status === 'online').map(device => (
                                <TableRow key={device.id} onClick={() => handleSelectDevice(device.id)} className="cursor-pointer">
                                    <TableCell><Checkbox checked={device.isSelected} /></TableCell>
                                    <TableCell>{device.name}</TableCell>
                                    <TableCell>{device.ipAddress}</TableCell>
                                    <TableCell>{device.os}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                     <CardTitle>2. Execute Actions</CardTitle>
                     <CardDescription>First-time setup or manage packages on selected devices.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <DownloadCloud className="h-4 w-4" />
                        <AlertTitle>First-Time Setup</AlertTitle>
                        <AlertDescription>
                            If Chocolatey is not installed on the target machines, run this command first.
                            <Button size="sm" className="ml-4" onClick={handleInstallChoco} disabled={isTaskRunning}>
                                {isTaskRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Install Chocolatey
                            </Button>
                        </AlertDescription>
                    </Alert>
                    
                    <Separator />

                     <div className="space-y-2">
                        <Label htmlFor="package-name">Chocolatey Package Name</Label>
                        <Input 
                            id="package-name" 
                            placeholder="e.g., 7zip, vlc, git"
                            value={packageName}
                            onChange={(e) => setPackageName(e.target.value)}
                            disabled={isTaskRunning}
                        />
                    </div>
                     <div className="flex flex-wrap gap-2">
                        <Button onClick={() => handlePackageAction('install')} disabled={isTaskRunning || !packageName}>Install</Button>
                        <Button onClick={() => handlePackageAction('upgrade')} variant="outline" disabled={isTaskRunning || !packageName}>Upgrade</Button>
                        <Button onClick={() => handlePackageAction('uninstall')} variant="destructive" disabled={isTaskRunning || !packageName}>Uninstall</Button>
                    </div>

                </CardContent>
            </Card>
        </div>

        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle>3. Live Task Results</CardTitle>
                 <CardDescription>Real-time output from the remote machines.</CardDescription>
            </CardHeader>
            <CardContent className="h-[calc(100%-4rem-1.5rem)]">
                <div className="h-full rounded-md border bg-muted p-4 space-y-3 overflow-y-auto">
                    {taskResults.length === 0 && !isTaskRunning && (
                         <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                            <Terminal className="h-10 w-10 mb-2" />
                            <p>Results will appear here.</p>
                        </div>
                    )}
                    {taskResults.map((result, index) => (
                        <div key={index}>
                             <details>
                                <summary className="flex items-center gap-2 cursor-pointer">
                                     {result.status === "pending" && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {result.status === "running" && <ChevronRight className="h-4 w-4 text-yellow-500 animate-pulse" />}
                                    {result.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                    {result.status === "error" && <XCircle className="h-4 w-4 text-red-500" />}
                                    <span className="font-medium">{result.deviceName}</span>
                                    <Badge variant={
                                        result.status === 'success' ? 'default' :
                                        result.status === 'error' ? 'destructive' :
                                        'secondary'
                                    } className={result.status === 'success' ? 'bg-green-600' : ''}>
                                        {result.status}
                                    </Badge>
                                </summary>
                                <pre className="mt-2 text-xs p-2 bg-background rounded-md overflow-x-auto">
                                    <code>{result.log || "No output..."}</code>
                                </pre>
                            </details>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
