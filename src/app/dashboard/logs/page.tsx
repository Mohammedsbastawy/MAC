
"use client";

import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ServerCrash, Loader2, NotebookText } from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LogsPage: React.FC = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState("Loading logs...");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/logs/get-logs');
            const data = await res.json();
            if (data.ok) {
                setLogs(data.logs);
                setError(null);
            } else {
                setError(data.error || "Failed to fetch logs.");
            }
        } catch (e) {
            setError("Could not connect to the backend server.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user && !isPaused) {
            fetchLogs(); // Initial fetch
            const interval = setInterval(fetchLogs, 3000); // Poll every 3 seconds
            return () => clearInterval(interval);
        }
    }, [user, isPaused]);

    useEffect(() => {
        // Auto-scroll to bottom only if not paused
        if (!isPaused) {
            logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, isPaused]);


    if (!user) {
        return (
            <div className="flex items-center justify-center h-full">
                <Alert variant="destructive" className="max-w-lg">
                    <ServerCrash className="h-4 w-4" />
                    <AlertTitle>Authentication Required</AlertTitle>
                    <AlertDescription>
                        Please sign in to view system logs.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-card rounded-lg border shadow-sm">
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                    <NotebookText className="text-muted-foreground" />
                    <h1 className="text-lg font-bold text-foreground">
                        Atlas Tools - Live System Logs
                    </h1>
                </div>
                 <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full animate-pulse", isPaused ? 'bg-yellow-500' : 'bg-green-500')} />
                    <span className="text-sm text-muted-foreground">
                         {isPaused ? "Paused" : "Live"}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setIsPaused(!isPaused)} className="ml-4">
                        {isPaused ? "Resume" : "Pause"}
                    </Button>
                </div>
            </div>
            <div className="flex-grow p-4 overflow-y-auto font-mono text-sm text-foreground bg-background">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="animate-spin" />
                        <span>Loading initial logs...</span>
                    </div>
                ) : error ? (
                    <pre className="text-destructive whitespace-pre-wrap">{`[ERROR] ${error}`}</pre>
                ) : (
                    <pre className="whitespace-pre-wrap">{logs}</pre>
                )}
                 <div ref={logsEndRef} />
            </div>
        </div>
    );
};

export default LogsPage;
