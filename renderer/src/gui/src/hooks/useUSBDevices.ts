import { useEffect, useState } from 'react';
import { debug } from '../utils/debug';

// Helper function to check if electron is available
const isElectronAvailable = () => {
  return !!(window.electron && window.electron.ipcRenderer);
};

export interface GalDevice {
  name: string;
  vendorId: number;
  productId: number;
  manufacturer: string;
  serialNumber: string;
  locationId: string;
  ip?: string;  // Optional IP address that will be set when device is connected
  configured?: boolean;
  config?: any;
}

interface SystemUSBDevice {
  _name: string;
  manufacturer: string;
  vendor_id: string;
  product_id: string;
  serial_num: string;
  bcd_device: string;
}

interface ThunderboltDevice {
  _name: string;
  device_name: string;
  vendor_name: string;
  device_id: string;
  vendor_id: string;
}

export function useUSBDevices() {
  const [devices, setDevices] = useState<GalDevice[]>([]);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<GalDevice | null>(null);
  const [systemUSBDevices, setSystemUSBDevices] = useState<SystemUSBDevice[]>([]);
  const [thunderboltDevices, setThunderboltDevices] = useState<ThunderboltDevice[]>([]);
  const [mountedVolumes, setMountedVolumes] = useState<string[]>([]);

  useEffect(() => {
    debug.setContext('useUSBDevices').log('Initializing USB device hook');

    // Only set up USB device listeners in Electron environment
    if (isElectronAvailable()) {
      const ipcRenderer = window.electron.ipcRenderer;

      // Define event handlers
      const handleDeviceConnected = (device: GalDevice) => {
        debug.log('Gal device connected:', device);
        setDevices(prev => [...prev, device]);
        setCurrentDevice(device);
        setShowSetupModal(true);
      };

      const handleDeviceRemoved = ({ serialNumber }: { serialNumber: string }) => {
        debug.log('Gal device removed:', serialNumber);
        setDevices(prev => prev.filter(d => d.serialNumber !== serialNumber));
        if (currentDevice?.serialNumber === serialNumber) {
          setCurrentDevice(null);
          setShowSetupModal(false);
        }
      };

      const handleSystemUSBDevices = (data: any) => {
        debug.log('System USB devices updated:', data);
        setSystemUSBDevices(data);
      };

      const handleThunderboltDevices = (data: any) => {
        debug.log('Thunderbolt devices updated:', data);
        setThunderboltDevices(data);
      };

      const handleMountedVolumes = (volumes: string[]) => {
        // Only log and update state if volumes have actually changed
        if (!areArraysEqual(volumes, mountedVolumes)) {
          debug.log('Mounted volumes updated:', volumes);
          setMountedVolumes(volumes);
        }
      };

      // Helper function to compare arrays
      const areArraysEqual = (arr1: string[], arr2: string[]): boolean => {
        if (arr1.length !== arr2.length) return false;
        return arr1.every((item, index) => item === arr2[index]);
      };

      // Set up device detection handlers
      ipcRenderer.on('gal-device-connected', handleDeviceConnected);
      ipcRenderer.on('gal-device-removed', handleDeviceRemoved);
      ipcRenderer.on('usb-devices-system', handleSystemUSBDevices);
      ipcRenderer.on('thunderbolt-devices', handleThunderboltDevices);
      ipcRenderer.on('mounted-volumes', handleMountedVolumes);

      return () => {
        // Clean up event listeners
        ipcRenderer.removeListener('gal-device-connected', handleDeviceConnected);
        ipcRenderer.removeListener('gal-device-removed', handleDeviceRemoved);
        ipcRenderer.removeListener('usb-devices-system', handleSystemUSBDevices);
        ipcRenderer.removeListener('thunderbolt-devices', handleThunderboltDevices);
        ipcRenderer.removeListener('mounted-volumes', handleMountedVolumes);
      };
    } else {
      debug.log('Running in browser environment - USB device detection disabled');
    }
  }, [currentDevice]);

  const completeDeviceSetup = async (config: any) => {
    if (!currentDevice) return;
    
    if (isElectronAvailable()) {
      debug.log('Completing device setup:', { device: currentDevice, config });
      window.electron.ipcRenderer.send('gal-setup-complete', {
        serialNumber: currentDevice.serialNumber,
        config
      });
    } else {
      debug.log('Device setup not available in browser environment');
    }
    
    setShowSetupModal(false);
  };

  return {
    devices,
    showSetupModal,
    setShowSetupModal,
    currentDevice,
    setCurrentDevice,
    completeDeviceSetup,
    systemUSBDevices,
    thunderboltDevices,
    mountedVolumes
  };
} 