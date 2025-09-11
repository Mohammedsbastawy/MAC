

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
  UserCheck,
  ArrowUpDown,
  PlayCircle,
  StopCircle,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  InfoIcon,
  Skull,
  Search,
  Zap,
  Folder,
  ChevronLeft,
  Home,
  Database,
  Lightbulb,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";


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
    description: string;
}

type PsLogListData = {
    record_num: string;
    source: string;
    time: string;
    type: string;
    id: string;
    computer: string;
    user: string;
    message: string;
};

// Type for a single file/folder item from PsBrowse
type PsBrowseItem = {
    Name: string;
    FullName: string;
    Length: number | null;
    LastWriteTime: string;
    Mode: string; // e.g., 'd-----', 'a----'
};


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
        psloglist?: PsLogListData[] | null;
        psbrowse?: PsBrowseItem[] | null;
    } | null;
}

type WinRMCheckResult = {
    serviceRunning: boolean;
    listenerConfigured: boolean;
    firewallOpen: boolean;
}

type WinRMStatus = {
    overallStatus: 'checking' | 'enabled' | 'disabled' | 'error';
    checks?: WinRMCheckResult;
    errorDetails?: string;
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


const PsListResult: React.FC<{ data: PsListProcess[], onKill: (processId: string) => void }> = ({ data, onKill }) => {
    const [searchTerm, setSearchTerm] = React.useState('');
    type SortKey = keyof PsListProcess;
    const [sortKey, setSortKey] = React.useState<SortKey>('name');
    const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };
    
    const filteredData = React.useMemo(() => {
        return data.filter(proc => proc.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [data, searchTerm]);

    const sortedData = React.useMemo(() => {
        return [...filteredData].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            // Handle numeric sorting for relevant fields
            if (['pid', 'pri', 'thd', 'hnd', 'priv'].includes(sortKey)) {
                 const numA = parseFloat(valA);
                 const numB = parseFloat(valB);
                 if (numA < numB) return sortDirection === 'asc' ? -1 : 1;
                 if (numA > numB) return sortDirection === 'asc' ? 1 : -1;
                 return 0;
            }

            // Default string sort
            if (valA.toLowerCase() < valB.toLowerCase()) return sortDirection === 'asc' ? -1 : 1;
            if (valA.toLowerCase() > valB.toLowerCase()) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortKey, sortDirection]);

    const SortableHeader: React.FC<{ sortKey: SortKey, children: React.ReactNode }> = ({ children, sortKey: key }) => (
         <TableHead>
            <Button variant="ghost" onClick={() => handleSort(key)} className="px-2 py-1 h-auto">
                {children}
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </TableHead>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center">
                        <Activity className="mr-2 h-5 w-5" /> Process List
                    </div>
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search processes..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <TooltipProvider>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortableHeader sortKey="name">Name</SortableHeader>
                                <SortableHeader sortKey="pid">PID</SortableHeader>
                                <SortableHeader sortKey="thd">Threads</SortableHeader>
                                <SortableHeader sortKey="hnd">Handles</SortableHeader>
                                <SortableHeader sortKey="cpu_time">CPU Time</SortableHeader>
                                <SortableHeader sortKey="elapsed_time">Elapsed Time</SortableHeader>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.map(proc => (
                                <TableRow key={proc.pid}>
                                    <TableCell className="font-medium max-w-[200px] truncate" title={proc.name}>{proc.name}</TableCell>
                                    <TableCell>{proc.pid}</TableCell>
                                    <TableCell>{proc.thd}</TableCell>
                                    <TableCell>{proc.hnd}</TableCell>
                                    <TableCell className="font-mono text-xs">{proc.cpu_time}</TableCell>
                                    <TableCell className="font-mono text-xs">{proc.elapsed_time}</TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                                            <Skull className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Kill Process</p></TooltipContent>
                                            </Tooltip>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will forcefully terminate the process <strong className="font-mono">{proc.name}</strong> (PID: {proc.pid}). This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onKill(proc.pid)} className="bg-destructive hover:bg-destructive/90">Kill Process</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TooltipProvider>
            </CardContent>
        </Card>
    )
}

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

type ServiceSortKey = 'name' | 'display_name' | 'state';
type SortDirection = 'asc' | 'desc';
type ServiceFilter = 'all' | 'running' | 'stopped';

const PsServiceResult: React.FC<{ data: PsServiceData[], onAction: (serviceName: string, action: 'start' | 'stop' | 'restart') => void, onInfo: (service: PsServiceData) => void }> = ({ data, onAction, onInfo }) => {
    const [sortKey, setSortKey] = React.useState<ServiceSortKey>('display_name');
    const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');
    const [filter, setFilter] = React.useState<ServiceFilter>('all');
    const [searchTerm, setSearchTerm] = React.useState('');

    const handleSort = (key: ServiceSortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const filteredData = React.useMemo(() => {
        return data.filter(service => {
            const matchesFilter = (filter === 'all') ||
                (filter === 'running' && service.state.includes('RUNNING')) ||
                (filter === 'stopped' && service.state.includes('STOPPED'));
            
            const matchesSearch = service.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                service.name.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesFilter && matchesSearch;
        });
    }, [data, filter, searchTerm]);

    const sortedData = React.useMemo(() => {
        return [...filteredData].sort((a, b) => {
            const valA = a[sortKey].toLowerCase();
            const valB = b[sortKey].toLowerCase();
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortKey, sortDirection]);

    const SortableHeader: React.FC<{ sortKey: ServiceSortKey, children: React.ReactNode }> = ({ children, sortKey: key }) => (
        <TableHead>
            <Button variant="ghost" onClick={() => handleSort(key)} className="px-2 py-1 h-auto">
                {children}
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </TableHead>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center text-lg">
                    <Settings2 className="mr-2 h-5 w-5" /> Services
                </CardTitle>
                 <div className="flex flex-col md:flex-row items-center gap-2 pt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All ({data.length})</Button>
                        <Button size="sm" variant={filter === 'running' ? 'default' : 'outline'} onClick={() => setFilter('running')} className="bg-green-600 hover:bg-green-700 text-white">Running ({data.filter(s => s.state.includes("RUNNING")).length})</Button>
                        <Button size="sm" variant={filter === 'stopped' ? 'default' : 'outline'} onClick={() => setFilter('stopped')}>Stopped ({data.filter(s => s.state.includes("STOPPED")).length})</Button>
                    </div>
                    <div className="relative w-full md:w-auto md:ml-auto">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search services..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 <TooltipProvider>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortableHeader sortKey="display_name">Display Name</SortableHeader>
                                <SortableHeader sortKey="state">State</SortableHeader>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.map((service) => (
                                 <TableRow key={service.name}>
                                     <TableCell className="font-medium max-w-xs truncate" title={service.display_name}>
                                        {service.display_name}
                                        <p className="text-xs text-muted-foreground font-mono">{service.name}</p>
                                     </TableCell>
                                     <TableCell>
                                         <Badge variant={service.state.includes('RUNNING') ? 'default' : 'secondary'}
                                             className={cn(service.state.includes('RUNNING') && "bg-green-600")}
                                         >
                                            {service.state}
                                         </Badge>
                                     </TableCell>
                                     <TableCell>
                                         <div className="flex items-center gap-1">
                                             <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onInfo(service)}>
                                                        <HelpCircle className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Show Details</p></TooltipContent>
                                            </Tooltip>

                                            {service.state.includes("STOPPED") && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => onAction(service.name, 'start')}>
                                                            <PlayCircle className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>Start Service</p></TooltipContent>
                                                </Tooltip>
                                            )}

                                            {service.state.includes("RUNNING") && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                         <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => onAction(service.name, 'stop')}>
                                                            <StopCircle className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>Stop Service</p></TooltipContent>
                                                </Tooltip>
                                            )}

                                            {service.state.includes("RUNNING") && (
                                                 <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAction(service.name, 'restart')}>
                                                            <RefreshCw className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>Restart Service</p></TooltipContent>
                                                </Tooltip>
                                            )}
                                         </div>
                                     </TableCell>
                                 </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TooltipProvider>
            </CardContent>
        </Card>
    );
};

const PsLogListResult: React.FC<{ data: PsLogListData[] }> = ({ data }) => {
    const getEventTypeIcon = (type: string) => {
        switch (type.toUpperCase()) {
            case 'INFORMATION': return <InfoIcon className="h-4 w-4 text-blue-500" />;
            case 'WARNING': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
            case 'ERROR': return <XCircle className="h-4 w-4 text-red-500" />;
            case 'SUCCESS': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            default: return <InfoIcon className="h-4 w-4 text-gray-500" />;
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center text-lg">
                    <FileCode className="mr-2 h-5 w-5" /> Event Log
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    {data.map((event, index) => (
                        <AccordionItem value={`item-${index}`} key={index}>
                            <AccordionTrigger>
                                <div className="flex items-center gap-3 text-sm w-full">
                                    {getEventTypeIcon(event.type)}
                                    <span className="font-medium truncate flex-1 text-left">{event.source}</span>
                                    <Badge variant="outline">{event.type}</Badge>
                                    <span className="text-xs text-muted-foreground font-mono hidden md:inline-block">ID: {event.id}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-3 pl-7">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                        <div className="text-muted-foreground">Time</div><div>{event.time}</div>
                                        <div className="text-muted-foreground">User</div><div>{event.user}</div>
                                        <div className="text-muted-foreground">Computer</div><div>{event.computer}</div>
                                        <div className="text-muted-foreground">Record #</div><div>{event.record_num}</div>
                                    </div>
                                    <p className="text-sm font-mono bg-muted p-3 rounded-md mt-2">{event.message}</p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}

const PsBrowseResult: React.FC<{
    data: PsBrowseItem[];
    currentPath: string;
    onNavigate: (path: string) => void;
    isDriveView: boolean;
}> = ({ data, currentPath, onNavigate, isDriveView }) => {
    
    const navigateTo = (item: PsBrowseItem) => {
        // For drives, FullName is the path to navigate to.
        // For files/folders, FullName is also the correct path.
        if (item.Mode.startsWith('d')) {
            onNavigate(item.FullName);
        }
    };

    const navigateUp = () => {
        if (isDriveView) return; // Can't go up from drive view
        // If current path is a root drive like C:\, go back to drive view
        if (currentPath.match(/^[a-zA-Z]:\\?$/)) {
             onNavigate("drives");
             return;
        }
        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('\\')) || `${currentPath.substring(0,2)}\\`;
        onNavigate(parentPath);
    };

    const folders = data.filter(item => item.Mode.startsWith('d')).sort((a,b) => a.Name.localeCompare(b.Name));
    const files = data.filter(item => !item.Mode.startsWith('d')).sort((a,b) => a.Name.localeCompare(b.Name));
    const sortedData = [...folders, ...files];

    const formatBytes = (bytes: number | null, decimals = 2) => {
        if (bytes === null || bytes === 0) return '';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    const formatDate = (dateString: string) => {
        try {
            // Don't format the placeholder date for drives
            if (dateString.startsWith('0001-01-01')) return '';
            return new Date(dateString).toLocaleString();
        } catch {
            return dateString;
        }
    }


    return (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center text-lg">
                <Folder className="mr-2 h-5 w-5" /> File Browser
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                 <Button variant="ghost" size="icon" onClick={navigateUp} disabled={isDriveView} className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onNavigate("drives")} className="h-8 w-8">
                    <Home className="h-4 w-4" />
                </Button>
                <code className="bg-muted px-2 py-1 rounded-md">{isDriveView ? "Available Drives" : currentPath}</code>
            </div>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Last Modified</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedData.map((item, index) => (
                        <TableRow 
                            key={item.FullName || index} 
                            onClick={() => navigateTo(item)}
                            className={cn(item.Mode.startsWith('d') && 'cursor-pointer hover:bg-muted/50')}
                        >
                            <TableCell className="font-medium flex items-center gap-2">
                                {isDriveView ? <Database className="h-4 w-4 text-muted-foreground" /> : item.Mode.startsWith('d') ? <Folder className="h-4 w-4 text-amber-500" /> : <File className="h-4 w-4 text-muted-foreground" />}
                                {isDriveView ? `${item.Name} (${item.FullName})` : item.Name}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{formatDate(item.LastWriteTime)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                                {item.Length !== null && !item.Mode.startsWith('d') ? formatBytes(item.Length) : ''}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
    )
};


const CommandOutputDialog: React.FC<{
    state: DialogState;
    onClose: () => void;
    onServiceAction?: (serviceName: string, action: 'start' | 'stop' | 'restart') => void;
    onServiceInfo?: (service: PsServiceData) => void;
    onProcessKill?: (processId: string) => void;
    onBrowseNavigate?: (path: string) => void;
    browsePath?: string;
}> = ({ state, onClose, onServiceAction, onServiceInfo, onProcessKill, onBrowseNavigate, browsePath }) => {
    
    const hasStructuredData = state.structuredData?.psinfo || state.structuredData?.pslist || state.structuredData?.psloggedon || state.structuredData?.psfile || state.structuredData?.psservice || state.structuredData?.psloglist || state.structuredData?.psbrowse;
    const isDriveView = browsePath === 'drives';

    const isHackerTheme = !hasStructuredData;

    return (
    <AlertDialog open={state.isOpen} onOpenChange={onClose}>
        <AlertDialogContent className={cn(
            "max-w-4xl",
            isHackerTheme && "bg-black text-green-400 border-green-500/50 font-mono"
        )}>
            <AlertDialogHeader>
                <AlertDialogTitle className={cn(isHackerTheme && "text-green-400")}>{state.title}</AlertDialogTitle>
                <AlertDialogDescription className={cn(isHackerTheme && "text-green-400/80")}>
                    {state.description}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                {/* Structured data views */}
                {state.structuredData?.psinfo && <PsInfoResult data={state.structuredData.psinfo} />}
                {state.structuredData?.pslist && onProcessKill && <PsListResult data={state.structuredData.pslist} onKill={onProcessKill} />}
                {state.structuredData?.psloggedon && <PsLoggedOnResult data={state.structuredData.psloggedon} />}
                {state.structuredData?.psfile && <PsFileResult data={state.structuredData.psfile} />}
                {state.structuredData?.psservice && onServiceAction && onServiceInfo && 
                    <PsServiceResult 
                        data={state.structuredData.psservice} 
                        onAction={onServiceAction}
                        onInfo={onServiceInfo}
                    />
                }
                {state.structuredData?.psloglist && <PsLogListResult data={state.structuredData.psloglist} />}
                {state.structuredData?.psbrowse && onBrowseNavigate && browsePath &&
                    <PsBrowseResult 
                        data={state.structuredData.psbrowse}
                        currentPath={browsePath}
                        onNavigate={onBrowseNavigate}
                        isDriveView={isDriveView}
                    />
                }

                {/* Raw output for non-structured data (hacker theme) or if there's an error */}
                {(!hasStructuredData || state.error) && (
                    <>
                    {state.output && (
                        <div>
                            <Label className={cn(isHackerTheme && "text-green-400")}>C:\&gt; Output</Label>
                            <Textarea 
                                readOnly 
                                value={state.output} 
                                className={cn("mt-1 h-64 font-mono text-xs", isHackerTheme && "bg-black text-green-400 border-green-500/30 focus-visible:ring-green-500")}
                            />
                        </div>
                    )}
                    {state.error && (
                         <div>
                            <Label className={cn(isHackerTheme ? "text-red-400" : "text-destructive")}>C:\&gt; Error</Label>
                            <Textarea 
                                readOnly 
                                value={state.error} 
                                className={cn(
                                    "mt-1 h-32 font-mono text-xs", 
                                    isHackerTheme ? "bg-black text-red-400 border-red-500/30 focus-visible:ring-red-500" : "bg-destructive/10 text-destructive"
                                )}
                            />
                        </div>
                    )}
                    </>
                )}


                {/* Raw output for structured data (collapsible) */}
                {hasStructuredData && (state.output || state.error) && (
                    <details className="mt-4">
                        <summary className="text-xs text-muted-foreground cursor-pointer">Show Raw Output</summary>
                        {state.output && <Textarea readOnly value={state.output} className="mt-1 h-48 font-mono text-xs bg-muted" />}
                         {state.error && <Textarea readOnly value={state.error} className="mt-1 h-24 font-mono text-xs bg-destructive/10 text-destructive" />}
                    </details>
                )}
            </div>
            <AlertDialogFooter>
                <Button 
                    variant="outline" 
                    onClick={onClose} 
                    className={cn(isHackerTheme && "text-green-400 border-green-500/50 hover:bg-green-900/50 hover:text-green-300")}>
                    Close
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
)}

const ServiceInfoDialog: React.FC<{
    service: PsServiceData | null;
    onClose: () => void;
}> = ({ service, onClose }) => {
    if (!service) return null;
    return (
        <AlertDialog open={!!service} onOpenChange={onClose}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{service.display_name}</AlertDialogTitle>
                    <AlertDialogDescription>
                        <Badge variant={service.state.includes('RUNNING') ? 'default' : 'secondary'} className={cn(service.state.includes('RUNNING') && "bg-green-600")}>
                            {service.state}
                        </Badge>
                         <p className="font-mono text-xs mt-2">{service.name}</p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="text-sm text-muted-foreground my-4 max-h-[40vh] overflow-y-auto">
                    {service.description}
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose}>Close</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};


const WinRMStatusPopover: React.FC<{status: WinRMStatus}> = ({ status }) => {
    const StatusItem: React.FC<{label: string, success: boolean}> = ({ label, success }) => (
        <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
             {success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
                <XCircle className="h-4 w-4 text-destructive" />
            )}
        </div>
    );
    
    return (
        <PopoverContent className="w-80">
            <div className="space-y-4">
                <div className="space-y-1">
                    <h4 className="font-medium leading-none">WinRM Diagnostics</h4>
                    <p className="text-sm text-muted-foreground">
                        Status of WinRM components on the remote host.
                    </p>
                </div>
                {status.checks ? (
                    <div className="space-y-2">
                        <StatusItem label="Service Running" success={status.checks.serviceRunning} />
                        <StatusItem label="Listener Configured" success={status.checks.listenerConfigured} />
                        <StatusItem label="Firewall Rule Open" success={status.checks.firewallOpen} />
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">{status.errorDetails || "Could not retrieve diagnostic details."}</p>
                )}
                 {status.overallStatus === 'error' && status.errorDetails && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {status.errorDetails}
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        </PopoverContent>
    );
}

export default function DeviceActionsPanel({
  device,
  isOpen,
  onClose,
}: DeviceActionsPanelProps) {
  const { toast } = useToast();
  const { user, password } = useAuth();
  const [dialogState, setDialogState] = React.useState<DialogState>({
      isOpen: false,
      title: "",
      description: "",
      output: "",
      error: "",
      structuredData: null,
  });
  const [serviceInfo, setServiceInfo] = React.useState<PsServiceData | null>(null);
  const [browsePath, setBrowsePath] = React.useState("drives");
  const [winrmStatus, setWinrmStatus] = React.useState<WinRMStatus>({ overallStatus: 'checking' });
  const [isEnablingWinRM, setIsEnablingWinRM] = React.useState(false);

  // This function is now memoized with useCallback to avoid re-creating it on every render.
  // It checks the WinRM status for the *currently selected* device.
  const checkWinRMStatus = React.useCallback(async () => {
    if (!device || !user) return;
    setWinrmStatus({ overallStatus: 'checking' });
    try {
        const res = await fetch('/api/network/check-winrm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: device.ipAddress })
        });
        const data = await res.json();
        if (data.ok) {
            setWinrmStatus({
                overallStatus: data.overallStatus,
                checks: data.checks,
                errorDetails: data.error, // The backend might return a high-level error
            });
        } else {
             setWinrmStatus({ overallStatus: 'error', errorDetails: data.details || data.error });
        }
    } catch (e) {
        setWinrmStatus({ overallStatus: 'error', errorDetails: "Failed to connect to the backend server." });
    }
  }, [device, user]);

  // This effect hook runs ONLY when the panel is opened for a specific device.
  // It ensures the WinRM check is performed on-demand.
  React.useEffect(() => {
    // Only run the check if the panel is open and the device is online.
    if (isOpen && device?.status === 'online') {
        checkWinRMStatus();
    } else if (device?.status !== 'online') {
        setWinrmStatus({ overallStatus: 'error', errorDetails: "Device is offline."});
    }
  }, [isOpen, device, checkWinRMStatus]);

  const handleEnableWinRM = async () => {
    if (!device) return;
    setIsEnablingWinRM(true);
    toast({ title: "Attempting to Enable WinRM...", description: `Sending command to ${device.name}. This might take a moment.` });
    try {
        const res = await fetch('/api/pstools/enable-winrm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: device.ipAddress }),
        });
        const data = await res.json();
        if (data.ok) {
            toast({ title: "Command Sent Successfully", description: "WinRM is being enabled. Checking status again in 10 seconds..." });
            // Wait a bit for the service to start, then re-check
            setTimeout(() => {
                checkWinRMStatus();
            }, 10000);
        } else {
             toast({ variant: "destructive", title: "Failed to Enable WinRM", description: data.details || data.error });
        }
    } catch (e) {
         toast({ variant: "destructive", title: "Client Error", description: "Could not send request to the server." });
    } finally {
        setIsEnablingWinRM(false);
    }
  };


  if (!device) return null;

  const Icon = ICONS[device.type] || Laptop;

  const handlePstoolAction = async (tool: string, extraParams: Record<string, any> = {}, showToast = true) => {
      if (!user || !device) return;

      const isBrowse = tool === 'psbrowse';

      if(showToast && !isBrowse) {
        toast({ title: "Sending Command...", description: `Running ${tool} on ${device.name}` });
      }

      // For psbrowse, use the state for the path
      if(isBrowse) {
        // If the path is "drives", we send an empty path to the backend to signal it to list drives.
        const pathToSend = extraParams.path === 'drives' ? '' : extraParams.path;
        extraParams.path = pathToSend;
        setBrowsePath(extraParams.path || 'drives');
      }


      try {
          const response = await fetch(`/api/pstools/${tool.replace('api/','')}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  ip: device.ipAddress,
                  // Include credentials explicitly
                  username: user.user,
                  domain: user.domain,
                  pwd: password,
                  ...extraParams,
              }),
          });
          
          let result;
          const responseClone = response.clone(); // Clone the response to read it multiple times

          try {
            result = await response.json();
          } catch(e) {
            const text = await responseClone.text();
             setDialogState({
                isOpen: true,
                title: "Invalid Response",
                description: `The server returned a non-JSON response. This usually indicates an internal server error. (HTTP ${response.status})`,
                output: text,
                error: `Failed to parse JSON. Error: ${(e as Error).message}`,
                structuredData: null
             });
             return;
          }


          if (!response.ok && !result.stderr && !result.error) {
              result.error = `The server returned an error (HTTP ${response.status}) but did not provide specific details. Check the backend logs.`;
          }
          
          const finalError = result.stderr || result.error || "";

          // If the action was a service control, we might want to refresh the list
          if (tool === 'psservice' && extraParams.action !== 'query') {
              toast({ title: `Service ${extraParams.svc}`, description: `${extraParams.action} command sent successfully.`})
              // Refetch the service list to show updated state
              handlePstoolAction('psservice', { action: 'query' }, false);
              return; // We don't want to show the dialog for action commands
          }

          // If we just killed a process, refresh the list
          if (tool === 'pskill') {
              toast({ title: "Process Terminated", description: `Process ${extraParams.proc} was terminated.`});
              handlePstoolAction('pslist', {}, false); // Refresh the list
              return;
          }
          
          setDialogState({
            isOpen: true,
            title: `Result from: ${tool}`,
            description: `Command executed on ${device.name} (${device.ipAddress}).`,
            output: result.stdout,
            error: finalError,
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
                <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                        <div className={cn(
                            "h-2.5 w-2.5 rounded-full mr-2",
                            device.status === 'online' ? "bg-green-500" : "bg-gray-400"
                        )} />
                        <span className="text-muted-foreground capitalize">
                          {device.status} {device.status === 'offline' && `(Last seen: ${device.lastSeen})`}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-6 w-6" disabled={winrmStatus.overallStatus === 'checking'}>
                                    {winrmStatus.overallStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />}
                                    {winrmStatus.overallStatus === 'enabled' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                    {winrmStatus.overallStatus === 'disabled' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                                    {winrmStatus.overallStatus === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                                </Button>
                            </PopoverTrigger>
                           <WinRMStatusPopover status={winrmStatus} />
                        </Popover>
                        {winrmStatus.overallStatus === 'disabled' && (
                            <Button 
                                size="sm" 
                                variant="destructive" 
                                className="h-7"
                                onClick={handleEnableWinRM}
                                disabled={isEnablingWinRM}
                            >
                                {isEnablingWinRM ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Zap className="mr-2 h-3 w-3"/>}
                                Enable WinRM
                            </Button>
                        )}
                    </div>
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
                <Button variant={"outline"} className="justify-start" onClick={() => handlePstoolAction('psbrowse', { path: 'drives'})} disabled={winrmStatus.overallStatus !== 'enabled'}>
                    <Folder className="mr-2 h-4 w-4" />
                    <span>Browse Files</span>
                    <ChevronRight className="ml-auto h-4 w-4" />
                </Button>
                <ActionButton icon={Info} label="System Info" onClick={() => handlePstoolAction('psinfo')} />
                <ActionButton icon={Activity} label="Process List" onClick={() => handlePstoolAction('pslist')} />
                <ActionButton icon={Users} label="Logged On Users" onClick={() => handlePstoolAction('psloggedon')} />
                <ActionButton icon={Settings2} label="Manage Services" onClick={() => handlePstoolAction('psservice', { action: 'query' })} />
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
                    <ActionButton icon={Zap} label="Force GPUpdate" onClick={() => handlePstoolAction('psexec', { cmd: 'gpupdate /force' })} />
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
        onServiceAction={(serviceName, action) => handlePstoolAction('psservice', { action, svc: serviceName }, true)}
        onServiceInfo={(service) => setServiceInfo(service)}
        onProcessKill={(processId) => handlePstoolAction('pskill', { proc: processId })}
        onBrowseNavigate={(path) => handlePstoolAction('psbrowse', { path }, false)}
        browsePath={browsePath}
    />
     <ServiceInfoDialog 
        service={serviceInfo}
        onClose={() => setServiceInfo(null)}
     />
    </>
  );
}

    

    
