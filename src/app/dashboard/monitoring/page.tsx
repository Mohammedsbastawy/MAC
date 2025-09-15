

"use client";

import * as React from "react";
import type { Device, MonitoredDevice, PerformanceData } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Server, ServerCrash, SlidersHorizontal, RefreshCw, XCircle, ShieldCheck, Zap, HelpCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WinRMDiagnosticsDialog, type WinRMDiagnosticsState } from "@/components/dashboard/device-actions-panel";

const cpuChartConfig = {
  cpu: { label: "CPU", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const memChartConfig = {
  memory: { label: "Memory", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;


const MonitoringCard: React.FC<{ 
    device: MonitoredDevice, 
    onRunDiagnostics: (device: MonitoredDevice) => void,
    onDeployAgent: (device: MonitoredDevice) => void,
}> = ({ device, onRunDiagnostics, onDeployAgent }) => {

  const { performance, status, performanceError } = device;

  const memData = (performance && performance.totalMemoryGB > 0)
    ? [
        {
          name: "Used",
          value: performance.usedMemoryGB,
          fill: "hsl(var(--chart-2))",
        },
        {
          name: "Free",
          value: performance.totalMemoryGB - performance.usedMemoryGB,
          fill: "hsl(var(--muted))",
        },
      ]
    : [];

  const memPercentage = (performance && performance.totalMemoryGB > 0)
    ? (performance.usedMemoryGB / performance.totalMemoryGB) * 100
    : 0;
    
  const isAgentNotDeployedError = performanceError && (performanceError.includes("Cannot find path") || performanceError.includes("PathNotFound"));

  return (
    <Card className={cn(status !== 'online' && "opacity-50")}>
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="text-lg hover:underline">
                 <Link href={`/dashboard/monitoring/${encodeURIComponent(device.id)}`}>
                    {device.name}
                </Link>
            </CardTitle>
          <Badge variant={status === 'online' ? 'default' : 'secondary'} className={cn(status === 'online' && 'bg-green-600')}>
            {status}
          </Badge>
        </div>
        <CardDescription>{device.ipAddress}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {device.isFetching ? (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        ) : performanceError ? (
           <div className="flex flex-col items-center justify-center h-48 text-destructive text-center p-4">
                <XCircle className="h-8 w-8 mb-2" />
                <p className="font-semibold">{isAgentNotDeployedError ? "Agent Not Deployed" : "Failed to load data"}</p>
                <p className="text-xs max-w-full truncate" title={performanceError}>
                    {isAgentNotDeployedError ? "Click below to install the monitoring agent on this device." : performanceError}
                </p>
                {isAgentNotDeployedError ? (
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => onDeployAgent(device)}>
                        <Zap className="mr-2 h-4 w-4" />
                        Deploy Agent
                    </Button>
                ) : (
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => onRunDiagnostics(device)}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Run Diagnostics
                    </Button>
                )}
            </div>
        ) : performance ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-center">CPU Usage</h4>
               {performance.cpuUsage !== null ? (
              <>
              <ChartContainer
                config={cpuChartConfig}
                className="mx-auto aspect-square h-[100px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Pie
                      data={[
                        { name: "used", value: performance.cpuUsage, fill: "hsl(var(--chart-1))" },
                        { name: "free", value: 100 - performance.cpuUsage, fill: "hsl(var(--muted))" },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={25}
                      strokeWidth={5}
                    >
                       <Cell key="used" fill="hsl(var(--chart-1))" />
                       <Cell key="free" fill="hsl(var(--muted))" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
               <p className="text-center font-bold text-lg">{performance.cpuUsage.toFixed(1)}%</p>
               </>
                ) : (
                    <div className="flex items-center justify-center h-[124px] text-muted-foreground text-xs">No data</div>
                )}
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2 text-center">Memory Usage</h4>
                {performance.totalMemoryGB > 0 ? (
                <>
              <ChartContainer
                config={memChartConfig}
                className="mx-auto aspect-square h-[100px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Pie
                      data={memData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={25}
                      strokeWidth={5}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
               <p className="text-center font-bold text-lg">{memPercentage.toFixed(1)}%</p>
               <p className="text-center text-xs text-muted-foreground">
                {performance.usedMemoryGB.toFixed(2)} / {performance.totalMemoryGB.toFixed(2)} GB
               </p>
               </>
               ) : (
                 <div className="flex items-center justify-center h-[124px] text-muted-foreground text-xs">No data</div>
               )}
            </div>
             <div className="col-span-2">
                <h4 className="text-sm font-semibold mb-2 text-center">Disk Usage</h4>
                 {performance.diskInfo && performance.diskInfo.length > 0 ? (
                    <ChartContainer config={{}} className="h-40 w-full">
                        <BarChart data={performance.diskInfo.map(d => ({...d, used: d.sizeGB - d.freeGB}))} layout="vertical" margin={{left: 10}}>
                            <CartesianGrid horizontal={false} />
                            <XAxis type="number" dataKey="sizeGB" hide/>
                            <YAxis type="category" dataKey="volume" width={40} tickLine={false} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="used" fill="hsl(var(--chart-5))" stackId="a" radius={[4, 4, 4, 4]} />
                            <Bar dataKey="freeGB" fill="hsl(var(--muted))" stackId="a" radius={[4, 4, 4, 4]} />
                        </BarChart>
                    </ChartContainer>
                 ): (
                    <p className="text-center text-xs text-muted-foreground">No disk data available.</p>
                 )}
            </div>
          </div>
        ) : (
           <div className="flex items-center justify-center h-48 text-muted-foreground text-center">
                <p>{status === 'online' ? "Awaiting performance data..." : "Device is offline."}</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function MonitoringPage() {
  const { user } = useAuth();
  const [devices, setDevices] = React.useState<MonitoredDevice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);
  const { toast } = useToast();

    // State for Diagnostics Dialog
  const [diagnosticsDevice, setDiagnosticsDevice] = React.useState<MonitoredDevice | null>(null);
  const initialDiagnosticsState: WinRMDiagnosticsState = {
    service: { status: 'checking', message: '' },
    listener: { status: 'checking', message: '' },
    firewall: { status: 'checking', message: '' },
  };
  const [diagnosticsState, setDiagnosticsState] = React.useState<WinRMDiagnosticsState>(initialDiagnosticsState);
  const [isFixing, setIsFixing] = React.useState(false);
  const [logDetail, setLogDetail] = React.useState<{ title: string, content: string } | null>(null);

  const runWinRMDiagnostics = React.useCallback(async (device: MonitoredDevice | null) => {
    if (!device) return;
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
            setDiagnosticsState({
                service: { status: 'failure', message: data.error || 'Check failed' },
                listener: { status: 'failure', message: data.error || 'Check failed' },
                firewall: { status: 'failure', message: data.error || 'Check failed' },
            });
        }
    } catch (e: any) {
         setDiagnosticsState({
            service: { status: 'failure', message: e.message || 'Client error' },
            listener: { status: 'failure', message: e.message || 'Client error' },
            firewall: { status: 'failure', message: e.message || 'Client error' },
        });
    }
  }, [initialDiagnosticsState]);


  const handleRunDiagnostics = (device: MonitoredDevice) => {
      setDiagnosticsDevice(device);
      runWinRMDiagnostics(device);
  };

  const handleFixWinRM = async () => {
    if (!diagnosticsDevice) return;
    setIsFixing(true);
    toast({ title: "Attempting to Enable WinRM...", description: `Sending commands to ${diagnosticsDevice.name}.` });
    
    try {
        const res = await fetch("/api/pstools/enable-winrm", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: diagnosticsDevice.ipAddress })
        });
        const result = await res.json();

        if (result.ok) {
            toast({ title: "Command Sent Successfully", description: "Re-running diagnostics to check the new status." });
            await new Promise(resolve => setTimeout(resolve, 5000));
            await runWinRMDiagnostics(diagnosticsDevice);
        } else {
            toast({ variant: "destructive", title: "Failed to Enable WinRM", description: result.details || result.error });
        }

    } catch (e: any) {
         toast({ variant: "destructive", title: "Client Error", description: e.message });
    }
    
    setIsFixing(false);
  };

  const handleDeployAgent = async (device: MonitoredDevice) => {
      toast({ title: "Deploying Agent...", description: `Attempting to install monitoring agent on ${device.name}. This may take a moment.` });
      try {
           const res = await fetch("/api/pstools/deploy-agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ip: device.ipAddress, name: device.name }),
            });
            const data = await res.json();
             if (data.ok) {
                toast({ title: "Deployment Successful", description: data.message });
                setDevices(prev => prev.map(d => d.id === device.id ? { ...d, isFetching: true, performanceError: null } : d));
                // Wait for the agent to run and create the file before fetching.
                await new Promise(resolve => setTimeout(resolve, 5000)); 
                await fetchDevicePerformance(device, new AbortController().signal);
            } else {
                toast({ variant: "destructive", title: "Deployment Failed", description: data.details || data.error, duration: 10000 });
            }
      } catch (e: any) {
          toast({ variant: "destructive", title: "Client Error", description: e.message });
      }
  }

  const fetchDevicePerformance = React.useCallback(async (device: MonitoredDevice, signal: AbortSignal) => {
    try {
        const res = await fetch("/api/pstools/psinfo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ip: device.ipAddress, id: device.id, name: device.name }),
            signal,
        });

        if (signal.aborted) return;

        const data = await res.json();

        if (data.ok && data.structured_data?.psinfo) {
            const perf = data.structured_data.psinfo;
            const perfData: PerformanceData = {
                cpuUsage: perf.cpuUsage,
                totalMemoryGB: perf.totalMemoryGB,
                usedMemoryGB: perf.usedMemoryGB,
                diskInfo: perf.diskInfo,
            };
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, performance: perfData, isFetching: false, performanceError: null } : d));
        } else {
             throw new Error(data.error || data.stderr || "Failed to parse performance data.");
        }
    } catch (e: any) {
         if (e.name === 'AbortError') {
            return;
        }
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, isFetching: false, performanceError: e.message || "An unknown error occurred." } : d));
    }
}, []);


  const fetchInitialDeviceList = React.useCallback(async (forceRefresh = false, signal: AbortSignal) => {
      if (!forceRefresh) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      
      try {
        const response = await fetch("/api/network/get-monitoring-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force_refresh: forceRefresh }),
          signal,
        });

        if (signal.aborted) return;

        const data = await response.json();
        
        if (data.ok) {
            const newDevices = data.devices as MonitoredDevice[];
            setDevices(newDevices);
            
            if (data.last_updated) {
              setLastUpdated(data.last_updated);
            }

            if (forceRefresh) {
                toast({ title: "Success", description: "Device status has been refreshed." });
            }

            const onlineDevices = newDevices.filter((d: MonitoredDevice) => d.status === 'online');
            
            onlineDevices.forEach((device: MonitoredDevice) => {
                fetchDevicePerformance(device, signal);
            });


        } else {
            setError(data.message || "Failed to fetch monitoring data.");
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
            setError("Failed to connect to the backend server.");
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
  }, [toast, fetchDevicePerformance]);


  React.useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    if (user) {
        fetchInitialDeviceList(false, signal);
    }

    // Cleanup function to abort requests when the component unmounts
    return () => {
        controller.abort();
    };
  }, [user, fetchInitialDeviceList]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const controller = new AbortController();
    const signal = controller.signal;

    if (autoRefresh && user) {
        interval = setInterval(() => {
            if (!document.hidden) { // Only refresh if tab is visible
                fetchInitialDeviceList(true, signal);
            }
        }, 30000);
    }
    
    // Cleanup function
    return () => {
      if (interval) clearInterval(interval);
      controller.abort();
    };
  }, [autoRefresh, user, fetchInitialDeviceList]);


  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Alert variant="destructive" className="max-w-lg">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>Please sign in to view the monitoring dashboard.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Alert variant="destructive" className="max-w-lg">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
           <Button onClick={() => {
               const controller = new AbortController();
               fetchInitialDeviceList(false, controller.signal);
           }} className="mt-4">Retry</Button>
        </Alert>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">Device Monitoring</h1>
           {lastUpdated && (
            <p className="text-muted-foreground">
              Real-time performance metrics. Last cache update: {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
                <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                <Label htmlFor="auto-refresh">Auto-Refresh (30s)</Label>
            </div>
            <Button onClick={() => {
                const controller = new AbortController();
                fetchInitialDeviceList(true, controller.signal);
            }} disabled={isRefreshing}>
                {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Force Refresh
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {devices.map((device) => (
          <MonitoringCard key={device.id} device={device} onRunDiagnostics={handleRunDiagnostics} onDeployAgent={handleDeployAgent} />
        ))}
      </div>
    </div>
    
    <Dialog open={!!diagnosticsDevice} onOpenChange={(open) => !open && setDiagnosticsDevice(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>WinRM Diagnostics for {diagnosticsDevice?.name}</DialogTitle>
                <DialogDescription>
                    Status of WinRM components on the remote host. Click on a failed item to see details.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                 <WinRMDiagnosticsDialog 
                    state={diagnosticsState} 
                    onOpenLog={(log) => setLogDetail({ title: "Error Log", content: log })} 
                    onFix={handleFixWinRM}
                    isFixing={isFixing}
                 />
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}
