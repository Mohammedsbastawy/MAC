
"use client";

import * as React from "react";
import type { ADComputer, Device } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Server, ServerCrash, SlidersHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

const determineDeviceType = (hostname: string): Device["type"] => {
  if (!hostname) return "unknown";
  const lowerHostname = hostname.toLowerCase();
  if (lowerHostname.includes("laptop")) return "laptop";
  if (lowerHostname.includes("server")) return "server";
  if (lowerHostname.includes("router") || lowerHostname.includes("gateway"))
    return "router";
  if (lowerHostname.includes("phone") || lowerHostname.includes("mobile"))
    return "mobile";
  if (lowerHostname.includes("desktop") || lowerHostname.includes("pc"))
    return "desktop";
  if (lowerHostname.includes("iot") || lowerHostname.includes("thermostat") || lowerHostname.includes("light"))
    return "iot";
  return "unknown";
};

const mapAdComputerToDevice = (adComputer: ADComputer): Device => ({
  id: adComputer.dn,
  name: adComputer.name,
  ipAddress: adComputer.dns_hostname,
  macAddress: "-",
  status: "unknown",
  type: determineDeviceType(adComputer.name),
  os: adComputer.os,
  lastSeen: adComputer.last_logon,
  domain: adComputer.domain || "Domain",
  isDomainMember: true,
  isLoadingDetails: false,
  source: "ad",
});

const cpuChartConfig = {
  cpu: { label: "CPU", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const memChartConfig = {
  memory: { label: "Memory", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

type PerformanceData = {
  cpuUsage: number;
  totalMemoryGB: number;
  usedMemoryGB: number;
  diskInfo: {
    volume: string;
    sizeGB: number;
    freeGB: number;
  }[];
};

const MonitoringCard: React.FC<{
  device: Device & { performance?: PerformanceData };
}> = ({ device }) => {
  const { performance } = device;

  const memData = performance
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

  const memPercentage = performance
    ? (performance.usedMemoryGB / performance.totalMemoryGB) * 100
    : 0;

  return (
    <Card className={cn(device.status !== 'online' && "opacity-50")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{device.name}</CardTitle>
          <Badge variant={device.status === 'online' ? 'default' : 'secondary'} className={cn(device.status === 'online' && 'bg-green-600')}>
            {device.status}
          </Badge>
        </div>
        <CardDescription>{device.ipAddress}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {device.isLoadingDetails ? (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        ) : performance ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-center">CPU Usage</h4>
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
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2 text-center">Memory Usage</h4>
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
            </div>
             <div className="col-span-2">
                <h4 className="text-sm font-semibold mb-2 text-center">Disk Usage</h4>
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
            </div>
          </div>
        ) : (
           <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p>{device.status === 'online' ? "Click 'Refresh Data' to load." : "Device is offline."}</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function MonitoringPage() {
  const { user } = useAuth();
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const { toast } = useToast();

  const fetchInitialDevices = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ad/get-computers", { method: "POST" });
      const data = await response.json();
      if (data.ok) {
        setDevices(data.computers.map(mapAdComputerToDevice));
      } else {
        setError(data.message || "Failed to fetch devices from Active Directory.");
      }
    } catch (err) {
      setError("Failed to connect to the server to get devices.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshAllDeviceStatus = React.useCallback(async () => {
    if (isRefreshing) return;
    
    const ipsToCheck = devices.map((d) => d.ipAddress).filter(Boolean);
    if (ipsToCheck.length === 0) return;

    setIsRefreshing(true);

    try {
      const res = await fetch("/api/network/check-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ips: ipsToCheck }),
      });
      const data = await res.json();

      if (!data.ok) throw new Error(data.error || "Status check failed");
      
      const onlineIps = new Set(data.online_ips);
      const onlineDevices = devices.filter(d => onlineIps.has(d.ipAddress));

      setDevices(prev => prev.map(d => ({ ...d, status: onlineIps.has(d.ipAddress) ? 'online' : 'offline', isLoadingDetails: onlineIps.has(d.ipAddress) })));

      // Fetch performance data for online devices
      const performancePromises = onlineDevices.map(device => 
        fetch("/api/pstools/psinfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip: device.ipAddress }),
        }).then(res => res.json())
      );

      const results = await Promise.all(performancePromises);

      setDevices(prev => 
        prev.map((d, i) => {
            const onlineDeviceIndex = onlineDevices.findIndex(od => od.id === d.id);
            if (onlineDeviceIndex === -1) return { ...d, isLoadingDetails: false };

            const result = results[onlineDeviceIndex];
            let performanceData;
            if(result.ok && result.structured_data?.psinfo) {
                 const info = result.structured_data.psinfo;
                 performanceData = {
                    cpuUsage: parseFloat(info.performance_info.find((p:any) => p.key === 'CPU Usage')?.value) || 0,
                    totalMemoryGB: parseFloat(info.system_info.find((p:any) => p.key === 'Total Memory')?.value) || 0,
                    usedMemoryGB: parseFloat(info.performance_info.find((p:any) => p.key === 'Used Memory')?.value) || 0,
                    diskInfo: info.disk_info.map((disk:any) => ({
                        volume: disk.volume,
                        sizeGB: parseFloat(disk.size_gb) || 0,
                        freeGB: parseFloat(disk.free_gb) || 0
                    }))
                };
            }
          
            return { ...d, performance: performanceData, isLoadingDetails: false };
        })
      );


    } catch (err: any) {
      toast({ variant: "destructive", title: "Error Refreshing Data", description: err.message });
    } finally {
      setIsRefreshing(false);
    }
  }, [devices, toast, isRefreshing]);

  React.useEffect(() => {
    fetchInitialDevices();
  }, [fetchInitialDevices]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
        refreshAllDeviceStatus();
        interval = setInterval(refreshAllDeviceStatus, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshAllDeviceStatus]);

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
          <AlertTitle>Error Loading Devices</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">Device Monitoring</h1>
          <p className="text-muted-foreground">Real-time performance metrics for domain computers.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
                <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                <Label htmlFor="auto-refresh">Auto-Refresh</Label>
            </div>
            <Button onClick={refreshAllDeviceStatus} disabled={isRefreshing}>
                {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SlidersHorizontal className="mr-2 h-4 w-4" />}
                Refresh Data
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
