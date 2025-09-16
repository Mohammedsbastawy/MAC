

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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { PerformanceData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";


const chartConfig = {
  cpu: {
    label: "CPU",
    color: "hsl(var(--chart-1))",
  },
  memory: {
    label: "Memory",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const DeviceDashboardPage = ({ params }: { params: { id: string } }) => {
  const [history, setHistory] = React.useState<PerformanceData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deviceName, setDeviceName] = React.useState('');
  const [isAutoRefresh, setIsAutoRefresh] = React.useState(true);
  const MAX_HISTORY_POINTS = 30; // Keep the last 30 data points on the chart

  const deviceId = decodeURIComponent(params.id);

   const fetchInitialHistory = React.useCallback(async () => {
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
          const sortedHistory = data.history.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const formattedHistory = sortedHistory.map((item: any) => ({
             ...item,
             displayTime: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
             cpuUsage: parseFloat(item.cpuUsage?.toFixed(2) || 0),
             usedMemoryGB: parseFloat(item.usedMemoryGB?.toFixed(2) || 0),
          }));
          setHistory(formattedHistory);
        } else {
          setError(data.error || "Failed to fetch historical data.");
        }
      } catch (err) {
        setError("An error occurred while fetching data from the server.");
      } finally {
        setIsLoading(false);
      }
  }, [deviceId]);

  const fetchLiveData = React.useCallback(async () => {
    try {
        const res = await fetch("/api/network/fetch-live-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: deviceId }),
        });
        const data = await res.json();

        if(data.ok && data.liveData) {
            const newPoint = {
                ...data.liveData,
                displayTime: new Date(data.liveData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                cpuUsage: parseFloat(data.liveData.cpuUsage?.toFixed(2) || 0),
                usedMemoryGB: parseFloat(data.liveData.usedMemoryGB?.toFixed(2) || 0),
            };
            
            setHistory(prevHistory => {
                // Avoid adding duplicate points
                if(prevHistory.some(p => p.timestamp === newPoint.timestamp)) {
                    return prevHistory;
                }
                const updatedHistory = [...prevHistory, newPoint];
                // Limit the number of points on the chart
                if(updatedHistory.length > MAX_HISTORY_POINTS) {
                    return updatedHistory.slice(updatedHistory.length - MAX_HISTORY_POINTS);
                }
                return updatedHistory;
            });
             setError(null);
        } else if (!data.ok) {
            setError(data.error || "Failed to fetch live update.");
        }
    } catch (err) {
        setError("An error occurred while fetching live data from the server.");
    }
  }, [deviceId]);


  React.useEffect(() => {
    try {
        const nameMatch = deviceId.match(/CN=([^,]+)/);
        if(nameMatch && nameMatch[1]) {
            setDeviceName(nameMatch[1]);
        }
    } catch(e) {
        setDeviceName(deviceId);
    }
  }, [deviceId]);

  React.useEffect(() => {
    fetchInitialHistory();
  }, [fetchInitialHistory]);

  React.useEffect(() => {
    if (!isLoading && isAutoRefresh) {
        const intervalId = setInterval(() => {
            fetchLiveData();
        }, 60000); // Refresh every 1 minute
        return () => clearInterval(intervalId);
    }
  }, [isAutoRefresh, isLoading, fetchLiveData]);

  const yAxisDomain = [0, 100];

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
                <Button asChild variant="outline" size="icon">
                    <Link href="/dashboard/monitoring"><ArrowLeft /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">
                        Monitoring Dashboard
                    </h1>
                    <p className="text-muted-foreground">
                        Live performance data for <span className="font-semibold text-primary">{deviceName}</span>
                    </p>
                </div>
            </div>
             <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full animate-pulse", isAutoRefresh ? 'bg-green-500' : 'bg-yellow-500')} />
                <span className="text-sm text-muted-foreground">
                        {isAutoRefresh ? "Live" : "Paused"}
                </span>
                <Button variant="outline" size="sm" onClick={() => setIsAutoRefresh(!isAutoRefresh)} className="ml-4">
                    {isAutoRefresh ? "Pause Refresh" : "Resume Refresh"}
                </Button>
            </div>
        </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-2">Loading performance data...</p>
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
          <AlertDescription>No performance history has been recorded for this device yet. Ensure the agent is deployed and has had time to run.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Cpu /> CPU Usage (%)</CardTitle>
              <CardDescription>
                CPU utilization over the last 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <AreaChart data={history} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="displayTime"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value, index) => {
                      return index % Math.ceil(history.length / 10) === 0 ? value : '';
                    }}
                  />
                  <YAxis domain={yAxisDomain} tickLine={false} axisLine={false} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent labelFormatter={(value, payload) => {
                      const data = payload[0]?.payload;
                      return data ? new Date(data.timestamp).toLocaleString() : value;
                    }} />}
                  />
                  <defs>
                      <linearGradient id="fillCpu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-cpu)" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="var(--color-cpu)" stopOpacity={0.1} />
                      </linearGradient>
                  </defs>
                  <Area
                    dataKey="cpuUsage"
                    name="CPU"
                    type="natural"
                    fill="url(#fillCpu)"
                    stroke="var(--color-cpu)"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MemoryStick/> Memory Usage (GB)</CardTitle>
              <CardDescription>
                Used memory over the last 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <AreaChart data={history} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                   <XAxis
                    dataKey="displayTime"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value, index) => {
                       return index % Math.ceil(history.length / 10) === 0 ? value : '';
                    }}
                  />
                  <YAxis tickLine={false} axisLine={false} domain={['auto', 'auto']}/>
                   <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent labelFormatter={(value, payload) => {
                      const data = payload[0]?.payload;
                      return data ? new Date(data.timestamp).toLocaleString() : value;
                    }} />}
                  />
                   <defs>
                      <linearGradient id="fillMemory" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-memory)" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="var(--color-memory)" stopOpacity={0.1} />
                      </linearGradient>
                  </defs>
                  <Area
                    dataKey="usedMemoryGB"
                    name="Memory"
                    type="natural"
                    fill="url(#fillMemory)"
                    stroke="var(--color-memory)"
                    stackId="b"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DeviceDashboardPage;
