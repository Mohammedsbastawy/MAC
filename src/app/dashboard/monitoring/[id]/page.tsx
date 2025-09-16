

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

const GaugeCard: React.FC<{
    icon: React.ElementType,
    title: string,
    value: string | number,
    unit: string,
    description: string,
}> = ({ icon: Icon, title, value, unit, description }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground font-medium">
                <Icon className="h-5 w-5" />
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex items-baseline gap-2">
                <p className="text-6xl font-bold tracking-tight">{value}</p>
                <span className="text-2xl text-muted-foreground">{unit}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{description}</p>
        </CardContent>
    </Card>
);


const DeviceDashboardPage = ({ params }: { params: { id: string } }) => {
  const [liveData, setLiveData] = React.useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = React.useState<{name: string, ip: string}>({name: '', ip: ''});
  const [isAutoRefresh, setIsAutoRefresh] = React.useState(true);

  const deviceId = decodeURIComponent(params.id);

  const fetchLiveData = React.useCallback(async (isInitialLoad = false) => {
    if(isInitialLoad) setIsLoading(true);
    setError(null);
    
    if (!deviceInfo.ip) {
        if(isInitialLoad) {
            setError("Could not determine the IP address for this device. Please go back and select the device again.");
            setIsLoading(false);
        }
        return;
    }

    try {
        const res = await fetch("/api/network/fetch-live-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: deviceId, ip: deviceInfo.ip }),
        });
        const data = await res.json();

        if(data.ok && data.liveData) {
            setLiveData({
                ...data.liveData,
                cpuUsage: parseFloat(data.liveData.cpuUsage?.toFixed(2) || 0),
                usedMemoryGB: parseFloat(data.liveData.usedMemoryGB?.toFixed(2) || 0),
            });
             setError(null);
        } else {
            setError(data.error || "Failed to fetch live update.");
        }
    } catch (err) {
        setError("An error occurred while fetching live data from the server.");
    } finally {
        if(isInitialLoad) setIsLoading(false);
    }
  }, [deviceId, deviceInfo.ip]);


  // Effect to get device name and IP on initial load
  React.useEffect(() => {
    // Fetch the full device list to find the IP of the current device.
    const findDeviceIp = async () => {
        try {
            const response = await fetch("/api/ad/get-computers", { method: "POST" });
            const data = await response.json();
            if (data.ok) {
                const foundDevice = data.computers.find((d: any) => d.dn === deviceId);
                if (foundDevice) {
                    setDeviceInfo({ name: foundDevice.name, ip: foundDevice.dns_hostname });
                } else {
                     setError("Device not found in Active Directory list.");
                     setIsLoading(false);
                }
            } else {
                setError("Could not fetch device list to find IP address.");
                setIsLoading(false);
            }
        } catch(e) {
             setError("Failed to connect to the server to look up device info.");
             setIsLoading(false);
        }
    };
    findDeviceIp();
  }, [deviceId]);

  // Initial data fetch once IP is available
  React.useEffect(() => {
    if (deviceInfo.ip) {
        fetchLiveData(true);
    }
  }, [deviceInfo.ip, fetchLiveData]); 

  // Set up the interval for auto-refresh
  React.useEffect(() => {
    if (!isLoading && isAutoRefresh && deviceInfo.ip) {
        const intervalId = setInterval(() => {
            fetchLiveData(false);
        }, 60000); // Refresh every 1 minute
        return () => clearInterval(intervalId);
    }
  }, [isAutoRefresh, isLoading, fetchLiveData, deviceInfo.ip]);


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
                        Real-time performance data for <span className="font-semibold text-primary">{deviceInfo.name || "Unknown Device"}</span>
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
          <p className="ml-2">Fetching live performance data...</p>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !liveData ? (
         <Alert>
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>Could not retrieve performance data for this device. Ensure the agent is deployed and the device is online.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <GaugeCard
                icon={Cpu}
                title="CPU Usage"
                value={liveData.cpuUsage}
                unit="%"
                description={`Last updated: ${new Date(liveData.timestamp).toLocaleTimeString()}`}
            />
            <GaugeCard
                icon={MemoryStick}
                title="Used Memory"
                value={liveData.usedMemoryGB}
                unit="MB"
                description={`Total: ${liveData.totalMemoryGB} MB`}
            />
             <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-muted-foreground font-medium">
                        Disk Usage
                    </CardTitle>
                     <CardDescription>
                        Free space on local drives.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {liveData.diskInfo.map(disk => (
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
