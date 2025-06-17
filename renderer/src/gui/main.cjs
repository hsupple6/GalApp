const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const remoteMain = require('@electron/remote/main');
const usb = require('usb');
const { exec } = require('child_process');
const fs = require('fs');
const { logger } = require('./src/utils/logger');

// Initialize remote before app is ready
remoteMain.initialize();

// Simple isDev check
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

// Track connected devices
const connectedDevices = new Map();

// Function to check Thunderbolt and USB devices using system_profiler
function checkSystemDevices(mainWindow) {
  logger.log('[device detection] ====== Starting System Device Check ======');
  
  // Check Thunderbolt devices
  logger.log('[device detection] Running Thunderbolt check...');
  exec("system_profiler SPThunderboltDataType -json", (error, stdout) => {
    if (error) {
      logger.log('[device detection] Error checking Thunderbolt devices:', error);
      return;
    }
    try {
      const data = JSON.parse(stdout);
      logger.log('[device detection] Raw Thunderbolt data:', stdout);
      logger.log('[device detection] Parsed Thunderbolt devices:', JSON.stringify(data, null, 2));
      
      // Send to renderer
      mainWindow.webContents.send('thunderbolt-devices', data);
    } catch (e) {
      logger.log('[device detection] Error parsing Thunderbolt data:', e);
      logger.log('[device detection] Raw stdout:', stdout);
    }
  });
  
  // Check USB devices
  logger.log('[device detection] Running USB check...');
  exec("system_profiler SPUSBDataType -json", (error, stdout) => {
    if (error) {
      logger.log('[device detection] Error checking USB devices:', error);
      return;
    }
    try {
      const data = JSON.parse(stdout);
      logger.log('[device detection] Raw USB data:', stdout);
      logger.log('[device detection] Parsed USB devices:', JSON.stringify(data, null, 2));
      
      // Send to renderer
      mainWindow.webContents.send('usb-devices-system', data);
    } catch (e) {
      logger.log('[device detection] Error parsing USB data:', e);
      logger.log('[device detection] Raw stdout:', stdout);
    }
  });
  
  // Check mounted volumes
  logger.log('[device detection] Checking mounted volumes...');
  fs.readdir('/Volumes', (err, files) => {
    if (err) {
      logger.log('[device detection] Error checking volumes:', err);
      return;
    }
    logger.log('[device detection] Found mounted volumes:', files);
    
    // Send to renderer
    mainWindow.webContents.send('mounted-volumes', files);
  });
  
  logger.log('[device detection] ====== System Device Check Complete ======');
}

