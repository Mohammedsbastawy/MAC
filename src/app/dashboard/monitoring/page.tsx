
"use client";

import * as React from "react";
import type { Device, MonitoredDevice, PerformanceData } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Server, ServerCrash, SlidersHorizontal, RefreshCw, XCircle } from "lucide-react";
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


const cpuChartConfig = {
  cpu: { label: "CPU", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const memChartConfig = {
  memory: { label: "Memory", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;


const MonitoringCard: React.FC<{ device: MonitoredDevice }> = ({ device }) => {

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
        {device.isFetching && !device.performance ? (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        ) : performanceError ? (
           <div className="flex flex-col items-center justify-center h-48 text-destructive text-center">
                <XCircle className="h-8 w-8 mb-2" />
                <p className="font-semibold">Failed to load data</p>
                <p className="text-xs max-w-full truncate" title={performanceError}>{performanceError}</p>
            </div>
        ) : device.performance ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-center">CPU Usage</h4>
               {device.performance.cpuUsage !== null ? (
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
                        { name: "used", value: device.performance.cpuUsage, fill: "hsl(var(--chart-1))" },
                        { name: "free", value: 100 - device.performance.cpuUsage, fill: "hsl(var(--muted))" },
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
               <p className="text-center font-bold text-lg">{device.performance.cpuUsage.toFixed(1)}%</p>
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
                {device.performance.usedMemoryGB.toFixed(2)} / {device.performance.totalMemoryGB.toFixed(2)} GB
               </p>
               </>
               ) : (
                 <div className="flex items-center justify-center h-[124px] text-muted-foreground text-xs">No data</div>
               )}
            </div>
             <div className="col-span-2">
                <h4 className="text-sm font-semibold mb-2 text-center">Disk Usage</h4>
                 {device.performance.diskInfo && device.performance.diskInfo.length > 0 ? (
                    <ChartContainer config={{}} className="h-40 w-full">
                        <BarChart data={device.performance.diskInfo.map(d => ({...d, used: d.sizeGB - d.freeGB}))} layout="vertical" margin={{left: 10}}>
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

  const fetchDevicePerformance = React.useCallback(async (device: MonitoredDevice) => {
    // Set isFetching to true for the specific device, but keep old performance data
    setDevices(prev => prev.map(d => d.id === device.id ? { ...d, isFetching: true } : d));

    const maxRetries = 2; // Try original + 2 retries
    let attempt = 0;
    
    while (attempt <= maxRetries) {
        try {
            const res = await fetch("/api/pstools/psinfo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ip: device.ipAddress, id: device.id, name: device.name })
            });
            const data = await res.json();

            if (data.ok && data.structured_data?.psinfo) {
                const perf = data.structured_data.psinfo;
                const newPerfData: PerformanceData = {
                    cpuUsage: parseFloat(perf.performance_info.find((p:any) => p.key === "CPU Usage")?.value || 0),
                    totalMemoryGB: parseFloat(perf.system_info.find((p:any) => p.key === "Total Memory")?.value || 0),
                    usedMemoryGB: parseFloat(perf.performance_info.find((p:any) => p.key === "Used Memory")?.value || 0),
                    diskInfo: Array.isArray(perf.disk_info) ? perf.disk_info.map((d: any) => ({
                        volume: d.volume,
                        sizeGB: parseFloat(d.sizeGB) || 0,
                        freeGB: parseFloat(d.freeGB) || 0,
                    })) : []
                }
                setDevices(prev => prev.map(d => d.id === device.id ? {...d, performance: newPerfData, isFetching: false, performanceError: null} : d));
                return; // Success, exit the loop
            } else {
                throw new Error(data.error || data.stderr || "Failed to parse performance data.");
            }
        } catch (e: any) {
            console.error(`Attempt ${attempt + 1} failed for ${device.name}:`, e);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
                attempt++;
            } else {
                const errorMessage = e.message || "An unknown error occurred.";
                setDevices(prev => prev.map(d => d.id === device.id ? {...d, isFetching: false, performance: undefined, performanceError: errorMessage} : d));
                return; // Max retries reached, exit
            }
        }
    }
  }, []);

  const fetchInitialDeviceList = React.useCallback(async (forceRefresh = false) => {
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
          body: JSON.stringify({ force_refresh: forceRefresh })
        });
        const data = await response.json();
        
        if (data.ok) {
            setDevices(prevDevices => {
                const existingDeviceMap = new Map(prevDevices.map(d => [d.id, d]));
                const newDevices = data.devices.map((newDevice: MonitoredDevice) => {
                    const existingDevice = existingDeviceMap.get(newDevice.id);
                    return {
                        ...existingDevice,
                        ...newDevice,
                        isFetching: newDevice.status === 'online',
                    };
                });
                return newDevices;
            });
            
            if (data.last_updated) {
              setLastUpdated(data.last_updated);
            }

            if (forceRefresh) {
                toast({ title: "Success", description: "Device status has been refreshed." });
            }

            const onlineDevices = data.devices.filter((d: MonitoredDevice) => d.status === 'online');
            onlineDevices.forEach((device: MonitoredDevice) => {
                fetchDevicePerformance(device);
            });

        } else {
            setError(data.message || "Failed to fetch monitoring data.");
        }
      } catch (err) {
        setError("Failed to connect to the backend server.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
  }, [toast, fetchDevicePerformance]);


  // Initial fetch
  React.useEffect(() => {
    if (user) {
        fetchInitialDeviceList(false);
    }
  }, [user, fetchInitialDeviceList]);

  // Auto-refresh logic
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh && user) {
        interval = setInterval(() => fetchInitialDeviceList(true), 30000); // Force refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
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
           <Button onClick={() => fetchInitialDeviceList(false)} className="mt-4">Retry</Button>
        </Alert>
      </div>
    );
  }

  return (
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
            <Button onClick={() => fetchInitialDeviceList(true)} disabled={isRefreshing}>
                {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Force Refresh
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {devices.map((device) => (
          <MonitoringCard key={device.id} device={device} />
        ))}
      </div>
    </div>
  );
}
