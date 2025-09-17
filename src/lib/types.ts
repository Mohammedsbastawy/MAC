export type Device = {
  id: string;
  name: string;
  ipAddress: string;
  macAddress: string;
  status: 'online' | 'offline' | 'unknown';
  type: 'laptop' | 'server' | 'router' | 'mobile' | 'iot' | 'desktop' | 'unknown';
  os: string;
  lastSeen: string;
  domain: string;
  isDomainMember: boolean;
  isLoadingDetails: boolean;
  source: 'ad' | 'scan';
  isAgentDeployed?: boolean;
  agentLastUpdate?: string | null;
};

export type PerformanceData = {
  timestamp: string;
  cpuUsage: number;
  usedMemoryGB: number;
  totalMemoryGB: number;
  diskInfo: {
    volume: string;
    sizeGB: number;
    freeGB: number;
  }[];
};

export type MonitoredDevice = {
    id: string;
    name: string;
    ipAddress: string;
    status: 'online' | 'offline' | 'unknown';
    isFetching: boolean;
    performance?: PerformanceData;
    performanceError?: string | null;
};


export type NetworkInterface = {
  id: string;
  name: string;
  ip: string;
  netmask: string;
  cidr: string;
};

export type ADComputer = {
  name: string;
  dns_hostname: string;
  os: string;
  last_logon: string;
  created: string;
  domain?: string;
  dn: string; // Add distinguishedName
};

export type ADUser = {
  username: string;
  display_name: string;
  email: string;
  enabled: boolean;
  created: string;
  domain?: string;
  dn: string;
};

export type ADGroup = {
  name: string;
  description: string;
  created: string;
};

export type ADGroupMember = {
    username: string;
    email: string;
}

export type ADOu = {
  name: string;
  path: string;
  created: string;
};

export type LoggedOnUser = {
  username: string;
  session_name: string;
  id: string;
  state: string;
  idle_time: string;
  logon_time: string;
};

export type SnmpTrap = {
    source: string;
    timestamp: string;
    variables: {
        oid: string;
        value: string;
    }[];
};

export type SnmpLogEntry = {
    deviceId: string;
    deviceName: string;
    log: string;
    status: 'pending' | 'success' | 'error';
}
    
