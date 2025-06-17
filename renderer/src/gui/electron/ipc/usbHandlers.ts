import { BrowserWindow } from 'electron';

// Track connected devices
const connectedDevices = new Map();

export function setupUSBHandlers(mainWindow: BrowserWindow) {
  return {
    'gal-device-connected': (event: any, device: any) => {
      console.log('Gal device connected:', device);
      connectedDevices.set(device.serialNumber, device);
      
      // Show the setup modal
      mainWindow.webContents.send('show-gal-setup-modal', device);
    },

    'gal-device-disconnected': (event: any, { serialNumber }: { serialNumber: string }) => {
      console.log('Gal device disconnected:', serialNumber);
      connectedDevices.delete(serialNumber);
      
      // Notify renderer about disconnection
      mainWindow.webContents.send('gal-device-removed', serialNumber);
    },

    'gal-setup-complete': (event: any, { serialNumber, config }: { serialNumber: string, config: any }) => {
      const device = connectedDevices.get(serialNumber);
      if (device) {
        device.configured = true;
        device.config = config;
        connectedDevices.set(serialNumber, device);
        
        // Notify renderer that device is ready
        mainWindow.webContents.send('gal-device-ready', device);
      }
    }
  };
}

export function getConnectedDevices() {
  return Array.from(connectedDevices.values());
} 