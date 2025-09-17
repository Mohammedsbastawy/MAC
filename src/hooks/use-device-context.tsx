

"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Device, ADComputer, PerformanceData } from '@/lib/types';
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
  updateProgress: number;
  error: { title: string; message: string; details?: string } | null;
  fetchAllDevices: () => Promise<void>;
  fetchLiveData: (device: Device) => Promise<void>;
  refreshAllDeviceStatus: () => Promise<void>;
  updateDeviceData: (deviceId: string, newData: Partial<Device>) => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [error, setError] = useState<{ title: string; message: string; details?: string } | null>(null);
  const { toast } = useToast();

  const updateDeviceData = (deviceId: string, newData: Partial<Device>) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, ...newData } : d));
  };


  const fetchLiveData = useCallback(async (deviceToUpdate: Device) => {
    if (!deviceToUpdate.ipAddress) {
        updateDeviceData(deviceToUpdate.id, { isAgentDeployed: false, agentLastUpdate: null });
        return;
    }
    try {
        const res = await fetch("/api/network/fetch-live-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: deviceToUpdate.id, ip: deviceToUpdate.ipAddress }),
        });
        const data = await res.json();
        
        if (data.ok && data.liveData) {
            updateDeviceData(deviceToUpdate.id, { isAgentDeployed: true, agentLastUpdate: data.liveData.timestamp });
        } else {
            updateDeviceData(deviceToUpdate.id, { isAgentDeployed: false, agentLastUpdate: null });
        }
    } catch {
        updateDeviceData(deviceToUpdate.id, { isAgentDeployed: false, agentLastUpdate: null });
    }
  }, []);

  const fetchAllDevices = useCallback(async () => {
    if (isLoading || isUpdating) return;
    setIsLoading(true);
    setIsUpdating(true);
    setUpdateProgress(0);
    setError(null);
    try {
      const adResponse = await fetch("/api/ad/get-computers", { method: "POST" });
      const adData = await adResponse.json();
      if (!adData.ok) throw adData;

      let initialDevices: Device[] = adData.computers.map(mapAdComputerToDevice);
      setDevices(initialDevices.map(d => ({ ...d, status: 'unknown', isAgentDeployed: false, agentLastUpdate: null })));
      
      setIsLoading(false); // AD data is loaded, main loading is false
      setUpdateProgress(10);

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
      }));
      
      setDevices(devicesWithStatus);
      setUpdateProgress(30);

      const onlineDevices = devicesWithStatus.filter(d => d.status === 'online');
      let processedCount = 0;
      const totalOnline = onlineDevices.length;

      const agentCheckPromises = onlineDevices.map(async (device) => {
        await fetchLiveData(device);
        processedCount++;
        const progress = 30 + Math.floor((processedCount / totalOnline) * 70);
        setUpdateProgress(progress);
      });
      
      await Promise.all(agentCheckPromises);


    } catch (err: any) {
      setError({
        title: err.error || "Server Error",
        message: err.message || "Failed to connect to the server to get devices.",
        details: err.details,
      });
      setDevices([]);
    } finally {
      setIsLoading(false);
      setIsUpdating(false);
      setUpdateProgress(100);
    }
  }, [fetchLiveData, isLoading, isUpdating]);

  const refreshAllDeviceStatus = useCallback(async () => {
    if (devices.length === 0) {
        toast({ title: "No devices to refresh" });
        return;
    }
    if (isUpdating) return;
    setIsUpdating(true);
    setUpdateProgress(0);
    toast({ title: "Refreshing Status...", description: `Checking ${devices.length} devices.` });

    try {
        const ipsToCheck = devices.map(d => d.ipAddress).filter(Boolean);
        setUpdateProgress(10);
        const res = await fetch("/api/network/check-status", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ips: ipsToCheck })
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Status check failed.");
        
        setUpdateProgress(30);
        const onlineIps = new Set(data.online_ips);
        
        const currentDevices = devices;
        const devicesWithStatus = currentDevices.map(d => ({
            ...d,
            status: onlineIps.has(d.ipAddress) ? 'online' : 'offline'
        }));
        
        setDevices(devicesWithStatus);
        
        toast({ title: "Status Refresh Complete", description: `Found ${onlineIps.size} online devices.` });

        const onlineDevices = devicesWithStatus.filter(d => d.status === 'online');
        let processedCount = 0;
        const totalOnline = onlineDevices.length;

        const agentCheckPromises = onlineDevices.map(async (device) => {
          await fetchLiveData(device);
          processedCount++;
          const progress = 30 + Math.floor((processedCount / totalOnline) * 70);
          setUpdateProgress(progress);
        });

        await Promise.all(agentCheckPromises);

    } catch (err: any) {
        toast({ variant: "destructive", title: "Error Refreshing Status", description: err.message });
    } finally {
        setIsUpdating(false);
        setUpdateProgress(100);
    }
  }, [devices, toast, fetchLiveData, isUpdating]);

  const contextValue = useMemo(() => ({
    devices, isLoading, isUpdating, updateProgress, error, fetchAllDevices, fetchLiveData, refreshAllDeviceStatus, updateDeviceData
  }), [devices, isLoading, isUpdating, updateProgress, error, fetchAllDevices, fetchLiveData, refreshAllDeviceStatus]);

  return (
    <DeviceContext.Provider value={contextValue}>
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
