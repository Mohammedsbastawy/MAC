"use client";

import {
  Activity,
  ChevronRight,
  Laptop,
  Monitor,
  Power,
  RefreshCw,
  Router,
  Server,
  Smartphone,
  Terminal,
  ToyBrick,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Device } from "@/lib/types";
import { cn } from "@/lib/utils";

type DeviceActionsPanelProps = {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
};

const ICONS: Record<Device["type"], React.ElementType> = {
  laptop: Laptop,
  server: Server,
  router: Router,
  mobile: Smartphone,
  desktop: Monitor,
  iot: ToyBrick,
};

export default function DeviceActionsPanel({
  device,
  isOpen,
  onClose,
}: DeviceActionsPanelProps) {
  const { toast } = useToast();

  if (!device) return null;

  const Icon = ICONS[device.type];

  const handleAction = (action: string) => {
    toast({
      title: `Action: ${action}`,
      description: `Command sent to ${device.name}`,
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-3 text-xl font-headline">
            <Icon className="h-6 w-6" />
            {device.name}
          </SheetTitle>
          <SheetDescription>
            {device.os}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pb-6 space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Device Status</h4>
              <div className="flex items-center">
                <div className={cn(
                    "h-2.5 w-2.5 rounded-full mr-2",
                    device.status === 'online' ? "bg-green-500" : "bg-gray-400"
                )} />
                <p className="text-sm text-muted-foreground capitalize">
                  {device.status} {device.status === 'offline' && `(Last seen: ${device.lastSeen})`}
                </p>
              </div>
            </div>

            <Separator />
            
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Network Details</h4>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">IP Address</span>
                <span className="font-mono text-foreground">{device.ipAddress}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">MAC Address</span>
                <span className="font-mono text-foreground">{device.macAddress}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Actions</h4>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" className="justify-start" onClick={() => handleAction("Restart")}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  <span>Restart Device</span>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => handleAction("Run Diagnostics")}>
                  <Activity className="mr-2 h-4 w-4" />
                  <span>Run Diagnostics</span>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Button>
                 <Button variant="outline" className="justify-start" onClick={() => handleAction("Open Terminal")}>
                  <Terminal className="mr-2 h-4 w-4" />
                  <span>Open Terminal</span>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Button>
                <Button variant="destructive" className="justify-start mt-4" onClick={() => handleAction("Shutdown")}>
                  <Power className="mr-2 h-4 w-4" />
                  <span>Shut Down</span>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
