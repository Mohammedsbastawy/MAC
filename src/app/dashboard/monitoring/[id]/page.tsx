

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
import { Loader2, ServerCrash, Cpu, MemoryStick, ArrowLeft, HardDrive } from "lucide-react";
import type { PerformanceData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDeviceContext } from "@/hooks/use-device-context";
import { Progress } from "@/components/ui/progress";


const ChartCard: React.FC<{
    title: string;
    currentValue: string;
    description: string;
    data: any[];
    dataKey: string;
    unit: string;
    icon: React.ElementType;
}> = ({ title, currentValue, description, data, dataKey, unit, icon: Icon }) => (
     <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>{title}</CardTitle>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold">{currentValue}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="h-64 w-full">
                <ResponsiveContainer>
                    <AreaChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
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
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis unit={unit} fontSize={12} tickLine={false} axisLine={false}/>
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
  const { devices, fetchLiveData } = useDeviceContext();
  const [history, setHistory] = React.useState<PerformanceData[]>([]);
  const [liveData, setLiveData] = React.useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = React.useState(true);

  const deviceId = decodeURIComponent(params.id);
  const device = React.useMemo(() => devices.find(d => d.id === deviceId), [devices, deviceId]);

  const fetchInitialData = React.useCallback(async () => {
    if (!device) return;

    setIsLoading(true);
    setError(null);

    try {
        const historyRes = await fetch("/api/network/get-historical-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: deviceId }),
        });
        const historyData = await historyRes.json();
        if (historyData.ok) {
            setHistory(historyData.history);
        } else {
            throw new Error(historyData.error || "Failed to fetch historical data.");
        }
        
        const liveRes = await fetch("/api/network/fetch-live-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: deviceId, ip: device.ipAddress }),
        });
        const liveDataResult = await liveRes.json();
        if (liveDataResult.ok && liveDataResult.liveData) {
            setLiveData(liveDataResult.liveData);
            // Also update the context
            fetchLiveData(deviceId, device.ipAddress);
        } else {
            throw new Error(liveDataResult.error || "Failed to fetch live data.");
        }
    } catch (err: any) {
        setError(err.message || "An error occurred.");
    } finally {
        setIsLoading(false);
    }
  }, [deviceId, device, fetchLiveData]);
  
  // Effect for initial data load
  React.useEffect(() => {
    if (device) {
        fetchInitialData();
    } else if (devices.length > 0 && !device) {
      setError("The specified device could not be found. It may have been removed from Active Directory.");
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, devices.length]);
  
  // Effect for periodic refresh
  React.useEffect(() => {
    if (!isAutoRefresh || !device?.ipAddress) return;

    const intervalId = setInterval(async () => {
        try {
            const liveRes = await fetch("/api/network/fetch-live-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: deviceId, ip: device.ipAddress }),
            });
            const liveDataResult = await liveRes.json();
            if (liveDataResult.ok && liveDataResult.liveData) {
                const newPoint: PerformanceData = {
                    ...liveDataResult.liveData,
                    cpuUsage: parseFloat(liveDataResult.liveData.cpuUsage?.toFixed(2) || 0),
                    usedMemoryGB: parseFloat(liveDataResult.liveData.usedMemoryGB?.toFixed(2) || 0),
                };
                setLiveData(newPoint);
                setHistory(prev => {
                    const newHistory = [...prev, newPoint].filter(
                      (p, index, self) => index === self.findIndex((t) => t.timestamp === p.timestamp)
                    );
                    const maxHistoryLength = (24 * 60 * 7) + 1; // 7 days of 1-minute intervals
                    return newHistory.slice(-maxHistoryLength);
                });
                fetchLiveData(deviceId, device.ipAddress); // Update context
            }
        } catch (e) {
            console.error("Background refresh failed:", e);
        }
    }, 60000); // Refresh every 1 minute
    
    return () => clearInterval(intervalId);
  }, [isAutoRefresh, device, deviceId, fetchLiveData]);

  
  const showLoadingState = isLoading;
  const showErrorState = !isLoading && error && history.length === 0 && !liveData;


  if (showLoadingState) {
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
                            Loading data for device...
                        </p>
                    </div>
                </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                 <Card className="h-[350px]"><CardContent className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></CardContent></Card>
                 <Card className="h-[350px]"><CardContent className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></CardContent></Card>
                 <Card className="h-[350px]"><CardContent className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></CardContent></Card>
            </div>
        </div>
      )
  }

  if (showErrorState) {
      return (
         <Alert variant="destructive">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            {error}
            <Button asChild variant="link" className="p-0 h-auto ml-2">
                <Link href="/dashboard/monitoring">Return to list</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )
  }

  const latestDataPoint = liveData || (history.length > 0 ? history[history.length - 1] : null);

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
                        Real-time performance data for <span className="font-semibold text-primary">{device?.name || "Unknown Device"}</span>
                    </p>
                </div>
            </div>
             <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full animate-pulse", isAutoRefresh && !error ? 'bg-green-500' : 'bg-yellow-500')} />
                <span className="text-sm text-muted-foreground">
                        {isAutoRefresh && !error ? `Live (Updated: ${latestDataPoint ? new Date(latestDataPoint.timestamp).toLocaleTimeString() : 'N/A'})` : "Paused"}
                </span>
                <Button variant="outline" size="sm" onClick={() => setIsAutoRefresh(!isAutoRefresh)} className="ml-4">
                    {isAutoRefresh ? "Pause Refresh" : "Resume Refresh"}
                </Button>
            </div>
        </div>
      
      {history.length === 0 && !liveData ? (
         <Alert>
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>Could not retrieve any performance data for this device. Ensure the agent is deployed and the device is online.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartCard
                    icon={Cpu}
                    title="CPU Usage"
                    currentValue={`${latestDataPoint?.cpuUsage?.toFixed(2) ?? 'N/A'}%`}
                    description={`Last updated: ${latestDataPoint ? new Date(latestDataPoint.timestamp).toLocaleTimeString() : 'N/A'}`}
                    data={history}
                    dataKey="cpuUsage"
                    unit="%"
                />
                <ChartCard
                    icon={MemoryStick}
                    title="Used Memory"
                    currentValue={`${latestDataPoint?.usedMemoryGB?.toFixed(2) ?? 'N/A'} GB`}
                    description={`Total: ${latestDataPoint?.totalMemoryGB ? latestDataPoint.totalMemoryGB.toFixed(2) : 'N/A'} GB`}
                    data={history}
                    dataKey="usedMemoryGB"
                    unit="GB"
                />
            </div>
            <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HardDrive />
                        Disk Usage
                    </CardTitle>
                     <CardDescription>
                        Free space on local drives as of the last update.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {latestDataPoint?.diskInfo && latestDataPoint.diskInfo.length > 0 ? latestDataPoint.diskInfo.map(disk => {
                        const usedSpace = disk.sizeGB - disk.freeGB;
                        const usagePercentage = (usedSpace / disk.sizeGB) * 100;
                        return (
                        <div key={disk.volume}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium">Disk ({disk.volume})</span>
                                <span className="text-xs text-muted-foreground">{disk.freeGB.toFixed(2)} GB Free of {disk.sizeGB.toFixed(2)} GB</span>
                            </div>
                             <Progress value={usagePercentage} className="h-2" />
                        </div>
                    )}) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No disk information available.</p>
                    )}
                </CardContent>
             </Card>
        </div>
      )}
    </div>
  );
};

export default DeviceDashboardPage;
