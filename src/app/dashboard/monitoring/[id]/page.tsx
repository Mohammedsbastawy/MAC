
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

  const deviceId = decodeURIComponent(params.id);

  React.useEffect(() => {
    // Extract device name from DN for display
    try {
        const nameMatch = deviceId.match(/CN=([^,]+)/);
        if(nameMatch && nameMatch[1]) {
            setDeviceName(nameMatch[1]);
        }
    } catch(e) {
        // fallback
        setDeviceName(deviceId);
    }
  }, [deviceId]);

  React.useEffect(() => {
    const fetchHistory = async () => {
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
          const formattedHistory = data.history.map((item: any) => ({
             ...item,
             timestamp: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
    };

    fetchHistory();
  }, [deviceId]);

  const yAxisDomain = [0, 100];

  return (
    <div className="space-y-6">
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
                    dataKey="timestamp"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.slice(0, 5)}
                  />
                  <YAxis domain={yAxisDomain} tickLine={false} axisLine={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
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
                    dataKey="timestamp"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.slice(0, 5)}
                  />
                  <YAxis tickLine={false} axisLine={false}/>
                   <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
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
