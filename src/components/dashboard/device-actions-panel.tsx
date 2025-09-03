"use client";

import {
  Activity,
  ChevronRight,
  Laptop,
  Monitor,
  Power,
  RefreshCw,
  Router,
  Server,
  Smartphone,
  Terminal,
  ToyBrick,
  Users,
  Info,
  FileCode,
  KeyRound,
  Fingerprint,
  PowerOff,
  UserX,
  FileLock,
  PauseCircle,
  Network,
  HardDrive,
  Clock,
  Cpu,
  Hash,
  Hourglass,
  MemoryStick,
  Settings2,
  File,
  UserCheck
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Device } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "../ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";


type DeviceActionsPanelProps = {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
};

const ICONS: Record<Device["type"], React.ElementType> = {
  laptop: Laptop,
  server: Server,
  router: Router,
  mobile: Smartphone,
  desktop: Monitor,
  iot: ToyBrick,
  unknown: Laptop,
};

type PsInfoData = {
    system_info: { key: string, value: string }[];
    disk_info: {
        volume: string;
        type: string;
        size_gb: string;
        free_gb: string;
        free_percent: string;
    }[];
}

type PsListProcess = {
    name: string;
    pid: string;
    pri: string;
    thd: string;
    hnd: string;
    priv: string;
    cpu_time: string;
    elapsed_time: string;
}

type PsLoggedOnUser = {
    time: string;
    user: string;
};

type PsFileData = {
    id: string;
    user: string;
    locks: string;
    path: string;
};

type PsServiceData = {
    name: string;
    display_name: string;
    state: string;
    type: string;
}

type DialogState = {
    isOpen: boolean;
    title: string;
    description: string;
    output: string;
    error: string;
    structuredData?: {
        psinfo?: PsInfoData | null;
        pslist?: PsListProcess[] | null;
        psloggedon?: PsLoggedOnUser[] | null;
        psfile?: PsFileData[] | null;
        psservice?: PsServiceData[] | null;
    } | null;
}

const ActionButton: React.FC<{
    icon: React.ElementType,
    label: string,
    onClick: () => void,
    variant?: "outline" | "destructive"
}> = ({ icon: Icon, label, onClick, variant = "outline" }) => (
    <Button variant={variant} className="justify-start" onClick={onClick}>
        <Icon className="mr-2 h-4 w-4" />
        <span>{label}</span>
        <ChevronRight className="ml-auto h-4 w-4" />
    </Button>
)

