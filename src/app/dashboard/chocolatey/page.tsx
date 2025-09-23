
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
  Clock,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogTrigger } from "@/components/ui/alert-dialog";


type TargetDevice = Device & { isSelected: boolean };
type TaskStatus = "pending" | "running" | "success" | "error";

type TaskExecution = {
  device: Device;
  status: TaskStatus;
  log: string;
  startTime: number | null;
  endTime: number | null;
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
    { name: 'Silent Mode', arg: '/S' },
    { name: 'Silent (Alt)', arg: '/SILENT' },
    { name: 'Quiet Mode', arg: '/q' },
    { name: 'Quiet (No UI)', arg: '/qn' },
    { name: 'No Restart', arg: '/norestart' },
];

const TaskTimer: React.FC<{ startTime: number | null, endTime: number | null, status: TaskStatus }> = ({ startTime, endTime, status }) => {
    const [elapsedTime, setElapsedTime] = React.useState(0);

    React.useEffect(() => {
        if (status !== 'running' || !startTime) {
            if (startTime && endTime) {
                setElapsedTime(endTime - startTime);
            }
            return;
        }

        const timer = setInterval(() => {
            setElapsedTime(Date.now() - startTime);
        }, 1000);

        return () => clearInterval(timer);
    }, [status, startTime, endTime]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatTime(elapsedTime)}</span>
        </div>
    );
};


const TaskDetailsModal: React.FC<{ task: TaskExecution | null, onClose: () => void }> = ({ task, onClose }) => {
    if (!task) return null;

    return (
        <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl">Task Details: {task.device.name}</DialogTitle>
                    <DialogDescription>
                        <div className="flex items-center gap-4 mt-2">
                             <Badge variant={
                                task.status === 'success' ? 'default' :
                                task.status === 'error' ? 'destructive' :
                                'secondary'
                            } className={task.status === 'success' ? 'bg-green-600' : ''}>
                                {task.status === "running" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {task.status}
                            </Badge>
                            <TaskTimer startTime={task.startTime} endTime={task.endTime} status={task.status} />
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-hidden">
                    <Textarea
                        readOnly
                        value={task.log || "Waiting for output..."}
                        className="w-full h-full font-mono text-xs resize-none"
                    />
                </div>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const ResultsTable: React.FC<{ executions: TaskExecution[], onSelectTask: (task: TaskExecution) => void }> = ({ executions, onSelectTask }) => {
    if (executions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-40">
              <Terminal className="h-10 w-10 mb-2 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">No Tasks Running</h3>
              <p className="mt-2 text-sm text-muted-foreground">Run a task to see its results here.</p>
            </div>
        );
    }
    
    return (
         <Card>
            <CardHeader>
                <CardTitle>Task Executions</CardTitle>
                <CardDescription>Click on a task to view its detailed log.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Device Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Elapsed Time</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {executions.map((task) => (
                            <TableRow key={task.device.id} onClick={() => onSelectTask(task)} className="cursor-pointer">
                                <TableCell className="font-medium">{task.device.name}</TableCell>
                                <TableCell>
                                    <Badge variant={
                                        task.status === 'success' ? 'default' :
                                        task.status === 'error' ? 'destructive' :
                                        'secondary'
                                    } className={task.status === 'success' ? 'bg-green-600' : ''}>
                                        {task.status === "running" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {task.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <TaskTimer startTime={task.startTime} endTime={task.endTime} status={task.status} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


export default function ChocolateyPage() {
  const { devices, isLoading: isLoadingDevices, error: devicesError } = useDeviceContext();
  const { toast } = useToast();
  const [targetDevices, setTargetDevices] = React.useState<TargetDevice[]>([]);
  const [packageName, setPackageName] = React.useState("");
  const [taskExecutions, setTaskExecutions] = React.useState<TaskExecution[]>([]);
  const [isTaskRunning, setIsTaskRunning] = React.useState(false);
  const [viewingTask, setViewingTask] = React.useState<TaskExecution | null>(null);
  
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
    setTaskExecutions(selectedDevices.map(d => ({ device: d, status: "pending", log: "", startTime: null, endTime: null })));
    toast({ title: "Task Started", description: initialMessage });

    const devicePromises = selectedDevices.map(device => 
        new Promise<void>(async (resolve) => {
            setTaskExecutions(prev => prev.map(r => r.device.id === device.id ? { ...r, status: 'running', startTime: Date.now() } : r));
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(getBody(device))
                });
                const data = await res.json();
                
                setTaskExecutions(prev => prev.map(r => r.device.id === device.id ? { 
                    ...r, 
                    status: data.ok ? "success" : "error",
                    log: data.stdout || data.stderr || data.error || data.details || "No output.",
                    endTime: Date.now()
                } : r));

            } catch (err: any) {
                 setTaskExecutions(prev => prev.map(r => r.device.id === device.id ? { 
                    ...r, 
                    status: 'error',
                    log: err.message || "A client-side error occurred.",
                    endTime: Date.now()
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
    
    const fileContentB64 = await fileToBase64(exeFile);
    
    runTaskManager(
        "/api/pstools/install-from-exe",
        {},
        `Deploying and installing ${exeFile.name}...`,
        (device) => ({
            targets: [device.ipAddress],
            fileName: exeFile.name,
            fileContent: fileContentB64,
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
    <>
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">Software Management</h1>
        <p className="text-muted-foreground">
          Deploy, upgrade, and uninstall software on remote machines using Chocolatey or direct executable deployment.
        </p>
      </div>

        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>1. Select Target Devices</CardTitle>
                    <CardDescription>Choose which online devices to manage. Only online devices are shown.</CardDescription>
                </CardHeader>
                <CardContent className="h-80 overflow-y-auto">
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
                                <TableRow key={device.id} onClick={() => handleSelectDevice(device.id)} className="cursor-pointer" data-state={device.isSelected && 'selected'}>
                                    <TableCell><Checkbox checked={device.isSelected} /></TableCell>
                                    <TableCell>{device.name}</TableCell>
                                    <TableCell>{device.ipAddress}</TableCell>
                                    <TableCell>{device.os}</TableCell>
                                </TableRow>
                            ))}
                             {targetDevices.filter(d => d.status === 'online').length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">No online devices available.</TableCell>
                                </TableRow>
                             )}
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
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isTaskRunning || !packageName}>Uninstall</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This will attempt to uninstall the package "{packageName}" from all selected devices. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handlePackageAction('uninstall')} className="bg-destructive hover:bg-destructive/80">Yes, Uninstall</AlertDialogAction>
                                </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
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
                                            {item.name}
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
             
             <ResultsTable executions={taskExecutions} onSelectTask={setViewingTask} />
        </div>
    </div>
    <TaskDetailsModal task={viewingTask} onClose={() => setViewingTask(null)} />
    </>
  );
}
