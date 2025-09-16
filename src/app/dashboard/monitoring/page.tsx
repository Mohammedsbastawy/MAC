"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  ServerCrash,
  RefreshCw,
  Zap,
  Cpu,
  MemoryStick,
  AreaChart,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ADComputer, PerformanceData } from "@/lib/types";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart as RechartsAreaChart, Area as RechartsArea, XAxis } from "recharts";
import { useRouter } from "next/navigation";


type MonitoredDevice = ADComputer & {
  isFetching: boolean;
  performance?: PerformanceData;
  history?: { timestamp: string, cpuUsage: number, usedMemoryGB: number }[];
  performanceError?: string | null;
};

const chartConfig = {
  cpu: {
    label: "CPU",
    color: "hsl(var(--chart-1))",
  },
  memory: {
    label: "Memory",
    color: "hsl(var(--chart-2))",
  },
};


const DeviceMonitorCard: React.FC<{ device: MonitoredDevice; onRefresh: (name: string) => void; }> = ({ device, onRefresh }) => {
    const router = useRouter();
    const hasData = device.performance && !device.performanceError;

    const onCardClick = () => {
        if (hasData) {
            router.push(`/dashboard/monitoring/${encodeURIComponent(device.dn)}`);
        }
    }

    return (
        <Card className={hasData ? "cursor-pointer hover:border-primary" : ""} onClick={onCardClick}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg truncate" title={device.name}>{device.name}</CardTitle>
                    <Badge variant={device.performanceError ? "destructive" : "secondary"}>
                         {device.performanceError ? "No Agent" : "Monitoring"}
                    </Badge>
                </div>
                <CardDescription>{device.dns_hostname}</CardDescription>
            </CardHeader>
            <CardContent>
                {device.isFetching ? (
                     <div className="flex items-center justify-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : hasData && device.performance ? (
                    <div className="space-y-4">
                        <div className="flex justify-around">
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground">CPU Usage</p>
                                <p className="text-2xl font-bold">{device.performance.cpuUsage}%</p>
                            </div>
                             <div className="text-center">
                                <p className="text-xs text-muted-foreground">Memory</p>
                                <p className="text-2xl font-bold">{device.performance.usedMemoryGB.toFixed(1)} <span className="text-sm text-muted-foreground">/ {device.performance.totalMemoryGB.toFixed(1)} GB</span></p>
                            </div>
                        </div>
                        {device.history && device.history.length > 1 && (
                            <ChartContainer config={chartConfig} className="h-16 w-full">
                                <RechartsAreaChart
                                    accessibilityLayer
                                    data={device.history}
                                    margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="fillCpu" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--color-cpu)" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="var(--color-cpu)" stopOpacity={0.1} />
                                        </linearGradient>
                                    </defs>
                                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" hideLabel />} />
                                    <RechartsArea
                                        dataKey="cpuUsage"
                                        type="natural"
                                        fill="url(#fillCpu)"
                                        stroke="var(--color-cpu)"
                                        stackId="a"
                                    />
                                </RechartsAreaChart>
                            </ChartContainer>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center h-24 text-muted-foreground">
                        <p className="text-sm">Agent not detected or file is unreadable.</p>
                         <Link href="/dashboard/help/agent" passHref>
                            <Button variant="link" className="mt-1">
                                <Zap className="mr-2 h-4 w-4" />
                                View Deployment Guide
                            </Button>
                        </Link>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <Button variant="ghost" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); onRefresh(device.name); }} disabled={device.isFetching}>
                    {device.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh
                </Button>
            </CardFooter>
        </Card>
    )
}

export default function MonitoringPage() {
  const { user } = useAuth();
  const [devices, setDevices] = React.useState<MonitoredDevice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const fetchDeviceList = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        const res = await fetch("/api/ad/get-computers", { method: "POST" });
        const data = await res.json();
        if (data.ok) {
            const initialDevices: MonitoredDevice[] = data.computers.map((c: ADComputer) => ({
                ...c,
                isFetching: false,
                performance: undefined,
                performanceError: null,
            }));
            setDevices(initialDevices);
            fetchAllPerformanceData(initialDevices);
        } else {
            setError(data.error || "Failed to fetch device list.");
        }
    } catch (err) {
        setError("Could not connect to the server to fetch devices.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  const fetchPerformanceData = React.useCallback(async (deviceName: string, ip: string, dn: string) => {
    setDevices(prev => prev.map(d => d.name === deviceName ? { ...d, isFetching: true } : d));
    try {
        const res = await fetch("/api/pstools/psinfo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ip: ip, name: deviceName })
        });
        const data = await res.json();
        if (data.ok && data.structured_data?.psinfo) {
             const historyRes = await fetch('/api/network/get-historical-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: dn })
            });
            const historyData = await historyRes.json();
            setDevices(prev => prev.map(d => d.name === deviceName ? {
                ...d,
                isFetching: false,
                performance: data.structured_data.psinfo,
                history: historyData.ok ? historyData.history : [],
                performanceError: null,
            } : d));
        } else {
            setDevices(prev => prev.map(d => d.name === deviceName ? { ...d, isFetching: false, performance: undefined, performanceError: data.error || data.stderr || "No data" } : d));
        }
    } catch (e) {
        setDevices(prev => prev.map(d => d.name === deviceName ? { ...d, isFetching: false, performance: undefined, performanceError: "Client error fetching data." } : d));
    }
  }, []);

  const fetchAllPerformanceData = (deviceList: MonitoredDevice[]) => {
      deviceList.forEach(device => {
          if (device.dns_hostname) {
              fetchPerformanceData(device.name, device.dns_hostname, device.dn);
          } else {
               setDevices(prev => prev.map(d => d.name === device.name ? { ...d, isFetching: false, performanceError: "No IP address found in AD." } : d));
          }
      });
  };

  const handleRefreshSingle = (deviceName: string) => {
      const device = devices.find(d => d.name === deviceName);
      if (device && device.dns_hostname) {
          toast({ title: `Refreshing ${deviceName}...` });
          fetchPerformanceData(device.name, device.dns_hostname, device.dn);
      }
  };
  
  const handleRefreshAll = () => {
    toast({ title: "Refreshing all devices..."});
    fetchAllPerformanceData(devices);
  }

  React.useEffect(() => {
    if (user) {
        fetchDeviceList();
    }
  }, [user, fetchDeviceList]);


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
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">Live Device Monitoring</h1>
          <p className="text-muted-foreground">
            Live performance metrics for devices with the monitoring agent installed.
          </p>
        </div>
        <Button onClick={handleRefreshAll} disabled={isLoading || devices.some(d => d.isFetching)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh All
        </Button>
      </div>

       {error && (
         <Alert variant="destructive">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Error Loading Devices</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {devices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {devices.map((device) => (
                <DeviceMonitorCard key={device.dn} device={device} onRefresh={handleRefreshSingle} />
            ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-[calc(100vh-250px)]">
            <ServerCrash className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No Computers Found</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
                No computer objects were found in Active Directory.
            </p>
        </div>
      )}
    </div>
  );
}
