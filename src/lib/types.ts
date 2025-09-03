export type Device = {
  id: string;
  name: string;
  ipAddress: string;
  macAddress: string;
  status: 'online' | 'offline';
  type: 'laptop' | 'server' | 'router' | 'mobile' | 'iot' | 'desktop';
  os: string;
  lastSeen: string;
};
