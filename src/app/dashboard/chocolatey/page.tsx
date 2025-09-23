
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
  ServerCrash,
  Upload,
  ToyBrick,
  FileUp,
  Package,
  List,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

type TargetDevice = Device & { isSelected: boolean };
type TaskStatus = "pending" | "running" | "success" | "error";
type TaskResult = {
  deviceName: string;
  status: TaskStatus;
  log: string;
};

const popularPackages = [
    { name: "7-Zip", id: "7zip" },
    { name: "Google Chrome", id: "googlechrome" },
    { name: "VLC Media Player", id: "vlc" },
    { name: "Notepad++", id: "notepadplusplus" },
    { name: "Git", id: "git" },
    { name: "Adobe Reader", id: "adobereader" },
    { name: "Greenshot", id: "greenshot" },
];

const silentInstallArgs = [
    { arg: '/S', description: 'Silent Mode' },
    { arg: '/SILENT', description: 'Silent (Alternative)' },
    { arg: '/q', description: 'Quiet Mode' },
    { arg: '/qn', description: 'Quiet (No UI)' },
    { arg: '/norestart', description: 'Prevent Restart' },
];

export default function ChocolateyPage() {
  const { devices, isLoading: isLoadingDevices, error: devicesError } = useDeviceContext();
  const { toast } = useToast();
  const [targetDevices, setTargetDevices] = React.useState<TargetDevice[]>([]);
  const [packageName, setPackageName] = React.useState("");
  const [taskResults, setTaskResults] = React.useState<TaskResult[]>([]);
  const [isTaskRunning, setIsTaskRunning] = React.useState(false);
  
  const [exeFile, setExeFile] = React.useState<File | null>(null);
  const [exeArguments, setExeArguments] = React.useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const runTaskManager = async (endpoint: string, params: Record<string, any>, initialMessage: string, getBody: (device: Device) => Record<string, any>) => {
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
                    body: JSON.stringify(getBody(device))
                });
                const data = await res.json();
                
                setTaskResults(prev => prev.map(r => r.deviceName === device.name ? { 
                    ...r, 
                    status: data.ok ? "success" : "error",
                    log: data.stdout || data.stderr || data.error || data.details || "No output."
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
        "Installing Chocolatey on selected devices...",
        (device) => ({ targets: [device.ipAddress] })
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
        `Running choco ${action} ${packageName}...`,
        (device) => ({ package_name: packageName, action: action, targets: [device.ipAddress] })
    )
  };

  const handleExeInstall = async () => {
    if (!exeFile) {
        toast({ variant: "destructive", title: "No .exe file selected" });
        return;
    }

    const fileToBase64 = (file: File): Promise<string> => 
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
            reader.onerror = error => reject(error);
        });
    
    const fileContent = await fileToBase64(exeFile);
    
    runTaskManager(
        "/api/pstools/install-from-exe",
        {},
        `Deploying and installing ${exeFile.name}...`,
        (device) => ({
            targets: [device.ipAddress],
            fileName: exeFile.name,
            fileContent: fileContent,
            arguments: exeArguments,
        })
    )
  }


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
          Deploy, upgrade, and uninstall software on remote machines using Chocolatey or direct executable deployment.
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
            
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ToyBrick /> Deploy with Chocolatey</CardTitle>
                         <CardDescription>First-time setup or manage packages by name.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <DownloadCloud className="h-4 w-4" />
                            <AlertTitle>First-Time Setup</AlertTitle>
                            <AlertDescription>
                                If Chocolatey is not installed, run this command first.
                                <Button size="sm" className="ml-4" onClick={handleInstallChoco} disabled={isTaskRunning}>
                                    {isTaskRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Install Chocolatey
                                </Button>
                            </AlertDescription>
                        </Alert>
                        
                        <Separator />

                         <div className="space-y-2">
                            <Label htmlFor="package-name">Package Name</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="package-name" 
                                    placeholder="e.g., 7zip, vlc, git"
                                    value={packageName}
                                    onChange={(e) => setPackageName(e.target.value)}
                                    disabled={isTaskRunning}
                                />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline"><List className="mr-2 h-4 w-4" /> Browse</Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuLabel>Popular Packages</DropdownMenuLabel>
                                        {popularPackages.map(pkg => (
                                            <DropdownMenuItem key={pkg.id} onSelect={() => setPackageName(pkg.id)}>
                                                {pkg.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                         <div className="flex flex-wrap gap-2">
                            <Button onClick={() => handlePackageAction('install')} disabled={isTaskRunning || !packageName}><Package className="mr-2 h-4 w-4" />Install</Button>
                            <Button onClick={() => handlePackageAction('upgrade')} variant="outline" disabled={isTaskRunning || !packageName}>Upgrade</Button>
                            <Button onClick={() => handlePackageAction('uninstall')} variant="destructive" disabled={isTaskRunning || !packageName}>Uninstall</Button>
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileUp /> Install from Executable</CardTitle>
                         <CardDescription>Upload and run a custom `.exe` installer.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Installer File (.exe)</Label>
                            <Input
                                ref={fileInputRef}
                                type="file"
                                accept=".exe"
                                onChange={(e) => setExeFile(e.target.files ? e.target.files[0] : null)}
                                disabled={isTaskRunning}
                                className="pt-2 h-auto"
                            />
                            {exeFile && <p className="text-xs text-muted-foreground">Selected: {exeFile.name}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="exe-args">Silent Install Arguments</Label>
                            <div className="flex flex-col gap-2">
                                <Input 
                                    id="exe-args" 
                                    placeholder="e.g. /S, /q, /quiet"
                                    value={exeArguments}
                                    onChange={(e) => setExeArguments(e.target.value)}
                                    disabled={isTaskRunning}
                                />
                                <div className="flex flex-wrap gap-2">
                                    {silentInstallArgs.map(item => (
                                        <Button key={item.arg} variant="outline" size="sm" onClick={() => setExeArguments(prev => `${prev} ${item.arg}`.trim())}>
                                            {item.description}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <Button className="w-full" onClick={handleExeInstall} disabled={isTaskRunning || !exeFile}>
                            <Upload className="mr-2 h-4 w-4" />
                            Deploy & Install EXE
                        </Button>
                    </CardContent>
                </Card>
             </div>
        </div>

        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle>Live Task Results</CardTitle>
                 <CardDescription>Real-time output from the remote machines.</CardDescription>
            </CardHeader>
            <CardContent className="h-[calc(100vh-4rem-1.5rem-12rem)]">
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
                                     {result.status === "pending" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                    {result.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
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
