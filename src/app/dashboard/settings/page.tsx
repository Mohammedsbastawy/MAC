
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, ServerCrash, Settings } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SettingsPage() {
  const [retentionHours, setRetentionHours] = React.useState<string>("168");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/settings/get-settings");
        const data = await res.json();
        if (data.ok) {
          setRetentionHours(String(data.settings.log_retention_hours));
        } else {
          setError(data.error || "Failed to fetch settings.");
        }
      } catch (err) {
        setError("Could not connect to the server.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/save-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_retention_hours: Number(retentionHours) }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({
          title: "Settings Saved",
          description: "Your changes have been successfully saved.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Save",
          description: data.error || "An unknown error occurred.",
        });
        setError(data.error || "An unknown error occurred.");
      }
    } catch (err) {
      const errorMessage = "Could not connect to the server to save settings.";
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: errorMessage,
      });
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">
            Application Settings
          </h1>
          <p className="text-muted-foreground">
            Manage global settings for the Atlas Control Panel.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Monitoring Settings
          </CardTitle>
          <CardDescription>
            Control how long historical performance data for devices is stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <ServerCrash className="h-4 w-4" />
              <AlertTitle>Error Loading Settings</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="retention-period">
                  Data Retention Period
                </Label>
                <Select
                  value={retentionHours}
                  onValueChange={setRetentionHours}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-[280px]" id="retention-period">
                    <SelectValue placeholder="Select a period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">1 Day</SelectItem>
                    <SelectItem value="168">7 Days (Default)</SelectItem>
                    <SelectItem value="720">30 Days</SelectItem>
                    <SelectItem value="2160">90 Days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Longer periods will consume more disk space on the server.
                </p>
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