// Enable USB device detection
function setupUSBDetection(mainWindow) {
  logger.log('[electron USB] ====== Starting USB Detection ======');
  logger.log('[electron USB] USB module version:', usb.version);
  
  try {
    // Log all USB devices on startup
    logger.log('[electron USB] Scanning for connected USB devices...');
    const devices = usb.getDeviceList();
    logger.log('[electron USB] Found', devices.length, 'USB devices');
    
    devices.forEach((device, index) => {
      try {
        logger.log(`[electron USB] Device ${index + 1}/${devices.length}:`);
        logger.log('[electron USB] Raw device descriptor:', device.deviceDescriptor);
        
        const deviceInfo = {
          vendorId: device.deviceDescriptor.idVendor,
          productId: device.deviceDescriptor.idProduct,
          serialNumber: device.deviceDescriptor.iSerialNumber,
          manufacturer: device.deviceDescriptor.iManufacturer,
          product: device.deviceDescriptor.iProduct,
          class: device.deviceDescriptor.bDeviceClass,
          subClass: device.deviceDescriptor.bDeviceSubClass,
          protocol: device.deviceDescriptor.bDeviceProtocol
        };
        
        logger.log('[electron USB] Parsed device info:', deviceInfo);
        
        try {
          device.open();
          logger.log('[electron USB] Successfully opened device');
          
          // Try to get string descriptors
          if (deviceInfo.manufacturer) {
            device.getStringDescriptor(deviceInfo.manufacturer, (err, manufacturer) => {
              if (err) {
                logger.log('[electron USB] Error getting manufacturer:', err.message);
              } else {
                logger.log('[electron USB] Manufacturer:', manufacturer);
              }
            });
          }
          
          if (deviceInfo.product) {
            device.getStringDescriptor(deviceInfo.product, (err, product) => {
              if (err) {
                logger.log('[electron USB] Error getting product:', err.message);
              } else {
                logger.log('[electron USB] Product:', product);
              }
            });
          }
          
          device.close();
          logger.log('[electron USB] Successfully closed device');
        } catch (e) {
          logger.log('[electron USB] Error accessing device:', e.message);
        }
      } catch (e) {
        logger.log('[electron USB] Error processing device:', e.message);
      }
    });

    logger.log('[electron USB] Setting up USB event listeners...');
    
    // Use the correct event handling method
    usb.addListener('attach', (device) => {
      logger.log('[electron USB] ====== USB Attach Event ======');
      logger.log('[electron USB] Raw device descriptor:', device.deviceDescriptor);
      
      try {
        device.open();
        const deviceInfo = {
          vendorId: device.deviceDescriptor.idVendor,
          productId: device.deviceDescriptor.idProduct,
          serialNumber: device.deviceDescriptor.iSerialNumber,
          manufacturer: device.deviceDescriptor.iManufacturer,
          product: device.deviceDescriptor.iProduct,
          class: device.deviceDescriptor.bDeviceClass,
          subClass: device.deviceDescriptor.bDeviceSubClass,
          protocol: device.deviceDescriptor.bDeviceProtocol
        };
        logger.log('[electron USB] Device attached:', deviceInfo);
        
        if (deviceInfo.manufacturer || deviceInfo.product) {
          logger.log('[electron USB] Attempting to get string descriptors...');
          try {
            if (deviceInfo.manufacturer) {
              device.getStringDescriptor(deviceInfo.manufacturer, (err, manufacturer) => {
                if (err) {
                  logger.log('[electron USB] Error getting manufacturer:', err.message);
                } else {
                  logger.log('[electron USB] Manufacturer:', manufacturer);
                  deviceInfo.manufacturerString = manufacturer;
                }
              });
            }
            
            if (deviceInfo.product) {
              device.getStringDescriptor(deviceInfo.product, (err, product) => {
                if (err) {
                  logger.log('[electron USB] Error getting product:', err.message);
                } else {
                  logger.log('[electron USB] Product:', product);
                  deviceInfo.productString = product;
                }
              });
            }
          } catch (e) {
            logger.log('[electron USB] Error getting string descriptors:', e.message);
          }
        }
        
        device.close();
        logger.log('[electron USB] Device processing complete');
        
        // Send event to renderer
        mainWindow.webContents.send('usb-device-attached', deviceInfo);
      } catch (e) {
        logger.log('[electron USB] Error processing attached device:', e.message);
      }
    });

    usb.addListener('detach', (device) => {
      logger.log('[electron USB] ====== USB Detach Event ======');
      logger.log('[electron USB] Raw device descriptor:', device.deviceDescriptor);
      
      const deviceInfo = {
        vendorId: device.deviceDescriptor.idVendor,
        productId: device.deviceDescriptor.idProduct,
        serialNumber: device.deviceDescriptor.iSerialNumber
      };
      logger.log('[electron USB] Device detached:', deviceInfo);
      
      // Send event to renderer
      mainWindow.webContents.send('usb-device-detached', deviceInfo);
    });

    // Enable USB device debugging
    usb.setDebugLevel(4); // Maximum debug level
    logger.log('[electron USB] USB detection initialized with debug level 4');
    logger.log('[electron USB] ====== USB Detection Setup Complete ======');
    
  } catch (e) {
    logger.log('[electron USB] Error setting up USB detection:', e.message);
    logger.log('[electron USB] Error stack:', e.stack);
  }
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 1100,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      preload: path.resolve(__dirname, 'preload.cjs'),
      sandbox: false,
    },
  });

  // Enable remote before loading URL
  remoteMain.enable(mainWindow.webContents);

  await mainWindow.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, 'build/index.html')}`);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Set up IPC handlers for USB events
  setupUSBHandlers(mainWindow);

  // Set up USB detection
  setupUSBDetection(mainWindow);
  
  // Initial system device check
  checkSystemDevices(mainWindow);
  
  // Set up periodic system device checks
  setInterval(() => checkSystemDevices(mainWindow), 5000);
}

function setupUSBHandlers(mainWindow) {
  ipcMain.on('gal-device-connected', (event, device) => {
    logger.log('[electron USB] Gal device connected:', device);
    connectedDevices.set(device.serialNumber, device);
    
    // Show the setup modal
    mainWindow.webContents.send('show-gal-setup-modal', device);
  });

  ipcMain.on('gal-device-disconnected', (event, { serialNumber }) => {
    logger.log('[electron USB] Gal device disconnected:', serialNumber);
    connectedDevices.delete(serialNumber);
    
    // Notify renderer about disconnection
    mainWindow.webContents.send('gal-device-removed', serialNumber);
  });

  // Handle setup completion
  ipcMain.on('gal-setup-complete', (event, { serialNumber, config }) => {
    const device = connectedDevices.get(serialNumber);
    if (device) {
      device.configured = true;
      device.config = config;
      connectedDevices.set(serialNumber, device);
      
      // Notify renderer that device is ready
      mainWindow.webContents.send('gal-device-ready', device);
      logger.log('[electron USB] Device setup complete:', device);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