const PsInfoResult: React.FC<{ data: PsInfoData }> = ({ data }) => (
    <div className="space-y-6">
        {data.system_info?.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                        <Laptop className="mr-2 h-5 w-5" /> System Information
                    </CardTitle>
                </CardHeader>
                <CardContent>
                     <div className="divide-y">
                        {data.system_info.map(info => (
                             <div key={info.key} className="flex justify-between py-2 text-sm">
                                <span className="text-muted-foreground">{info.key}</span>
                                <span className="font-medium text-right">{info.value}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )}
        {data.disk_info?.length > 0 && (
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                        <HardDrive className="mr-2 h-5 w-5" /> Disk Information
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Volume</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Size (GB)</TableHead>
                                <TableHead className="text-right">Free (GB)</TableHead>
                                <TableHead className="text-right">Free %</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.disk_info.map(disk => (
                                <TableRow key={disk.volume}>
                                    <TableCell className="font-medium">{disk.volume}</TableCell>
                                    <TableCell>{disk.type}</TableCell>
                                    <TableCell className="text-right">{disk.size_gb}</TableCell>
                                    <TableCell className="text-right">{disk.free_gb}</TableCell>
                                    <TableCell className="text-right">{disk.free_percent}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        )}
    </div>
)


const PsListResult: React.FC<{ data: PsListProcess[] }> = ({ data }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center text-lg">
                <Activity className="mr-2 h-5 w-5" /> Process List
            </CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>PID</TableHead>
                        <TableHead className="text-right">Threads</TableHead>
                        <TableHead className="text-right">Handles</TableHead>
                        <TableHead className="text-right">CPU Time</TableHead>
                        <TableHead className="text-right">Elapsed Time</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map(proc => (
                        <TableRow key={proc.pid}>
                            <TableCell className="font-medium">{proc.name}</TableCell>
                            <TableCell>{proc.pid}</TableCell>
                            <TableCell className="text-right">{proc.thd}</TableCell>
                            <TableCell className="text-right">{proc.hnd}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{proc.cpu_time}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{proc.elapsed_time}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
)

const PsLoggedOnResult: React.FC<{ data: PsLoggedOnUser[] }> = ({ data }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center text-lg">
                <UserCheck className="mr-2 h-5 w-5" /> Logged On Users
            </CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Logon Time</TableHead>
                        <TableHead>User</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((logon, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-mono text-xs">{logon.time}</TableCell>
                            <TableCell className="font-medium">{logon.user}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);

const PsFileResult: React.FC<{ data: PsFileData[] }> = ({ data }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center text-lg">
                <File className="mr-2 h-5 w-5" /> Opened Files
            </CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Locks</TableHead>
                        <TableHead>Path</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((file, index) => (
                        <TableRow key={index}>
                            <TableCell>{file.user}</TableCell>
                            <TableCell>{file.locks}</TableCell>
                            <TableCell className="font-mono text-xs">{file.path}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);

const PsServiceResult: React.FC<{ data: PsServiceData[] }> = ({ data }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center text-lg">
                <Settings2 className="mr-2 h-5 w-5" /> Services
            </CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Service Name</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Type</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((service) => (
                         <TableRow key={service.name}>
                             <TableCell className="font-mono text-xs">{service.name}</TableCell>
                             <TableCell className="font-medium">{service.display_name}</TableCell>
                             <TableCell>
                                 <Badge variant={service.state.includes('RUNNING') ? 'default' : 'secondary'}
                                     className={cn(service.state.includes('RUNNING') && "bg-green-600")}
                                 >
                                    {service.state}
                                 </Badge>
                             </TableCell>
                             <TableCell>{service.type}</TableCell>
                         </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);


const CommandOutputDialog: React.FC<{
    state: DialogState;
    onClose: () => void;
}> = ({ state, onClose }) => {
    
    const hasStructuredData = state.structuredData?.psinfo || state.structuredData?.pslist || state.structuredData?.psloggedon || state.structuredData?.psfile || state.structuredData?.psservice;

    return (
    <AlertDialog open={state.isOpen} onOpenChange={onClose}>
        <AlertDialogContent className="max-w-4xl">
            <AlertDialogHeader>
                <AlertDialogTitle>{state.title}</AlertDialogTitle>
                <AlertDialogDescription>{state.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                {state.structuredData?.psinfo && <PsInfoResult data={state.structuredData.psinfo} />}
                {state.structuredData?.pslist && <PsListResult data={state.structuredData.pslist} />}
                {state.structuredData?.psloggedon && <PsLoggedOnResult data={state.structuredData.psloggedon} />}
                {state.structuredData?.psfile && <PsFileResult data={state.structuredData.psfile} />}
                {state.structuredData?.psservice && <PsServiceResult data={state.structuredData.psservice} />}


                {(!hasStructuredData) && (
                    <>
                    {state.output && (
                        <div>
                            <Label>Output</Label>
                            <Textarea readOnly value={state.output} className="mt-1 h-64 font-mono text-xs bg-muted" />
                        </div>
                    )}
                    {state.error && (
                         <div>
                            <Label className="text-destructive">Error</Label>
                            <Textarea readOnly value={state.error} className="mt-1 h-32 font-mono text-xs bg-destructive/10 text-destructive" />
                        </div>
                    )}
                    </>
                )}
                 {/* Show raw output for psinfo even with structured data, for debugging */}
                {hasStructuredData && state.output && (
                    <details className="mt-4">
                        <summary className="text-xs text-muted-foreground cursor-pointer">Show Raw Output</summary>
                        <Textarea readOnly value={state.output} className="mt-1 h-48 font-mono text-xs bg-muted" />
                         {state.error && <Textarea readOnly value={state.error} className="mt-1 h-24 font-mono text-xs bg-destructive/10 text-destructive" />}
                    </details>
                )}
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={onClose}>Close</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
)}


export default function DeviceActionsPanel({
  device,
  isOpen,
  onClose,
}: DeviceActionsPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogState, setDialogState] = React.useState<DialogState>({
      isOpen: false,
      title: "",
      description: "",
      output: "",
      error: "",
      structuredData: null,
  });

  if (!device) return null;

  const Icon = ICONS[device.type] || Laptop;

  const handlePstoolAction = async (tool: string, extraParams: Record<string, any> = {}) => {
      if (!user || !device) return;

      toast({ title: "Sending Command...", description: `Running ${tool} on ${device.name}` });

      try {
          const response = await fetch(`/api/${tool}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  ip: device.ipAddress,
                  ...extraParams,
              }),
          });
          const result = await response.json();
          
          setDialogState({
            isOpen: true,
            title: `Result from: ${tool}`,
            description: `Command executed on ${device.name} (${device.ipAddress}).`,
            output: result.stdout,
            error: result.stderr,
            structuredData: result.structured_data || null,
          });

      } catch (err: any) {
        setDialogState({
            isOpen: true,
            title: "Connection Error",
            description: `Failed to connect to backend for tool: ${tool}.`,
            output: "",
            error: err.message || "An unknown network error occurred.",
            structuredData: null
          });
      }
  };


  return (
    <>
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-3 text-xl font-headline">
            <Icon className="h-6 w-6" />
            {device.name}
          </SheetTitle>
          <SheetDescription>
            {device.os}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 pb-6 space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Device Status</h4>
              <div className="flex items-center">
                <div className={cn(
                    "h-2.5 w-2.5 rounded-full mr-2",
                    device.status === 'online' ? "bg-green-500" : "bg-gray-400"
                )} />
                <p className="text-sm text-muted-foreground capitalize">
                  {device.status} {device.status === 'offline' && `(Last seen: ${device.lastSeen})`}
                </p>
              </div>
            </div>

            <Separator />
            
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Network Details</h4>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">IP Address</span>
                <span className="font-mono text-foreground">{device.ipAddress}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">MAC Address</span>
                <span className="font-mono text-foreground">{device.macAddress}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Actions</h4>
              <div className="grid grid-cols-1 gap-2">
                <ActionButton icon={Info} label="System Info" onClick={() => handlePstoolAction('psinfo')} />
                <ActionButton icon={Activity} label="Process List" onClick={() => handlePstoolAction('pslist')} />
                <ActionButton icon={Users} label="Logged On Users" onClick={() => handlePstoolAction('psloggedon')} />
                <ActionButton icon={Settings2} label="List Services" onClick={() => handlePstoolAction('psservice', { action: 'query' })} />
                <ActionButton icon={FileCode} label="Event Log (System)" onClick={() => handlePstoolAction('psloglist', { kind: 'system' })} />
                <ActionButton icon={FileLock} label="Opened Files" onClick={() => handlePstoolAction('psfile')} />
                <ActionButton icon={Fingerprint} label="Get SID" onClick={() => handlePstoolAction('psgetsid')} />
              </div>
            </div>

            <Separator />
            
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Power Management</h4>
                <div className="grid grid-cols-1 gap-2">
                    <ActionButton icon={RefreshCw} label="Restart" onClick={() => handlePstoolAction('psshutdown', { action: 'restart' })} />
                    <ActionButton icon={PowerOff} label="Shutdown" onClick={() => handlePstoolAction('psshutdown', { action: 'shutdown' })} variant="destructive" />
                    <ActionButton icon={UserX} label="Logoff User" onClick={() => handlePstoolAction('psshutdown', { action: 'logoff' })} variant="destructive" />
                </div>
            </div>

             <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Advanced Actions</h4>
                <div className="grid grid-cols-1 gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="justify-start">
                                <Terminal className="mr-2 h-4 w-4" />
                                <span>Execute Command</span>
                                <ChevronRight className="ml-auto h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const cmd = formData.get('command') as string;
                                (e.currentTarget.closest('[data-radix-popper-content-wrapper]')?.previousSibling as HTMLElement)?.click(); // close dialog first
                                handlePstoolAction('psexec', { cmd });
                            }}>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Execute Remote Command</AlertDialogTitle>
                                    <AlertDialogDescription>Enter a command to run on {device.name} via PsExec.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="my-4">
                                    <Input name="command" placeholder="e.g. ipconfig /all" />
                                </div>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction type="submit">Run Command</AlertDialogAction>
                                </AlertDialogFooter>
                            </form>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
    <CommandOutputDialog 
        state={dialogState}
        onClose={() => setDialogState(prev => ({...prev, isOpen: false}))}
    />
    </>
  );
}
