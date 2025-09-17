


"use client"

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ServerCrash, Cpu, MemoryStick, ArrowLeft } from "lucide-react";
import type { PerformanceData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDeviceContext } from "@/hooks/use-device-context";


const ChartCard: React.FC<{
    title: string;
    description: string;
    data: any[];
    dataKey: string;
    unit: string;
    icon: React.ElementType;
}> = ({ title, description, data, dataKey, unit, icon: Icon }) => (
    <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-muted-foreground" />
                {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="h-64 w-full">
                <ResponsiveContainer>
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="timestamp" 
                            tickFormatter={(timeStr) => new Date(timeStr).toLocaleTimeString()}
                            fontSize={12}
                        />
                        <YAxis unit={unit} fontSize={12} />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'hsl(var(--background))', 
                                border: '1px solid hsl(var(--border))'
                            }}
                            labelFormatter={(label) => new Date(label).toLocaleString()}
                        />
                        <Area 
                            type="monotone" 
                            dataKey={dataKey} 
                            stroke="hsl(var(--primary))" 
                            fillOpacity={1} 
                            fill={`url(#color${dataKey})`} 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </CardContent>
    </Card>
);

const DeviceDashboardPage = ({ params }: { params: { id: string } }) => {
  const { devices, updateDeviceData } = useDeviceContext();
  const [history, setHistory] = React.useState<PerformanceData[]>([]);
  const [liveData, setLiveData] = React.useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = React.useState(true);

  const deviceId = decodeURIComponent(params.id);
  
  // Find the device from the global context
  const device = React.useMemo(() => devices.find(d => d.id === deviceId), [devices, deviceId]);

  const fetchLiveData = React.useCallback(async () => {
    if (!device?.ipAddress) return;

    try {
        const res = await fetch("/api/network/fetch-live-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: deviceId, ip: device.ipAddress }),
        });
        const data = await res.json();

        if(data.ok && data.liveData) {
            const newPoint = {
                ...data.liveData,
                cpuUsage: parseFloat(data.liveData.cpuUsage?.toFixed(2) || 0),
                usedMemoryGB: parseFloat(data.liveData.usedMemoryGB?.toFixed(2) || 0),
            };
            setLiveData(newPoint);
            setHistory(prev => {
                const newHistory = [...prev, newPoint];
                return newHistory.slice(-1440); // Keep last ~24h
            });
            // Update the global context with the new timestamp
            updateDeviceData(deviceId, { agentLastUpdate: newPoint.timestamp });
            setError(null);
        } else {
            setError(data.error || "Failed to fetch live update.");
        }
    } catch (err) {
        setError("An error occurred while fetching live data from the server.");
    }
  }, [deviceId, device, updateDeviceData]);

  const fetchInitialData = React.useCallback(async () => {
    if (!device) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/network/get-historical-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deviceId }),
      });
      const data = await res.json();
      if (data.ok) {
        setHistory(data.history);
        if (data.history.length > 0) {
            setLiveData(data.history[data.history.length - 1]);
        } else {
            // If no history, fetch live data immediately
            fetchLiveData();
        }
      } else {
        throw new Error(data.error || "Failed to fetch historical data.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, device, fetchLiveData]);

  // Effect to get initial data when device is found in context
  React.useEffect(() => {
    if (device) {
        fetchInitialData();
    } else {
        // This can happen on a hard refresh, the context might not be populated yet.
        // The context itself will fetch all devices, and this component will re-render.
        setIsLoading(true); 
    }
  }, [device, fetchInitialData]);

  // Set up the interval for auto-refresh
  React.useEffect(() => {
    if (!isLoading && isAutoRefresh && device?.ipAddress) {
        const intervalId = setInterval(() => {
            fetchLiveData();
        }, 60000); // Refresh every 1 minute
        return () => clearInterval(intervalId);
    }
  }, [isAutoRefresh, isLoading, fetchLiveData, device]);
  
  if (!device && isLoading) {
     return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-2">Loading device information...</p>
        </div>
      )
  }

  if (!device && !isLoading) {
      return (
         <Alert variant="destructive">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Device Not Found</AlertTitle>
          <AlertDescription>
            The specified device could not be found. It may have been removed from Active Directory.
            <Button asChild variant="link" className="p-0 h-auto ml-2">
                <Link href="/dashboard/monitoring">Return to list</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )
  }


  const latestData = history.length > 0 ? history[history.length-1] : null;

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
                <Button asChild variant="outline" size="icon">
                    <Link href="/dashboard/monitoring"><ArrowLeft /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">
                        Live Monitoring
                    </h1>
                    <p className="text-muted-foreground">
                        Real-time & historical performance data for <span className="font-semibold text-primary">{device?.name || "Unknown Device"}</span>
                    </p>
                </div>
            </div>
             <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full animate-pulse", isAutoRefresh && !error ? 'bg-green-500' : 'bg-yellow-500')} />
                <span className="text-sm text-muted-foreground">
                        {isAutoRefresh && !error ? "Live" : "Paused"}
                </span>
                <Button variant="outline" size="sm" onClick={() => setIsAutoRefresh(!isAutoRefresh)} className="ml-4">
                    {isAutoRefresh ? "Pause Refresh" : "Resume Refresh"}
                </Button>
            </div>
        </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-2">Fetching performance data...</p>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : history.length === 0 ? (
         <Alert>
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>Could not retrieve any performance data for this device. Ensure the agent is deployed and the device is online.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <ChartCard
                icon={Cpu}
                title="CPU Usage"
                description={`Current: ${latestData?.cpuUsage?.toFixed(2) ?? 'N/A'}%`}
                data={history}
                dataKey="cpuUsage"
                unit="%"
            />
             <ChartCard
                icon={MemoryStick}
                title="Used Memory"
                description={`Current: ${latestData?.usedMemoryGB?.toFixed(2) ?? 'N/A'} MB / Total: ${latestData?.totalMemoryGB ?? 'N/A'} MB`}
                data={history}
                dataKey="usedMemoryGB"
                unit="MB"
            />
             <Card className="md:col-span-2 lg:col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Disk Usage
                    </CardTitle>
                     <CardDescription>
                        Free space on local drives as of the last update.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {latestData?.diskInfo.map(disk => (
                        <div key={disk.volume}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium">{disk.volume}</span>
                                <span className="text-xs text-muted-foreground">{disk.freeGB} GB Free</span>
                            </div>
                             <div className="w-full bg-muted rounded-full h-2.5">
                                <div 
                                    className="bg-primary h-2.5 rounded-full" 
                                    style={{ width: `${((disk.sizeGB - disk.freeGB) / disk.sizeGB) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </CardContent>
             </Card>
        </div>
      )}
    </div>
  );
};

export default DeviceDashboardPage;
