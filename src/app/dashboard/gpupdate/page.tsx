"use client";

import * as React from "react";
import { CheckCircle2, ChevronRight, CircleDashed, Laptop, Loader2, Monitor, Router, Server, Smartphone, ToyBrick, XCircle, Zap, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Device } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const ICONS: Record<Device["type"], React.ElementType> = {
  laptop: Laptop,
  server: Server,
  router: Router,
  mobile: Smartphone,
  desktop: Monitor,
  iot: ToyBrick,
  unknown: Laptop,
};

type Result = {
    ip: string;
    name: string;
    success: boolean;
    output: string;
}

export default function GpUpdatePage() {
    const { user, isLoading: authLoading } = useAuth();
    const [devices, setDevices] = React.useState<Device[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [selectedDevices, setSelectedDevices] = React.useState<Record<string, boolean>>({});
    const [isExecuting, setIsExecuting] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [results, setResults] = React.useState<Result[]>([]);

    React.useEffect(() => {
        if (user) {
            const fetchDevices = async () => {
                try {
                    setIsLoading(true);
                    const res = await fetch("/api/devices", { method: 'POST' });
                    const data = await res.json();
                    if (data.ok) {
                        setDevices(data.devices);
                    } else {
                        console.error("Failed to fetch devices:", data.error);
                    }
                } catch (error) {
                    console.error("Error fetching devices:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchDevices();
        }
    }, [user]);

    const handleSelectAll = (checked: boolean) => {
        const newSelection: Record<string, boolean> = {};
        if (checked) {
            devices.forEach(d => { newSelection[d.ipAddress] = true; });
        }
        setSelectedDevices(newSelection);
    }
    const selectedCount = Object.values(selectedDevices).filter(Boolean).length;
    
    const handleRunGpUpdate = async () => {
        const targets = Object.keys(selectedDevices).filter(ip => selectedDevices[ip]);
        if (targets.length === 0) return;

        setIsExecuting(true);
        setProgress(0);
        setResults([]);

        const newResults: Result[] = [];

        for (let i = 0; i < targets.length; i++) {
            const ip = targets[i];
            const deviceName = devices.find(d => d.ipAddress === ip)?.name || ip;
            try {
                const response = await fetch('/api/psexec', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip, cmd: "gpupdate /force" }),
                });
                const result = await response.json();
                
                newResults.push({
                    ip,
                    name: deviceName,
                    success: result.rc === 0,
                    output: result.stdout || result.stderr
                });

            } catch (error: any) {
                 newResults.push({
                    ip,
                    name: deviceName,
                    success: false,
                    output: error.message || "A client-side error occurred."
                });
            }
            setResults([...newResults]);
            setProgress(((i + 1) / targets.length) * 100);
        }
        setIsExecuting(false);
    }
    
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl flex items-center gap-2">
                    <Zap /> Mass GpUpdate Tool
                </h1>
                <p className="text-muted-foreground">
                    Select devices from your network to apply a `gpupdate /force` command simultaneously.
                </p>
            </div>
            
            {isExecuting && (
                <Card>
                    <CardHeader>
                        <CardTitle>Execution in Progress...</CardTitle>
                        <CardDescription>
                            Running `gpupdate /force` on {selectedCount} device(s). Please wait.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Progress value={progress} />
                        <p className="text-sm text-muted-foreground text-center">
                            Completed {results.length} of {selectedCount} devices.
                        </p>
                    </CardContent>
                </Card>
            )}

            {!isExecuting && results.length > 0 && (
                <Card>
                     <CardHeader>
                        <CardTitle>Execution Complete</CardTitle>
                        <CardDescription>
                            Finished running `gpupdate /force` on {selectedCount} device(s).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Alert className="border-green-500 bg-green-500/10">
                            <CheckCircle2 className="h-4 w-4 !text-green-500" />
                            <AlertTitle className="text-green-600">Successful: {successfulResults.length}</AlertTitle>
                            <AlertDescription>
                                The command completed successfully on these devices.
                            </AlertDescription>
                        </Alert>
                         <Alert variant="destructive" className="border-red-500 bg-red-500/10">
                            <AlertTriangle className="h-4 w-4 !text-red-500" />
                            <AlertTitle className="text-red-600">Failed: {failedResults.length}</AlertTitle>
                            <AlertDescription>
                               The command failed on these devices. Check logs for details.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={() => setResults([])}>Run Again</Button>
                    </CardFooter>
                </Card>
            )}

            <div className={cn("space-y-4", (isExecuting || results.length > 0) && "hidden")}>
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                             <div>
                                <CardTitle>1. Select Target Devices</CardTitle>
                                <CardDescription>Choose the devices to include in the operation.</CardDescription>
                             </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="select-all" 
                                    onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                                    checked={devices.length > 0 && selectedCount === devices.length}
                                />
                                <Label htmlFor="select-all">Select All</Label>
                             </div>
                        </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {isLoading ? (
                            [...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
                        ) : devices.length === 0 ? (
                            <div className="col-span-full text-center text-muted-foreground py-10">
                                No devices found. Please scan for devices on the Network Devices page first.
                            </div>
                        ) : (
                            devices.map(device => {
                                const Icon = ICONS[device.type] || Laptop;
                                return (
                                <Label 
                                    key={device.id}
                                    htmlFor={`device-${device.id}`}
                                    className={cn(
                                        "block cursor-pointer rounded-lg border p-4 transition-all",
                                        selectedDevices[device.ipAddress] && "ring-2 ring-primary border-primary"
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <h4 className="font-semibold">{device.name}</h4>
                                            <p className="text-sm text-muted-foreground font-mono">{device.ipAddress}</p>
                                        </div>
                                         <Checkbox 
                                            id={`device-${device.id}`} 
                                            checked={!!selectedDevices[device.ipAddress]}
                                            onCheckedChange={(checked) => setSelectedDevices(prev => ({...prev, [device.ipAddress]: !!checked}))}
                                        />
                                    </div>
                                    <div className="flex items-center text-xs text-muted-foreground mt-2">
                                        <Icon className="h-4 w-4 mr-2" /> {device.os}
                                    </div>
                                </Label>
                            )})
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. Execute Command</CardTitle>
                        <CardDescription>
                           This will run `gpupdate /force` on all selected devices. This action cannot be undone.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        You have selected <strong>{selectedCount}</strong> device(s).
                    </CardContent>
                    <CardFooter>
                         <Button size="lg" onClick={handleRunGpUpdate} disabled={selectedCount === 0 || isExecuting}>
                            {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Run GpUpdate
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            {results.length > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Execution Logs</CardTitle>
                        <CardDescription>Detailed output from each device.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Accordion type="multiple" className="w-full">
                            {results.map(result => (
                                <AccordionItem value={result.ip} key={result.ip}>
                                    <AccordionTrigger className={cn(
                                        "text-sm font-medium",
                                        result.success ? "text-green-600" : "text-red-600"
                                    )}>
                                        <div className="flex items-center gap-2">
                                            {result.success ? <CheckCircle2 /> : <XCircle />}
                                            <span>{result.name} ({result.ip}) - {result.success ? 'Success' : 'Failed'}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <Textarea
                                            readOnly
                                            value={result.output}
                                            className="font-mono text-xs h-48 bg-muted"
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                 </Card>
            )}
        </div>
    );
}
