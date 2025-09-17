

"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Device, ADComputer, PerformanceData } from '@/lib/types';
import { useToast } from './use-toast';
import { useAuth } from './use-auth';

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
  fetchAllDevices: (checkAgentStatus?: boolean) => Promise<void>;
  fetchLiveData: (deviceId: string, deviceIp: string) => Promise<boolean>;
  refreshAllDeviceStatus: () => Promise<void>;
  updateDeviceData: (deviceId: string, newData: Partial<Device>) => void;
  checkAllAgentStatus: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [error, setError] = useState<{ title: string; message: string; details?: string } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const updateDeviceData = useCallback((deviceId: string, newData: Partial<Device>) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, ...newData } : d));
  }, []);


  const fetchLiveData = useCallback(async (deviceId: string, deviceIp: string): Promise<boolean> => {
    if (!deviceIp || !user) {
        updateDeviceData(deviceId, { isAgentDeployed: false, agentLastUpdate: null });
        return false;
    }
    try {
        const res = await fetch("/api/network/fetch-live-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: deviceId, ip: deviceIp }),
        });
        const data = await res.json();
        
        if (data.ok && data.liveData) {
            updateDeviceData(deviceId, { isAgentDeployed: true, agentLastUpdate: data.liveData.timestamp });
            return true;
        } else {
            updateDeviceData(deviceId, { isAgentDeployed: false, agentLastUpdate: null });
            return false;
        }
    } catch {
        updateDeviceData(deviceId, { isAgentDeployed: false, agentLastUpdate: null });
        return false;
    }
  }, [updateDeviceData, user]);

  const checkAllAgentStatus = useCallback(async () => {
    if (!devices.length || isUpdating) return;

    setIsUpdating(true);
    setUpdateProgress(0);
    toast({ title: "Checking Agent Status...", description: "Verifying agent on all online devices." });

    const onlineDevices = devices.filter(d => d.status === 'online');
    if (onlineDevices.length === 0) {
      toast({ title: "No Online Devices", description: "No devices to check agent status on." });
      setIsUpdating(false);
      setUpdateProgress(100);
      return;
    }
    
    let processedCount = 0;
    const totalOnline = onlineDevices.length;
    
    // Process devices in chunks to avoid overwhelming the backend
    const chunks = [];
    for (let i = 0; i < onlineDevices.length; i += 10) {
        chunks.push(onlineDevices.slice(i, i + 10));
    }

    for (const chunk of chunks) {
        const agentCheckPromises = chunk.map(async (device) => {
            await fetchLiveData(device.id, device.ipAddress);
            processedCount++;
            const progress = Math.floor((processedCount / totalOnline) * 100);
            setUpdateProgress(progress);
        });
        await Promise.all(agentCheckPromises);
    }
    
    setIsUpdating(false);
    setUpdateProgress(100);
    toast({ title: "Agent Status Check Complete" });
  }, [devices, isUpdating, toast, fetchLiveData]);


  const fetchAllDevices = useCallback(async () => {
    if (isLoading || isUpdating || !user) return;
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
      
      setIsLoading(false); 
      setUpdateProgress(10);

      const onlineCheckResponse = await fetch("/api/network/check-status", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ips: initialDevices.map(d => d.ipAddress).filter(Boolean) })
      });
      const onlineCheckData = await onlineCheckResponse.json();
      if (!onlineCheckData.ok) throw new Error(onlineCheckData.error || "Status check failed.");
      
      const onlineIps = new Set<string>(onlineCheckData.online_ips);
      
      setDevices(prevDevices => prevDevices.map(d => ({
        ...d,
        status: onlineIps.has(d.ipAddress) ? 'online' : 'offline',
      })));
      setUpdateProgress(100);


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
  }, [isLoading, isUpdating, user]);

  const refreshAllDeviceStatus = useCallback(async () => {
    if (devices.length === 0) {
        toast({ title: "No devices to refresh" });
        return;
    }
    if (isUpdating || !user) return;
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
        
        setUpdateProgress(100);
        const onlineIps = new Set(data.online_ips);
        
        setDevices(prevDevices => prevDevices.map(d => ({
            ...d,
            status: onlineIps.has(d.ipAddress) ? 'online' : 'offline'
        })));
        
        toast({ title: "Status Refresh Complete", description: `Found ${onlineIps.size} online devices.` });

    } catch (err: any) {
        toast({ variant: "destructive", title: "Error Refreshing Status", description: err.message });
    } finally {
        setIsUpdating(false);
        setUpdateProgress(100);
    }
  }, [devices, toast, user, isUpdating]);

  const contextValue = useMemo(() => ({
    devices, isLoading, isUpdating, updateProgress, error, fetchAllDevices, fetchLiveData, refreshAllDeviceStatus, updateDeviceData, checkAllAgentStatus
  }), [devices, isLoading, isUpdating, updateProgress, error, fetchAllDevices, fetchLiveData, refreshAllDeviceStatus, updateDeviceData, checkAllAgentStatus]);

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
