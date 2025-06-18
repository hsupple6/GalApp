const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getComputerName: () => ipcRenderer.invoke('get-computer-name'),
  onComputerName: (callback) => ipcRenderer.on('computer-name', callback),
  getDiscoveredServers: () => ipcRenderer.invoke('get-discovered-servers'),
  onDiscoveredServers: (callback) => ipcRenderer.on('discovered-servers', callback),
  getCurrentWiFi: () => ipcRenderer.invoke('get-current-wifi'),
  getSystemWiFi: () => ipcRenderer.invoke('get-system-wifi'),
  scanLocalNetworks: () => ipcRenderer.invoke('scan-local-networks'),
  discoverGalboxIPs: () => ipcRenderer.invoke('discover-galbox-ips'),
  updateGalBoxIP: (oldIP, newIP) => ipcRenderer.invoke('update-galbox-ip', oldIP, newIP),
  updateEnvFile: (key, value) => ipcRenderer.invoke('update-env-file', key, value),
  getGalaxies: () => ipcRenderer.invoke('get-galaxies'),
  addGalaxy: (ip, galID) => ipcRenderer.invoke('add-galaxy', ip, galID),
  pingip: (ip) => ipcRenderer.invoke('pingip', ip),
  auth0Login: (config) => ipcRenderer.invoke('auth0-login', config),
  auth0ExchangeCode: (config) => ipcRenderer.invoke('auth0-exchange-code', config)
});

contextBridge.exposeInMainWorld('api', {
  discoverGalboxIPs: () => ipcRenderer.invoke('discover-galbox-ips')
}); 