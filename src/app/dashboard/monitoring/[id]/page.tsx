

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
import { useDeviceContext } from "@/hooks/use-device-context";
import { Progress } from "@/components/ui/progress";


const DataCard: React.FC<{
    title: string;
    value: string;
    description: string;
    icon: React.ElementType;
}> = ({ title, value, description, icon: Icon }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
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

  const fetchInitialData = React.useCallback(async (id: string, ip?: string) => {
    if (!ip) {
      setError("Device IP address is not available.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
        const historyRes = await fetch("/api/network/get-historical-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id }),
        });
        const historyData = await historyRes.json();
        if (historyData.ok) {
            setHistory(historyData.history);
        } else {
             // Don't throw, just log it, as live data might still work
            console.error("Failed to fetch historical data:", historyData.error);
        }
        
        const { success, error: liveError } = await fetchLiveData(deviceId, ip);
        if (!success) {
           throw new Error(liveError || "Failed to fetch live data.");
        }
        
        // After fetchLiveData, the history might be updated. Refetch it one more time.
        const finalHistoryRes = await fetch("/api/network/get-historical-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id }),
        });
        const finalHistoryData = await finalHistoryRes.json();
        if (finalHistoryData.ok) {
            setHistory(finalHistoryData.history);
             if (finalHistoryData.history.length > 0) {
                setLiveData(finalHistoryData.history[finalHistoryData.history.length-1]);
             }
        }

    } catch (err: any) {
        setError(err.message || "An error occurred.");
    } finally {
        setIsLoading(false);
    }
  }, [fetchLiveData, deviceId]);
  
  // Effect for initial data load
  React.useEffect(() => {
    if (device?.ipAddress && isLoading) {
        fetchInitialData(deviceId, device.ipAddress);
    } else if (devices.length > 0 && !device) {
      setError("The specified device could not be found. It may have been removed from Active Directory.");
      setIsLoading(false);
    }
  }, [deviceId, device, devices.length, fetchInitialData, isLoading]);
  
  // Effect for periodic refresh
  React.useEffect(() => {
    if (!isAutoRefresh || !device?.ipAddress) return;

    const intervalId = setInterval(async () => {
        try {
            const { success } = await fetchLiveData(deviceId, device.ipAddress);
            if (success) {
                // If fetchLiveData was successful, it updated the context.
                // Now we need to update the local state for the chart.
                // We'll refetch history which now includes the latest point.
                const historyRes = await fetch("/api/network/get-historical-data", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: deviceId }),
                });
                const historyData = await historyRes.json();
                if (historyData.ok) {
                    setHistory(historyData.history);
                    if (historyData.history.length > 0) {
                      setLiveData(historyData.history[historyData.history.length-1]);
                    }
                }
            }
        } catch (e) {
            console.error("Background refresh failed:", e);
            setIsAutoRefresh(false); // Stop refresh on error
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
                 <Card className="h-[120px]"><CardContent className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></CardContent></Card>
                 <Card className="h-[120px]"><CardContent className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></CardContent></Card>
                 <Card className="h-[240px] lg:row-span-2"><CardContent className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></CardContent></Card>
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
            <DataCard
                icon={Cpu}
                title="CPU Usage"
                value={`${latestDataPoint?.cpuUsage?.toFixed(2) ?? 'N/A'}%`}
                description={`Last updated: ${latestDataPoint ? new Date(latestDataPoint.timestamp).toLocaleTimeString() : 'N/A'}`}
            />
            <DataCard
                icon={MemoryStick}
                title="Used Memory"
                value={`${latestDataPoint?.usedMemoryGB?.toFixed(2) ?? 'N/A'} GB`}
                description={`Total: ${latestDataPoint?.totalMemoryGB ? latestDataPoint.totalMemoryGB.toFixed(2) : 'N/A'} GB`}
            />
            <Card className="lg:col-span-1 row-span-2">
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
                        const usagePercentage = disk.sizeGB > 0 ? (usedSpace / disk.sizeGB) * 100 : 0;
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
