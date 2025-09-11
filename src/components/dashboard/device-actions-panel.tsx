

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
  MoreVertical,
  Download,
  Trash2,
  Edit,
  FolderPlus,
  Upload,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";


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

type WinRMProcess = {
    Name: string;
    Id: number;
    Priority: string;
    Threads: number;
    Handles: number;
    Memory: string;
    CPUTime: string;
    ElapsedTime: string;
};

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
        pslist?: WinRMProcess[] | null;
        psloggedon?: PsLoggedOnUser[] | null;
        psfile?: PsFileData[] | null;
        psservice?: PsServiceData[] | null;
        psloglist?: PsLogListData[] | null;
        psbrowse?: PsBrowseItem[] | null;
    } | null;
}

type WinRMCheckStatus = 'checking' | 'success' | 'failure';
type WinRMDiagnosticsState = {
    service: { status: WinRMCheckStatus, message: string };
    listener: { status: WinRMCheckStatus, message: string };
    firewall: { status: WinRMCheckStatus, message: string };
};


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


const PsListResult: React.FC<{ data: WinRMProcess[], onKill: (processId: number) => void }> = ({ data, onKill }) => {
    const [searchTerm, setSearchTerm] = React.useState('');
    type SortKey = keyof WinRMProcess;
    const [sortKey, setSortKey] = React.useState<SortKey>('Name');
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
        return data.filter(proc => proc.Name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [data, searchTerm]);

    const sortedData = React.useMemo(() => {
        return [...filteredData].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            // Handle numeric sorting for relevant fields
            if (['Id', 'Threads', 'Handles'].includes(sortKey)) {
                 const numA = Number(valA);
                 const numB = Number(valB);
                 if (numA < numB) return sortDirection === 'asc' ? -1 : 1;
                 if (numA > numB) return sortDirection === 'asc' ? 1 : -1;
                 return 0;
            }

            // Default string sort
            if (String(valA).toLowerCase() < String(valB).toLowerCase()) return sortDirection === 'asc' ? -1 : 1;
            if (String(valA).toLowerCase() > String(valB).toLowerCase()) return sortDirection === 'asc' ? 1 : -1;
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
                                <SortableHeader sortKey="Name">Name</SortableHeader>
                                <SortableHeader sortKey="Id">PID</SortableHeader>
                                <SortableHeader sortKey="Threads">Threads</SortableHeader>
                                <SortableHeader sortKey="Handles">Handles</SortableHeader>
                                <SortableHeader sortKey="Memory">Memory</SortableHeader>
                                <SortableHeader sortKey="CPUTime">CPU Time</SortableHeader>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.map(proc => (
                                <TableRow key={proc.Id}>
                                    <TableCell className="font-medium max-w-[200px] truncate" title={proc.Name}>{proc.Name}</TableCell>
                                    <TableCell>{proc.Id}</TableCell>
                                    <TableCell>{proc.Threads}</TableCell>
                                    <TableCell>{proc.Handles}</TableCell>
                                    <TableCell className="font-mono text-xs">{proc.Memory}</TableCell>
                                    <TableCell className="font-mono text-xs">{proc.CPUTime}</TableCell>
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
                                                        This will forcefully terminate the process <strong className="font-mono">{proc.Name}</strong> (PID: {proc.Id}). This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onKill(proc.Id)} className="bg-destructive hover:bg-destructive/90">Kill Process</AlertDialogAction>
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
    onDownload: (path: string, filename: string) => void;
    onUpload: (path: string, file: File) => void;
    onDeleteItem: (path: string, name: string, isFolder: boolean) => void;
    onRenameItem: (path: string, oldName: string, newName: string) => void;
    onCreateFolder: (path: string, folderName: string) => void;
    isLoading: boolean;
}> = ({ data, currentPath, onNavigate, onDownload, onUpload, onDeleteItem, onRenameItem, onCreateFolder, isLoading }) => {
    
    const [actionDialog, setActionDialog] = React.useState<{type: 'rename' | 'create_folder', item?: PsBrowseItem, isOpen: boolean}>({type: 'rename', isOpen: false});
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onUpload(currentPath, file);
        }
        // Reset file input to allow uploading the same file again
        if (event.currentTarget) {
            event.currentTarget.value = "";
        }
    };
    
    const isDriveView = currentPath === "drives";

    const navigateTo = (item: PsBrowseItem) => {
        if (item.Mode.startsWith('d')) {
            onNavigate(item.FullName);
        }
    };

    const pathSegments = React.useMemo(() => {
        if (isDriveView) return [{ name: "Drives", path: "drives" }];
        const parts = currentPath.split('\\').filter(Boolean);
        const segments = parts.map((part, index) => {
            const path = parts.slice(0, index + 1).join('\\');
            // For C:, path should be C:\
            return {
                name: part,
                path: path.endsWith(':') ? path + '\\' : path,
            };
        });
        return [{ name: "Drives", path: "drives" }, ...segments];
    }, [currentPath, isDriveView]);

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
            if (dateString.startsWith('0001-01-01')) return '';
            return new Date(dateString).toLocaleString();
        } catch {
            return dateString;
        }
    }

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newName = formData.get('newName') as string;
        if (!newName) return;

        if (actionDialog.type === 'rename' && actionDialog.item) {
            onRenameItem(actionDialog.item.FullName, actionDialog.item.Name, newName);
        } else if (actionDialog.type === 'create_folder') {
            onCreateFolder(currentPath, newName);
        }
        setActionDialog({type: 'rename', isOpen: false});
    };

    return (
    <>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center text-lg justify-between">
                     <div className="flex items-center gap-2">
                        <Folder className="mr-2 h-5 w-5" /> File Browser
                     </div>
                     <div className="flex items-center gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" />
                        <Button variant="outline" size="sm" onClick={handleUploadClick} disabled={isDriveView}>
                            <Upload className="mr-2 h-4 w-4" /> Upload File
                        </Button>
                         <Button variant="outline" size="sm" onClick={() => setActionDialog({ type: 'create_folder', isOpen: true })} disabled={isDriveView}>
                            <FolderPlus className="mr-2 h-4 w-4" /> Create Folder
                        </Button>
                     </div>
                </CardTitle>
                <div className="flex items-center gap-1 text-sm text-muted-foreground pt-2 flex-wrap">
                    {pathSegments.map((segment, index) => (
                        <React.Fragment key={segment.path}>
                             <Button 
                                variant="link" 
                                className="p-1 h-auto text-muted-foreground"
                                onClick={() => onNavigate(segment.path)}
                            >
                                {segment.name === "Drives" ? <Home className="h-4 w-4" /> : segment.name}
                            </Button>
                            {index < pathSegments.length - 1 && <ChevronRight className="h-4 w-4" />}
                        </React.Fragment>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="h-[50vh] overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Last Modified</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!isDriveView && (
                            <TableRow onClick={() => onNavigate(pathSegments.length > 2 ? pathSegments[pathSegments.length - 2].path : 'drives')} className="cursor-pointer">
                                <TableCell className="flex items-center gap-2 font-medium">
                                    <Folder className="h-4 w-4 text-amber-500" />
                                    ..
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        )}
                        {sortedData.map((item) => (
                            <TableRow 
                                key={item.FullName} 
                                onDoubleClick={() => navigateTo(item)}
                                className={cn(item.Mode.startsWith('d') && 'cursor-pointer')}
                            >
                                <TableCell className="font-medium flex items-center gap-2 max-w-xs truncate">
                                    {isDriveView ? <Database className="h-4 w-4 text-muted-foreground" /> : item.Mode.startsWith('d') ? <Folder className="h-4 w-4 text-amber-500" /> : <File className="h-4 w-4 text-muted-foreground" />}
                                    <span title={item.Name}>{item.Name}</span>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{formatDate(item.LastWriteTime)}</TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                    {item.Length !== null && !item.Mode.startsWith('d') ? formatBytes(item.Length) : ''}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {!item.Mode.startsWith('d') && (
                                                <DropdownMenuItem onClick={() => onDownload(item.FullName, item.Name)}>
                                                    <Download className="mr-2 h-4 w-4" /> Download
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={() => setActionDialog({ type: 'rename', item, isOpen: true })}>
                                                <Edit className="mr-2 h-4 w-4" /> Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive" onClick={() => onDeleteItem(item.FullName, item.Name, item.Mode.startsWith('d'))}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                )}
            </CardContent>
        </Card>

        {/* Action Dialog for Rename / Create Folder */}
        <AlertDialog open={actionDialog.isOpen} onOpenChange={(open) => !open && setActionDialog(prev => ({...prev, isOpen: false}))}>
             <form onSubmit={handleFormSubmit}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {actionDialog.type === 'rename' ? `Rename "${actionDialog.item?.Name}"` : 'Create New Folder'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                           {actionDialog.type === 'rename' ? 'Enter the new name for the item.' : `Enter the name for the new folder inside "${currentPath}".`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Label htmlFor="newName">Name</Label>
                        <Input 
                            id="newName" 
                            name="newName"
                            defaultValue={actionDialog.type === 'rename' ? actionDialog.item?.Name : ''}
                            required
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction type="submit">
                             {actionDialog.type === 'rename' ? 'Rename' : 'Create'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
             </form>
        </AlertDialog>
    </>
    )
};


const CommandOutputDialog: React.FC<{
    state: DialogState;
    onClose: () => void;
    onServiceAction?: (serviceName: string, action: 'start' | 'stop' | 'restart') => void;
    onServiceInfo?: (service: PsServiceData) => void;
    onProcessKill?: (processId: number) => void;
    onBrowseAction?: (action: 'navigate' | 'download' | 'upload' | 'delete' | 'rename' | 'create_folder', params: any) => void;
    browsePath?: string;
}> = ({ state, onClose, onServiceAction, onServiceInfo, onProcessKill, onBrowseAction, browsePath }) => {
    
    const [isLoading, setIsLoading] = React.useState(false);

    const isBrowseView = !!state.structuredData?.psbrowse;
    const isProcessView = !!state.structuredData?.pslist;
    const isHackerTheme = !isBrowseView && !(state.structuredData?.psinfo || isProcessView || state.structuredData?.psloggedon || state.structuredData?.psfile || state.structuredData?.psservice || state.structuredData?.psloglist);
    
    const handleFileAction = async (action: 'navigate' | 'download' | 'upload' | 'delete' | 'rename' | 'create_folder', params: any) => {
        if (!onBrowseAction) return;
        setIsLoading(true);
        await onBrowseAction(action, params);
        setIsLoading(false);
    };

    return (
    <AlertDialog open={state.isOpen} onOpenChange={onClose}>
        <AlertDialogContent className={cn(
            isBrowseView || isProcessView ? "max-w-4xl" : "max-w-2xl",
            isHackerTheme && "bg-black text-green-400 border-green-500/50 font-mono"
        )}>
            <AlertDialogHeader>
                <AlertDialogTitle className={cn(isHackerTheme && "text-green-400")}>{state.title}</AlertDialogTitle>
                <AlertDialogDescription className={cn(isHackerTheme && "text-green-400/80")}>
                    {state.description}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="mt-4 space-y-4 max-h-[80vh] overflow-y-auto pr-4">
                {/* Structured data views */}
                {state.structuredData?.psinfo && <PsInfoResult data={state.structuredData.psinfo} />}
                {isProcessView && onProcessKill && <PsListResult data={state.structuredData!.pslist!} onKill={onProcessKill} />}
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
                {isBrowseView && onBrowseAction && browsePath &&
                    <PsBrowseResult 
                        data={state.structuredData!.psbrowse!}
                        currentPath={browsePath}
                        isLoading={isLoading}
                        onNavigate={(path) => handleFileAction('navigate', {path})}
                        onDownload={(path, filename) => handleFileAction('download', {path, filename})}
                        onUpload={(path, file) => handleFileAction('upload', {path, file})}
                        onDeleteItem={(path, name, isFolder) => handleFileAction('delete', {path, name, isFolder})}
                        onRenameItem={(path, oldName, newName) => handleFileAction('rename', {path, oldName, newName})}
                        onCreateFolder={(path, folderName) => handleFileAction('create_folder', {path, folderName})}
                    />
                }


                {/* Raw output for non-structured data or if there's an error */}
                {!isBrowseView && !isProcessView && (
                    <>
                    {(state.output && !isHackerTheme) && (
                         <details className="mt-4">
                            <summary className="text-xs text-muted-foreground cursor-pointer">Show Raw Output</summary>
                            <Textarea readOnly value={state.output} className="mt-1 h-48 font-mono text-xs bg-muted" />
                        </details>
                    )}
                    {state.output && isHackerTheme && (
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


const WinRMDiagnosticsDialog: React.FC<{
    state: WinRMDiagnosticsState;
    onOpenLog: (log: string) => void;
    onFix: () => void;
    isFixing: boolean;
}> = ({ state, onOpenLog, onFix, isFixing }) => {

    const StatusIcon = ({ status }: { status: WinRMCheckStatus }) => {
        if (status === 'checking') return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
        if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        return <XCircle className="h-4 w-4 text-destructive" />;
    };

    const CheckRow: React.FC<{ label: string; check: { status: WinRMCheckStatus; message: string }, onFixClick?: () => void; isFixing?: boolean; showFixButton?: boolean }> = 
        ({ label, check, onFixClick, isFixing, showFixButton = false }) => (
        <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div 
                className={cn("flex items-center gap-3", check.status === 'failure' && 'cursor-pointer')}
                onClick={() => check.status === 'failure' && onOpenLog(check.message)}
            >
                <StatusIcon status={check.status} />
                <span className="font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className={cn(
                    "text-sm",
                    check.status === 'success' && 'text-muted-foreground',
                    check.status === 'failure' && 'text-destructive'
                )}>
                    {check.status === 'checking' ? 'Checking...' : check.status === 'success' ? 'OK' : 'Failed'}
                </span>
                {showFixButton && check.status === 'failure' && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button onClick={onFixClick} disabled={isFixing} size="icon" variant="ghost" className="h-8 w-8 text-primary">
                                    {isFixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Attempt to fix</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-3">
            <CheckRow label="WMI / RPC Service" check={state.service} />
            <CheckRow label="WinRM Listener" check={state.listener} onFixClick={onFix} isFixing={isFixing} showFixButton={true} />
            <CheckRow label="Firewall Rule (HTTP-In)" check={state.firewall} />
        </div>
    );
};


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
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = React.useState(false);
  const [logDetail, setLogDetail] = React.useState<{ title: string, content: string } | null>(null);
  const [isEnablingWinRM, setIsEnablingWinRM] = React.useState(false);
  
  const initialDiagnosticsState: WinRMDiagnosticsState = {
        service: { status: 'checking', message: '' },
        listener: { status: 'checking', message: '' },
        firewall: { status: 'checking', message: '' },
    };
  const [diagnosticsState, setDiagnosticsState] = React.useState<WinRMDiagnosticsState>(initialDiagnosticsState);
  
  const runApiAction = React.useCallback(async (endpoint: string, params: Record<string, any> = {}, showToast = true) => {
    if (!user || !device) return null;

    if (showToast) {
        toast({ title: "Sending Command...", description: `Requesting ${endpoint} on ${device.name}` });
    }

    try {
        const response = await fetch(`/api/pstools/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip: device.ipAddress,
                username: user.user,
                domain: user.domain,
                pwd: password,
                ...params,
            }),
        });

        const result = await response.json();

        if (!response.ok && !result.error) {
            result.error = `The server returned an error (HTTP ${response.status}) but did not provide specific details.`;
        }
        return result;

    } catch (err: any) {
        return { ok: false, error: `Client-side error: ${err.message}` };
    }
  }, [device, user, password, toast]);
  
  const runWinRMDiagnostics = React.useCallback(async () => {
    if (!device || !user) return;
    
    setDiagnosticsState(initialDiagnosticsState);
    
    try {
        const res = await fetch('/api/network/check-winrm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: device.ipAddress })
        });
        
        const data = await res.json();
        
        if (data.ok) {
            setDiagnosticsState(data.results);
        } else {
            const errorState: WinRMDiagnosticsState = {
                service: { status: 'failure', message: data.message || data.error || 'An unknown backend error occurred.' },
                listener: { status: 'failure', message: data.message || data.error || 'An unknown backend error occurred.' },
                firewall: { status: 'failure', message: data.message || data.error || 'An unknown backend error occurred.' },
            };
            setDiagnosticsState(errorState);
        }
    } catch (e: any) {
        const errorMessage = e.message || "A client-side error occurred during the request.";
         const errorState: WinRMDiagnosticsState = {
            service: { status: 'failure', message: errorMessage },
            listener: { status: 'failure', message: errorMessage },
            firewall: { status: 'failure', message: errorMessage },
        };
        setDiagnosticsState(errorState);
    }
  }, [device, user, initialDiagnosticsState]);

  const handleBrowseAction = React.useCallback(async (action: 'navigate' | 'download' | 'upload' | 'delete' | 'rename' | 'create_folder', params: any) => {
      const endpointMap: Record<string, string> = {
          navigate: 'psbrowse',
          download: 'download-file',
          upload: 'upload-file',
          delete: 'delete-item',
          rename: 'rename-item',
          create_folder: 'create-folder',
      };
      const endpoint = endpointMap[action];
      if (!endpoint) return;

      const isModification = ['upload', 'delete', 'rename', 'create_folder'].includes(action);

      let apiParams: Record<string, any> = {};

      if (action === 'upload') {
          const file = params.file as File;
          const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
              reader.onerror = error => reject(error);
          });
          apiParams = { destinationPath: `${params.path}\\${file.name}`, fileContent: base64 };
      } else {
          apiParams = { ...params };
      }
      
      const result = await runApiAction(endpoint, apiParams, !isModification);
      if (!result) return;

      if (result.ok) {
           if (action === 'navigate') {
              setBrowsePath(params.path);
              setDialogState({
                  isOpen: true,
                  title: `File Browser`,
                  description: `Browsing ${params.path} on ${device?.name}`,
                  output: result.stdout || '',
                  error: result.stderr || result.error || '',
                  structuredData: result.structured_data || null,
              });
          } else if (action === 'download') {
              const byteCharacters = atob(result.content);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray]);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = params.filename;
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
              toast({ title: "Success", description: `"${params.filename}" downloaded.`});
          } else if (isModification) {
              toast({ title: "Success", description: result.message || "Action completed successfully." });
              // Refresh the current directory
              handleBrowseAction('navigate', { path: params.path });
          }
      } else {
          toast({ variant: 'destructive', title: `${action.charAt(0).toUpperCase() + action.slice(1)} Failed`, description: result.error });
           if (action === 'navigate') {
              setDialogState(prev => ({ ...prev, isOpen: true, error: result.error || 'An unknown error occurred.' }));
          }
      }
  }, [runApiAction, toast, device]);

  const handleOpenDiagnostics = () => {
    setIsDiagnosticsOpen(true);
    runWinRMDiagnostics();
  }

  const handleEnableWinRM = async () => {
    if (!device) return;
    setIsEnablingWinRM(true);
    toast({ title: "Attempting to Enable WinRM...", description: `Sending commands to ${device.name}. This might take a moment.` });
    
    const result = await runApiAction('enable-winrm', {}, false);
    
    if (result?.ok) {
        toast({ title: "Command Sent Successfully", description: "Re-running diagnostics to check the new status." });
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s for changes to apply
        await runWinRMDiagnostics();
    } else {
        toast({ variant: "destructive", title: "Failed to Enable WinRM", description: result?.details || result?.error });
    }
    setIsEnablingWinRM(false);
  };

  const handleGenericAction = async (tool: string, extraParams: Record<string, any> = {}) => {
      if (!device) return;
      const result = await runApiAction(tool, extraParams);
      if (result) {
        setDialogState({
            isOpen: true,
            title: `Result from: ${tool}`,
            description: `Command executed on ${device.name} (${device.ipAddress}).`,
            output: result.stdout || '',
            error: result.stderr || result.error || '',
            structuredData: result.structured_data || null,
        });
      }
  };

    const handleServiceAction = async (svc: string, action: 'start' | 'stop' | 'restart') => {
        const result = await runApiAction('psservice', { svc, action });
        if(result?.ok) {
            toast({ title: 'Success', description: result.stdout || `${action} command sent to ${svc}.`})
            const refreshResult = await runApiAction('psservice', { action: 'query' }, false);
            if (refreshResult?.ok) {
                setDialogState(prev => ({
                    ...prev,
                    structuredData: { ...prev.structuredData, psservice: refreshResult.structured_data.psservice }
                }));
            }
        } else {
            toast({ variant: 'destructive', title: 'Action Failed', description: result?.error || result?.stderr });
        }
    }

    const handleProcessKill = async (procId: number) => {
        const result = await runApiAction('pskill', { proc: procId.toString() });
        if(result?.ok) {
            toast({ title: 'Success', description: `Kill command sent to process ${procId}.`});
            const refreshResult = await runApiAction('pslist', {}, false);
             if (refreshResult?.ok) {
                setDialogState(prev => ({
                    ...prev,
                    structuredData: { ...prev.structuredData, pslist: refreshResult.structured_data.pslist }
                }));
            }
        } else {
             toast({ variant: 'destructive', title: 'Action Failed', description: result?.error || result?.stderr });
        }
    }

    if (!device) {
        return null;
    }

    const Icon = ICONS[device.type] || Laptop;

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
            {device.ipAddress} | {device.os}
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
                 <h4 className="font-semibold text-foreground">Remote Management</h4>
                 <Dialog open={isDiagnosticsOpen} onOpenChange={setIsDiagnosticsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="justify-start w-full" onClick={handleOpenDiagnostics}>
                             <ShieldCheck className="mr-2 h-4 w-4" />
                            <span>WinRM Diagnostics</span>
                             <ChevronRight className="ml-auto h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>WinRM Diagnostics for {device.name}</DialogTitle>
                            <DialogDescription>
                                Status of WinRM components on the remote host. Click on a failed item to see details.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                             <WinRMDiagnosticsDialog 
                                state={diagnosticsState} 
                                onOpenLog={(log) => setLogDetail({ title: "Error Log", content: log })} 
                                onFix={handleEnableWinRM}
                                isFixing={isEnablingWinRM}
                             />
                        </div>
                    </DialogContent>
                </Dialog>

                <Button variant={"outline"} className="justify-start w-full" onClick={() => handleBrowseAction('navigate', { path: 'drives'})} disabled={device.status !== 'online'}>
                    <Folder className="mr-2 h-4 w-4" />
                    <span>Browse Files (WinRM)</span>
                    <ChevronRight className="ml-auto h-4 w-4" />
                </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">PSTools Actions</h4>
              <div className="grid grid-cols-1 gap-2">
                <ActionButton icon={Info} label="System Info" onClick={() => handleGenericAction('psinfo')} />
                <ActionButton icon={Activity} label="Process List" onClick={() => handleGenericAction('pslist')} />
                <ActionButton icon={Users} label="Logged On Users" onClick={() => handleGenericAction('psloggedon')} />
                <ActionButton icon={Settings2} label="Manage Services" onClick={() => handleGenericAction('psservice', { action: 'query' })} />
                <ActionButton icon={FileCode} label="Event Log (System)" onClick={() => handleGenericAction('psloglist', { kind: 'system' })} />
                <ActionButton icon={FileLock} label="Opened Files" onClick={() => handleGenericAction('psfile')} />
                <ActionButton icon={Fingerprint} label="Get SID" onClick={() => handleGenericAction('psgetsid')} />
              </div>
            </div>

            <Separator />
            
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Power Management</h4>
                <div className="grid grid-cols-1 gap-2">
                    <ActionButton icon={RefreshCw} label="Restart" onClick={() => handleGenericAction('psshutdown', { action: 'restart' })} />
                    <ActionButton icon={PowerOff} label="Shutdown" onClick={() => handleGenericAction('psshutdown', { action: 'shutdown' })} variant="destructive" />
                    <ActionButton icon={UserX} label="Logoff User" onClick={() => handleGenericAction('psshutdown', { action: 'logoff' })} variant="destructive" />
                </div>
            </div>

             <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Advanced Actions</h4>
                <div className="grid grid-cols-1 gap-2">
                    <ActionButton icon={Zap} label="Force GPUpdate" onClick={() => handleGenericAction('psexec', { cmd: 'gpupdate /force' })} />
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
                                handleGenericAction('psexec', { cmd });
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

    {/* Generic Dialog for showing command outputs */}
    <CommandOutputDialog 
        state={dialogState}
        onClose={() => setDialogState(prev => ({...prev, isOpen: false}))}
        onServiceAction={handleServiceAction}
        onServiceInfo={(service) => setServiceInfo(service)}
        onProcessKill={handleProcessKill}
        onBrowseAction={handleBrowseAction}
        browsePath={browsePath}
    />
    {/* Dialog for showing specific service info */}
     <ServiceInfoDialog 
        service={serviceInfo}
        onClose={() => setServiceInfo(null)}
     />
     {/* Dialog for showing detailed error logs from diagnostics */}
     <AlertDialog open={!!logDetail} onOpenChange={(open) => !open && setLogDetail(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{logDetail?.title}</AlertDialogTitle>
                <AlertDialogDescription>
                    The following technical details were returned from the server.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
                readOnly
                value={logDetail?.content || "No details available."}
                className="h-60 text-xs font-mono bg-muted"
            />
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setLogDetail(null)}>Close</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

    