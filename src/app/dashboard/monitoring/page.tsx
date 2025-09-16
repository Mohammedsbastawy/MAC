"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  ServerCrash,
  NotebookText,
  Siren,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { SnmpTrap } from "@/lib/types";
import { useRouter } from "next/navigation";

const TrapCard: React.FC<{ trap: SnmpTrap }> = ({ trap }) => {
  const getTrapSeverity = (variables: SnmpTrap['variables']) => {
    const severityVar = variables.find(v => v.oid.includes('snmpTrapSeverity'));
    if (severityVar) {
        if (severityVar.value.toLowerCase().includes('critical')) return 'destructive';
        if (severityVar.value.toLowerCase().includes('warning')) return 'default';
    }
    const trapType = variables.find(v => v.oid.includes('snmpTrapOID'));
    if (trapType) {
        if (trapType.value.includes('coldStart')) return 'secondary';
        if (trapType.value.includes('linkDown')) return 'destructive';
        if (trapType.value.includes('linkUp')) return 'default';
        if (trapType.value.includes('authenticationFailure')) return 'destructive';
    }
    return 'outline';
  }
  
  const trapName = trap.variables.find(v => v.oid.includes('snmpTrapOID.0'))?.value.split('::').pop() || 'Generic Trap';
  const severity = getTrapSeverity(trap.variables);
  
  return (
    <AccordionItem value={trap.timestamp + trap.source}>
      <AccordionTrigger className="p-4 hover:no-underline hover:bg-muted/50 rounded-lg">
        <div className="flex items-center gap-4 w-full text-sm">
           <Siren className={cn("h-5 w-5", 
                severity === 'destructive' ? 'text-destructive' : 
                severity === 'secondary' ? 'text-blue-500' :
                'text-yellow-500'
            )} />
          <div className="flex-1 text-left font-medium">{trapName}</div>
          <div className="flex-1 text-left text-muted-foreground font-mono">{trap.source}</div>
          <div className="flex-1 text-right text-muted-foreground hidden md:block">
            {new Date(trap.timestamp).toLocaleString()}
          </div>
           <Badge variant={severity} className={cn(severity === 'default' && 'bg-yellow-500')}>{severity === 'secondary' ? 'Informational' : severity}</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="pl-12 pr-4 pb-4">
          <h4 className="font-semibold mb-2">Trap Details</h4>
           <div className="grid grid-cols-[1fr_3fr] gap-x-4 gap-y-2 text-xs font-mono bg-muted p-3 rounded-md">
            {trap.variables.map((variable, index) => (
              <React.Fragment key={index}>
                <div className="text-muted-foreground truncate" title={variable.oid}>{variable.oid.split('::').pop()}</div>
                <div className="break-all">{variable.value}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default function MonitoringPage() {
  const { user } = useAuth();
  const [traps, setTraps] = React.useState<SnmpTrap[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  const fetchTraps = React.useCallback(async () => {
    // Don't set loading to true on interval fetches
    try {
      const res = await fetch("/api/network/get-snmp-traps");
      const data = await res.json();
      if (data.ok) {
        setTraps(data.traps);
      } else {
        setError(data.error || "Failed to fetch SNMP traps.");
      }
    } catch (e) {
      setError("Failed to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (user) {
      fetchTraps(); // Initial fetch
      const intervalId = setInterval(fetchTraps, 5000); // Poll every 5 seconds
      return () => clearInterval(intervalId);
    } else {
      setIsLoading(false);
    }
  }, [user, fetchTraps]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Alert variant="destructive" className="max-w-lg">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please sign in to view the monitoring dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">
            SNMP Trap Receiver
          </h1>
          <p className="text-muted-foreground">
            Live feed of SNMP traps received from devices on your network.
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/devices')} size="lg">
          Configure Devices
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NotebookText />
            Incoming Traps
          </CardTitle>
          <CardDescription>
            Displaying the last {traps.length} received traps. The list refreshes automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <ServerCrash className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : traps.length > 0 ? (
            <Accordion type="multiple" className="w-full space-y-2">
              {traps.map((trap, index) => (
                <TrapCard key={`${trap.timestamp}-${trap.source}-${index}`} trap={trap} />
              ))}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-64">
              <Siren className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                No SNMP Traps Received
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Waiting for devices to send SNMP traps. Ensure devices are configured correctly to send traps to this server.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
