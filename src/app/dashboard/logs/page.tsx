
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
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-black rounded-lg border border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center gap-3">
                    <NotebookText className="text-gray-300" />
                    <h1 className="text-lg font-bold text-gray-200 font-mono">
                        Dominion Tools - Live System Logs
                    </h1>
                </div>
                 <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full animate-pulse", isPaused ? 'bg-yellow-500' : 'bg-green-500')} />
                    <span className="text-sm text-gray-400 font-mono">
                         {isPaused ? "Paused" : "Live"}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setIsPaused(!isPaused)} className="ml-4 bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700">
                        {isPaused ? "Resume" : "Pause"}
                    </Button>
                </div>
            </div>
            <div className="flex-grow p-4 overflow-y-auto font-mono text-sm text-green-400">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                        <Loader2 className="animate-spin" />
                        <span>Loading initial logs...</span>
                    </div>
                ) : error ? (
                    <pre className="text-red-400 whitespace-pre-wrap">{`[ERROR] ${error}`}</pre>
                ) : (
                    <pre className="whitespace-pre-wrap">{logs}</pre>
                )}
                 <div ref={logsEndRef} />
            </div>
        </div>
    );
};

export default LogsPage;
