interface ElectronAPI {
  getComputerName: () => Promise<string>;
  onComputerName: (callback: (event: any, ...args: any[]) => void) => void;
  getDiscoveredServers: () => Promise<any[]>;
  onDiscoveredServers: (callback: (event: any, ...args: any[]) => void) => void;
  getCurrentWiFi: () => Promise<any>;
  getSystemWiFi: () => Promise<any>;
  scanLocalNetworks: () => Promise<any>;
  discoverGalboxIPs: () => Promise<any>;
  updateGalBoxIP: (oldIP: string, newIP: string) => Promise<any>;
  updateEnvFile: (key: string, value: string) => Promise<any>;
  getGalaxies: () => Promise<any>;
  addGalaxy: (ip: string, galID: string) => Promise<any>;
  pingip: (ip: string) => Promise<any>;
  auth0Login: (config: {
    domain: string;
    clientId: string;
    audience: string;
    redirectUri: string;
  }) => Promise<{ code: string }>;
  auth0ExchangeCode: (config: {
    domain: string;
    clientId: string;
    code: string;
    redirectUri: string;
  }) => Promise<{
    access_token: string;
    refresh_token?: string;
    id_token?: string;
  }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    api: {
      discoverGalboxIPs: () => Promise<any>;
    };
  }
}

export {}; 