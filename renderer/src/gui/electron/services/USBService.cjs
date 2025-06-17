const { WebUSB } = require('usb');
const { ipcRenderer } = require('electron');

class USBService {
  constructor() {
    this._devices = new Map();
    this._deviceConfigs = new Map();
    this._ipcRenderer = ipcRenderer;

    this._setupEventListeners();
  }

  static getInstance() {
    if (!this._instance) {
      this._instance = new USBService();
    }
    return this._instance;
  }

  _setupEventListeners() {
    if (navigator.usb) {
      navigator.usb.addEventListener('connect', (event) => this._handleDeviceConnect(event.device));
      navigator.usb.addEventListener('disconnect', (event) => this._handleDeviceDisconnect(event.device));
    }

    this._ipcRenderer.on('device-ready', (_event, deviceId) => {
      const device = this._devices.get(deviceId);
      if (device) {
        device.ready = true;
      }
    });

    this._ipcRenderer.on('device-removed', (_event, deviceId) => {
      this._devices.delete(deviceId);
      this._deviceConfigs.delete(deviceId);
    });
  }

  _handleDeviceConnect(device) {
    const deviceId = device.serialNumber || String(Date.now());
    this._devices.set(deviceId, {
      id: deviceId,
      name: device.productName || 'Unknown Device',
      ready: false,
      device: device
    });
  }

  _handleDeviceDisconnect(device) {
    const deviceId = device.serialNumber || String(Date.now());
    this._devices.delete(deviceId);
    this._deviceConfigs.delete(deviceId);
  }

  async requestDevice() {
    try {
      const device = await navigator.usb.requestDevice({
        filters: [] // Accept any USB device
      });
      return this._handleDeviceConnect(device);
    } catch (error) {
      console.error('Error requesting USB device:', error);
      return null;
    }
  }

  getConnectedDevices() {
    return Array.from(this._devices.values());
  }

  completeDeviceSetup(serialNumber, config) {
    this._ipcRenderer.send('gal-setup-complete', { serialNumber, config });
  }

  getDevice(serialNumber) {
    return this._devices.get(serialNumber);
  }

  isDeviceConnected(serialNumber) {
    return this._devices.has(serialNumber);
  }
}

// Initialize the singleton instance
USBService._instance = null;

module.exports = {
  usbService: USBService.getInstance()
}; 