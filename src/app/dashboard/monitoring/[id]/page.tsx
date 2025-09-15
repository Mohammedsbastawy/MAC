"use client";

import * as React from "react";
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Cpu, ServerCrash, Loader2, MemoryStick } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { ChartConfig } from "@/components/ui/chart";

type HistoricalData = {
    timestamp: string;
    cpuUsage: number;
    usedMemoryGB: number;
};

const chartConfig = {
  cpuUsage: {
    label: "CPU",
    color: "hsl(var(--chart-1))",
  },
  usedMemoryGB: {
    label: "Memory",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;


export default function DeviceHistoryPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const deviceId = params.id ? decodeURIComponent(params.id as string) : "";
    
    const [history, setHistory] = React.useState<HistoricalData[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchHistory = React.useCallback(async () => {
        if (!deviceId) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/network/get-historical-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: deviceId })
            });
            const data = await res.json();
            if (data.ok) {
                setHistory(data.history);
            } else {
                setError(data.error || "Failed to fetch historical data.");
            }
        } catch (e) {
            setError("Failed to connect to the server.");
        } finally {
            setIsLoading(false);
        }
    }, [deviceId]);

    React.useEffect(() => {
        if (user) {
            fetchHistory();
        }
    }, [user, fetchHistory]);

    const formattedData = history.map(item => ({
        ...item,
        time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

    if (!user) {
        return (
            <div className="flex items-center justify-center h-full">
                <Alert variant="destructive" className="max-w-lg">
                    <ServerCrash className="h-4 w-4" />
                    <AlertTitle>Authentication Required</AlertTitle>
                    <AlertDescription>Please sign in to view device history.</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    // Extract device name from DN for display
    const deviceName = deviceId.startsWith("CN=") ? deviceId.split(',')[0].substring(3) : deviceId;

    return (
        <div className="space-y-6">
            <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Monitoring
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Performance History for {deviceName}</CardTitle>
                    <CardDescription>Showing data from the last 24 hours.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-8">
                            <Skeleton className="h-64 w-full" />
                            <Skeleton className="h-64 w-full" />
                        </div>
                    ) : error ? (
                        <Alert variant="destructive">
                            <ServerCrash className="h-4 w-4" />
                            <AlertTitle>Error Loading History</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : history.length > 0 ? (
                        <div className="space-y-8">
                             <Card>
                                <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
                                    <div className="flex flex-1 items-center gap-2">
                                    <Cpu className="h-5 w-5" />
                                    <h3 className="text-lg font-medium">CPU Usage (%)</h3>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                     <ChartContainer config={chartConfig} className="h-64 w-full">
                                        <AreaChart data={formattedData} margin={{ left: 12, right: 12, top: 5 }}>
                                            <CartesianGrid vertical={false} />
                                            <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} />
                                            <YAxis domain={[0, 100]} />
                                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                            <Area dataKey="cpuUsage" type="natural" fill="var(--color-cpuUsage)" fillOpacity={0.4} stroke="var(--color-cpuUsage)" />
                                        </AreaChart>
                                    </ChartContainer>
                                </CardContent>
                             </Card>
                             <Card>
                                <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
                                    <div className="flex flex-1 items-center gap-2">
                                    <MemoryStick className="h-5 w-5" />
                                    <h3 className="text-lg font-medium">Memory Usage (GB)</h3>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                     <ChartContainer config={chartConfig} className="h-64 w-full">
                                        <AreaChart data={formattedData} margin={{ left: 12, right: 12, top: 5 }}>
                                            <CartesianGrid vertical={false} />
                                            <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} />
                                            <YAxis />
                                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                            <Area dataKey="usedMemoryGB" type="natural" fill="var(--color-usedMemoryGB)" fillOpacity={0.4} stroke="var(--color-usedMemoryGB)" />
                                        </AreaChart>
                                    </ChartContainer>
                                </CardContent>
                             </Card>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-64">
                            <h3 className="text-lg font-semibold text-foreground">No Historical Data</h3>
                            <p className="mt-2 text-sm text-muted-foreground">No performance data has been logged for this device yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
