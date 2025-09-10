export type Device = {
  id: string;
  name: string;
  ipAddress: string;
  macAddress: string;
  status: 'online' | 'offline';
  type: 'laptop' | 'server' | 'router' | 'mobile' | 'iot' | 'desktop' | 'unknown';
  os: string;
  lastSeen: string;
  domain: string;
  isDomainMember: boolean;
  isLoadingDetails: boolean;
};

export type NetworkInterface = {
  id: string;
  name: string;
  ip: string;
  netmask: string;
  cidr: string;
};
