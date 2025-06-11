const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getComputerName: () => ipcRenderer.invoke('get-computer-name'),
  onComputerName: (callback) => ipcRenderer.on('computer-name', callback),
  onMessage: (callback) => ipcRenderer.on('message', callback),
  onDiscoveredServers: (callback) => ipcRenderer.on('discovered-servers', callback)
}); 