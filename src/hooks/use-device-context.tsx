
"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Device, ADComputer } from '@/lib/types';
import { useToast } from './use-toast';

// Helper function from devices/page.tsx
const mapAdComputerToDevice = (adComputer: ADComputer): Device => ({
    id: adComputer.dn,
    name: adComputer.name,
    ipAddress: adComputer.dns_hostname,
    macAddress: "-",
    status: 'unknown',
    type: determineDeviceType(adComputer.name),
    os: adComputer.os,
    lastSeen: adComputer.last_logon,
    domain: adComputer.domain || "Domain",
    isDomainMember: true,
    isLoadingDetails: false,
    source: 'ad',
    isAgentDeployed: false,
    agentLastUpdate: null,
});

const determineDeviceType = (hostname: string): Device["type"] => {
    if (!hostname) return 'unknown';
    const lowerHostname = hostname.toLowerCase();
    if (lowerHostname.includes("laptop")) return "laptop";
    if (lowerHostname.includes("server")) return "server";
    if (lowerHostname.includes("router") || lowerHostname.includes("gateway")) return "router";
    if (lowerHostname.includes("phone") || lowerHostname.includes("mobile")) return "mobile";
    if (lowerHostname.includes("desktop") || lowerHostname.includes("pc")) return "desktop";
    if (lowerHostname.includes("iot") || lowerHostname.includes("thermostat") || lowerHostname.includes("light")) return "iot";
    return "unknown";
};


interface DeviceContextType {
  devices: Device[];
  isLoading: boolean;
  isUpdating: boolean;
  error: { title: string; message: string; details?: string } | null;
  fetchAllDevices: () => Promise<void>;
  fetchLiveData: (device: Device) => Promise<void>;
  refreshAllDeviceStatus: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<{ title: string; message: string; details?: string } | null>(null);
  const { toast } = useToast();

  const fetchLiveData = useCallback(async (deviceToUpdate: Device) => {
    try {
        const res = await fetch("/api/network/fetch-live-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: deviceToUpdate.id, ip: deviceToUpdate.ipAddress }),
        });
        const data = await res.json();
        
        setDevices(prev => prev.map(d => {
            if (d.id === deviceToUpdate.id) {
                if (data.ok && data.liveData) {
                    return { ...d, isAgentDeployed: true, agentLastUpdate: data.liveData.timestamp };
                } else {
                    return { ...d, isAgentDeployed: false, agentLastUpdate: null };
                }
            }
            return d;
        }));
    } catch {
        setDevices(prev => prev.map(d => 
            d.id === deviceToUpdate.id ? { ...d, isAgentDeployed: false, agentLastUpdate: null } : d
        ));
    }
  }, []);

  const fetchAllDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setDevices([]); // Clear previous state

    try {
      // 1. Fetch AD Computers
      const adResponse = await fetch("/api/ad/get-computers", { method: "POST" });
      const adData = await adResponse.json();
      if (!adData.ok) throw adData;

      let initialDevices: Device[] = adData.computers.map(mapAdComputerToDevice);
      setDevices(initialDevices.map(d => ({ ...d, isLoadingDetails: true })));

      // 2. Check Online Status
      const onlineCheckResponse = await fetch("/api/network/check-status", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ips: initialDevices.map(d => d.ipAddress).filter(Boolean) })
      });
      const onlineCheckData = await onlineCheckResponse.json();
      if (!onlineCheckData.ok) throw new Error(onlineCheckData.error || "Status check failed.");
      
      const onlineIps = new Set<string>(onlineCheckData.online_ips);
      const devicesWithStatus = initialDevices.map(d => ({
          ...d,
          status: onlineIps.has(d.ipAddress) ? 'online' : 'offline',
          isLoadingDetails: false
      }));

      setDevices(devicesWithStatus);

      // 3. For online devices, check agent status in parallel
      const onlineDevices = devicesWithStatus.filter(d => d.status === 'online');
      await Promise.all(onlineDevices.map(device => fetchLiveData(device)));

    } catch (err: any) {
      setError({
        title: err.error || "Server Error",
        message: err.message || "Failed to connect to the server to get devices.",
        details: err.details,
      });
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchLiveData]);

  const refreshAllDeviceStatus = useCallback(async () => {
    if (devices.length === 0) {
        toast({ title: "No devices to refresh" });
        return;
    }
    setIsUpdating(true);
    toast({ title: "Refreshing Status...", description: `Checking ${devices.length} devices.` });

    try {
        const ipsToCheck = devices.map(d => d.ipAddress).filter(Boolean);
        const res = await fetch("/api/network/check-status", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ips: ipsToCheck })
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Status check failed.");

        const onlineIps = new Set(data.online_ips);
        const updatedDevices = devices.map(d => ({
            ...d,
            status: onlineIps.has(d.ipAddress) ? 'online' : 'offline'
        }));
        setDevices(updatedDevices);
        
        toast({ title: "Status Refresh Complete", description: `Found ${onlineIps.size} online devices.` });

        // Now check agent status for the newly online devices
        const onlineDevices = updatedDevices.filter(d => d.status === 'online');
        await Promise.all(onlineDevices.map(device => fetchLiveData(device)));

    } catch (err: any) {
        toast({ variant: "destructive", title: "Error Refreshing Status", description: err.message });
    } finally {
        setIsUpdating(false);
    }
  }, [devices, toast, fetchLiveData]);


  return (
    <DeviceContext.Provider value={{ devices, isLoading, isUpdating, error, fetchAllDevices, fetchLiveData, refreshAllDeviceStatus }}>
      {children}
    </DeviceContext.Provider>
  );
};

export const useDeviceContext = (): DeviceContextType => {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDeviceContext must be used within a DeviceProvider');
  }
  return context;
};
