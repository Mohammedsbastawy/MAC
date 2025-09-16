"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ServerCrash, Siren, RefreshCw, Rss } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';

type SnmpTrap = {
    source: string;
    timestamp: string;
    variables: {
        oid: string;
        value: string;
    }[];
};


const TrapCard: React.FC<{trap: SnmpTrap}> = ({ trap }) => {
    const timeAgo = formatDistanceToNow(new Date(trap.timestamp), { addSuffix: true });
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-mono">{trap.source}</CardTitle>
                    <Badge variant="secondary">{timeAgo}</Badge>
                </div>
                <CardDescription>An SNMP trap was received from this device.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="max-h-48 overflow-y-auto rounded-md bg-muted p-3">
                    <h4 className="font-semibold mb-2">Variables</h4>
                    <div className="space-y-2 text-xs font-mono">
                        {trap.variables.map((variable, index) => (
                             <div key={index} className="flex flex-col">
                                <span className="text-muted-foreground" title={variable.oid}>{variable.oid}</span>
                                <span className="font-bold pl-2">{variable.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default function MonitoringPage() {
  const { user } = useAuth();
  const [traps, setTraps] = React.useState<SnmpTrap[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);
  const { toast } = useToast();

  const fetchTraps = React.useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
        const res = await fetch("/api/network/get-snmp-traps", { signal });
        if (signal.aborted) return;
        const data = await res.json();

        if (data.ok) {
            setTraps(data.traps);
            setLastUpdated(new Date().toISOString());
        } else {
            setError(data.error || "Failed to fetch SNMP traps.");
        }
    } catch (err: any) {
        if (err.name !== 'AbortError') {
            setError("Failed to connect to the backend to fetch SNMP traps.");
        }
    } finally {
        if (!signal.aborted) {
            setIsLoading(false);
        }
    }
  }, []);

  React.useEffect(() => {
    if (!user) {
        setIsLoading(false);
        return;
    };

    const controller = new AbortController();
    const signal = controller.signal;
    
    fetchTraps(signal); // Initial fetch
    
    const interval = setInterval(() => {
        if (!document.hidden) {
             fetchTraps(signal);
        }
    }, 5000); // Poll every 5 seconds for new traps

    return () => {
        controller.abort();
        clearInterval(interval);
    };

  }, [user, fetchTraps]);


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

  if (isLoading && traps.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
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
          <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">SNMP Trap Listener</h1>
           {lastUpdated && (
            <p className="text-muted-foreground">
              Listening for SNMP traps on port 162. Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button onClick={() => fetchTraps(new AbortController().signal)} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh Now
        </Button>
      </div>

       {error && (
         <Alert variant="destructive">
          <Siren className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {traps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {traps.map((trap, index) => (
                <TrapCard key={`${trap.timestamp}-${index}`} trap={trap} />
            ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-[calc(100vh-250px)]">
            <Rss className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">Waiting for SNMP Traps...</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
                No SNMP traps have been received yet. Ensure your network devices are configured to send traps to this server's IP address on port 162.
            </p>
             <p className="mt-2 text-xs text-muted-foreground max-w-md">
                (Note: The backend must be run with administrator privileges to open port 162).
            </p>
        </div>
      )}
    </div>
  );
}
