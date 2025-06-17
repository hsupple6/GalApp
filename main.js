const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const dgram = require('dgram');
const { exec } = require('child_process');
const https = require('https');
const http = require('http');
const fs = require('fs');
const isDev = !app.isPackaged;
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store').default;
const store = new Store();

// Suppress SSL certificate errors in development
if (isDev) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Load environment variables from .env file
function loadEnvFile() {
  try {
    // First try to load from galos-gui .env file
    const galosEnvPath = path.join(__dirname, 'renderer', 'src', 'galos-gui', '.env');
    const mainEnvPath = path.join(__dirname, 'renderer', '.env');
    
    let envContent = '';
    
    // Try galos-gui .env first, then fall back to main .env
    if (fs.existsSync(galosEnvPath)) {
      envContent = fs.readFileSync(galosEnvPath, 'utf8');
      console.log('Loading environment from galos-gui .env file');
    } else if (fs.existsSync(mainEnvPath)) {
      envContent = fs.readFileSync(mainEnvPath, 'utf8');
      console.log('Loading environment from main .env file');
    }
    
    if (envContent) {
      const envVars = {};
      
      envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
      
      return envVars;
    }
  } catch (error) {
    console.log('Error loading .env file:', error.message);
  }
  return {};
}

const envVars = loadEnvFile();

// GalBox configuration from environment variables
const GALBOX_IP_BASE = envVars.REACT_APP_GALBOX_IP_BASE || '192.168.1';
const GALBOX_PORT = 5420;
const DEFAULT_GATEWAY = envVars.REACT_APP_DEFAULT_GATEWAY || '192.168.1.1';
const GALBOX_IP = envVars.REACT_APP_GALBOX_IP || '192.168.1.100';

console.log('Loaded environment variables:', { GALBOX_IP_BASE, GALBOX_PORT, DEFAULT_GATEWAY, GALBOX_IP });

let mainWindow;
let discoveredServers = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3002');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'build', 'index.html'));
  }

  // Send computer name to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('computer-name', os.hostname());
  });

  // Send discovered servers to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('discovered-servers', discoveredServers);
  });

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('message', 'Update available. Downloading...');
  });
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('message', 'Update downloaded. It will be installed on restart.');
  });

  // Start server discovery
  startServerDiscovery();

  mainWindow.webContents.openDevTools();
}

// UDP discovery
function startServerDiscovery() {
  const socket = dgram.createSocket('udp4');
  
  socket.on('error', (err) => {
    console.log(`UDP socket error:\n${err.stack}`);
    socket.close();
  });

  socket.on('message', (msg, rinfo) => {
    const message = msg.toString();
    if (message.startsWith('GALBOX_SERVER:')) {
      const parts = message.split(':');
      if (parts.length >= 3) {
        const serverIP = parts[1];
        const serverPort = parts[2];
        const serverUrl = `http://${serverIP}:${serverPort}`;
        
        // Check if server is already in the list
        const existingServer = discoveredServers.find(s => s.ip === serverIP);
        if (!existingServer) {
          discoveredServers.push({
            ip: serverIP,
            port: serverPort,
            url: serverUrl
          });
          console.log(`Discovered server: ${serverUrl}`);
          
          // Send to renderer
          if (mainWindow) {
            mainWindow.webContents.send('discovered-servers', discoveredServers);
          }
        }
      }
    }
  });

  socket.bind(8485, () => {
    socket.setBroadcast(true);
    console.log('Listening for server broadcasts on port 8485');
  });
}

// IPC handler for computer name
ipcMain.handle('get-computer-name', () => {
  return os.hostname();
});

ipcMain.handle('get-discovered-servers', () => {
  return discoveredServers;
});

// WiFi detection methods
ipcMain.handle('get-current-wifi', () => {
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      // macOS - try networksetup first
      exec('networksetup -getairportnetwork en0', (error, stdout, stderr) => {
        if (error) {
          console.log('networksetup error:', error);
          reject(error);
          return;
        }
        
        console.log('networksetup output:', stdout);
        
        if (stdout.includes('You are not associated with an AirPort network')) {
          resolve({ ssid: null, error: 'Not connected to WiFi' });
          return;
        }
        
        const match = stdout.match(/Current Wi-Fi Network: (.+)/);
        const ssid = match ? match[1].trim() : null;
        
        console.log('Detected SSID:', ssid);
        resolve({ ssid: ssid });
      });
    } else if (process.platform === 'win32') {
      // Windows
      exec('netsh wlan show interfaces', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        const lines = stdout.split('\n');
        let ssid = null;
        
        for (const line of lines) {
          if (line.includes('SSID')) {
            const match = line.match(/SSID\s+:\s+(.+)/);
            if (match) {
              ssid = match[1].trim();
              break;
            }
          }
        }
        
        resolve({ ssid: ssid });
      });
    } else {
      // Linux
      exec('iwgetid -r', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        const ssid = stdout.trim();
        resolve({ ssid: ssid || null });
      });
    }
  });
});

ipcMain.handle('get-system-wifi', () => {
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      // macOS - try alternative method
      exec('system_profiler SPAirPortDataType | grep "Current Network Information" -A 10', (error, stdout, stderr) => {
        if (error) {
          console.log('system_profiler error:', error);
          reject(error);
          return;
        }
        
        console.log('system_profiler output:', stdout);
        
        const lines = stdout.split('\n');
        let ssid = null;
        
        for (const line of lines) {
          if (line.includes('Network Name:')) {
            const match = line.match(/Network Name:\s+(.+)/);
            if (match) {
              ssid = match[1].trim();
              break;
            }
          }
        }
        
        console.log('Detected SSID from system_profiler:', ssid);
        resolve({ ssid: ssid });
      });
    } else {
      // Fallback to get-current-wifi for other platforms
      exec('iwgetid -r', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        const ssid = stdout.trim();
        resolve({ ssid: ssid || null });
      });
    }
  });
});

// Local WiFi network scanning
ipcMain.handle('scan-local-networks', () => {
  console.log('scan-local-networks called');
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      console.log('Running on macOS, scanning networks...');
      // macOS - use networksetup directly since airport is deprecated
      console.log('Using networksetup to get saved networks...');
      exec('networksetup -listpreferredwirelessnetworks en0', (error, stdout, stderr) => {
        if (error) {
          console.log('networksetup error:', error);
          resolve([]);
          return;
        }
        
        console.log('Raw networksetup output:', stdout);
        const lines = stdout.split('\n');
        const networks = [];
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          // Skip header and empty lines
          if (trimmedLine && 
              !trimmedLine.includes('Preferred networks') && 
              !trimmedLine.includes('WARNING') &&
              !trimmedLine.includes('airport command') &&
              !trimmedLine.includes('deprecated')) {
            networks.push({
              ssid: trimmedLine,
              security: 'Known Network',
              signal: 'Saved'
            });
          }
        }
        
        console.log('Found saved networks:', networks);
        console.log('Resolving with', networks.length, 'networks');
        resolve(networks);
      });
    } else if (process.platform === 'win32') {
      // Windows - scan for networks
      exec('netsh wlan show networks', (error, stdout, stderr) => {
        if (error) {
          console.log('netsh error:', error);
          resolve([]);
          return;
        }
        
        const lines = stdout.split('\n');
        const networks = [];
        let currentNetwork = {};
        
        for (const line of lines) {
          if (line.includes('SSID')) {
            const match = line.match(/SSID\s+\d+\s+:\s+(.+)/);
            if (match) {
              if (currentNetwork.ssid) {
                networks.push(currentNetwork);
              }
              currentNetwork = { ssid: match[1].trim() };
            }
          } else if (line.includes('Authentication')) {
            const match = line.match(/Authentication\s+:\s+(.+)/);
            if (match) {
              currentNetwork.security = match[1].trim();
            }
          } else if (line.includes('Signal')) {
            const match = line.match(/Signal\s+:\s+(.+)/);
            if (match) {
              currentNetwork.signal = match[1].trim();
            }
          }
        }
        
        if (currentNetwork.ssid) {
          networks.push(currentNetwork);
        }
        
        console.log('Found networks:', networks);
        resolve(networks);
      });
    } else {
      // Linux - scan for networks
      exec('iwlist wlan0 scan | grep -E "ESSID|Quality|Encryption"', (error, stdout, stderr) => {
        if (error) {
          console.log('iwlist error:', error);
          resolve([]);
          return;
        }
        
        const lines = stdout.split('\n');
        const networks = [];
        let currentNetwork = {};
        
        for (const line of lines) {
          if (line.includes('ESSID')) {
            const match = line.match(/ESSID:"([^"]*)"/);
            if (match) {
              if (currentNetwork.ssid) {
                networks.push(currentNetwork);
              }
              currentNetwork = { ssid: match[1] };
            }
          } else if (line.includes('Quality')) {
            const match = line.match(/Quality=(\d+)/);
            if (match) {
              currentNetwork.signal = match[1] + '%';
            }
          } else if (line.includes('Encryption')) {
            const match = line.match(/Encryption key:(.+)/);
            if (match) {
              currentNetwork.security = match[1].trim() === 'on' ? 'Encrypted' : 'Open';
            }
          }
        }
        
        if (currentNetwork.ssid) {
          networks.push(currentNetwork);
        }
        
        console.log('Found networks:', networks);
        resolve(networks);
      });
    }
  });
});

ipcMain.handle('pingip', (event, ip) => {
  console.log('pingip called with:', ip);
  const url = `http://${ip}:5420/status`;
  return new Promise((resolve, reject) => {
    const timeout = 3000; // 5 second timeout
    let data = '';
    const req = http.get(url, (response) => {
      console.log('Status code:', response.statusCode);
      response.on('data', (chunk) => {
        data += chunk.toString();
      });
      response.on('end', () => {
        console.log('pingip response:', data);
        resolve(data);
      });
    });
    req.on('error', (err) => {
      console.error('pingip error:', err);
      resolve(false);
    });
    req.setTimeout(timeout, () => {
      resolve(false);
    });
  });
});

ipcMain.handle('update-galbox-ip', (event, oldIP, newIP) => {
  let galaxies = store.get('galaxies', []);
  if (!Array.isArray(galaxies)) galaxies = [];
  let updated = false;

  galaxies = galaxies.map(galaxy => {
    if (galaxy.ip === oldIP) {
      updated = true;
      return { ...galaxy, ip: newIP };
    }
    return galaxy;
  });

  if (updated) {
    store.set('galaxies', galaxies);
  }

  return updated;
});

// GalBox IP discovery
ipcMain.handle('discover-galbox-ips', () => {
  console.log('discover-galbox-ips called');
  return new Promise((resolve, reject) => {
    const discoveredIPs = [];
    const maxConcurrent = 50; // Limit concurrent requests
    const totalIPs = 254;
    let completed = 0;
    let activeRequests = 0;
    let foundGalBox = false;

    const checkIP = (ip) => {
      return new Promise((resolve) => {
        const url = `http://${GALBOX_IP_BASE}.${ip}:${GALBOX_PORT}/status`;
        const timeout = 5000; // 5 second timeout
        let data = '';
        let galID = null;

        console.log(`Checking IP: ${GALBOX_IP_BASE}.${ip}`);

        const timeoutId = setTimeout(() => {
          console.log(`Timeout for IP: ${GALBOX_IP_BASE}.${ip}`);
          resolve(); // Timeout, continue
        }, timeout);

        const req = http.get(url, (response) => {
          response.on('data', (chunk) => {
            data += chunk.toString();
          });

          response.on('end', () => {
            clearTimeout(timeoutId);
            console.log(`Full response from ${GALBOX_IP_BASE}.${ip}:`, data);
            let isGalBox = false;
            try {
              const json = JSON.parse(data);
              isGalBox = json.device === 'GalBox';
              galID = json.galID || null;
            } catch (e) {
              isGalBox = data.includes('GalBox');
              galID = null;
            }
            if (isGalBox) {
              console.log(`Found GalBox at ${GALBOX_IP_BASE}.${ip} with galID: ${galID}`);
              discoveredIPs.push({ ip: `${GALBOX_IP_BASE}.${ip}`, galID });
              foundGalBox = true;
            } else {
              console.log(`No GalBox detected at ${GALBOX_IP_BASE}.${ip}`);
            }
            resolve();
          });
        });

        req.on('error', (err) => {
          clearTimeout(timeoutId);
          console.log(`Error connecting to ${GALBOX_IP_BASE}.${ip}:`, err.message);
          resolve(); // Don't reject, just continue
        });

        req.setTimeout(timeout, () => {
          clearTimeout(timeoutId);
          console.log(`Request timeout for ${GALBOX_IP_BASE}.${ip}`);
          req.destroy();
          resolve();
        });
      });
    };

    const processNextBatch = async () => {
      while (completed < totalIPs && activeRequests < maxConcurrent) {
        const currentIP = completed + 1;
        activeRequests++;

        checkIP(currentIP).then(() => {
          activeRequests--;
          completed++;

          // Continue processing until all IPs are checked
          if (completed < totalIPs) {
            processNextBatch();
          } else if (activeRequests === 0) {
            // All done - add a small delay to ensure all responses are processed
            setTimeout(() => {
              console.log('IP scan complete, found IPs:', discoveredIPs);
              resolve(discoveredIPs);
            }, 100);
          }
        });
      }
    };

    // Start the scanning process
    if (!foundGalBox) {
      processNextBatch();
    } else {
      resolve(discoveredIPs);
    }
  });
});

// IPC handler to update .env file
ipcMain.handle('update-env-file', async (event, key, value) => {
  try {
    // Change path to galos-gui directory
    const envPath = path.join(__dirname, 'renderer', 'src', 'galos', 'gui', '.env');
    
    if (!fs.existsSync(envPath)) {
      console.log('.env file does not exist in galos-gui, creating it...');
      fs.writeFileSync(envPath, '');
    }
    
    let envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    let keyFound = false;
    
    // Update existing key or add new one
    const updatedLines = lines.map(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith(`${key}=`)) {
        keyFound = true;
        return `${key}=${value}`;
      }
      return line;
    });
    
    if (!keyFound) {
      // Add new key-value pair
      updatedLines.push(`${key}=${value}`);
    }
    
    // Write back to file
    fs.writeFileSync(envPath, updatedLines.join('\n'));
    
    console.log(`Updated galos-gui .env file: ${key}=${value}`);
    
    // Reload environment variables
    const newEnvVars = loadEnvFile();
    console.log('Reloaded environment variables:', newEnvVars);
    
    return true;
  } catch (error) {
    console.error('Error updating galos-gui .env file:', error);
    return false;
  }
});

// Start galOS GUI server
function startGalOSServer() {
  const galosServerPath = path.join(__dirname, 'renderer', 'src', 'galos-gui', 'serve.cjs');
  
  // Check if the server file exists
  if (!fs.existsSync(galosServerPath)) {
    console.log('galOS GUI server file not found:', galosServerPath);
    return;
  }
  
  // Check if server is already running on port 3000
  const testServer = http.get('http://localhost:3000/api/galbox-ip', (res) => {
    console.log('galOS GUI server is already running on port 3000');
    testServer.destroy();
  }).on('error', (err) => {
    // Server is not running, start it
    console.log('Starting galOS GUI server...');
    
    // Start the server using Node.js
    const galosServer = exec(`node "${galosServerPath}"`, {
      cwd: path.join(__dirname, 'renderer', 'src', 'galos-gui')
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('Error starting galOS GUI server:', error);
        return;
      }
      console.log('galOS GUI server output:', stdout);
    });
    
    galosServer.stdout?.on('data', (data) => {
      console.log('galOS GUI server:', data.toString());
    });
    
    galosServer.stderr?.on('data', (data) => {
      console.error('galOS GUI server error:', data.toString());
    });
    
    // Store the process reference for cleanup
    global.galosServerProcess = galosServer;
    
    console.log('galOS GUI server started');
  });
  
  // Set a timeout for the test request
  testServer.setTimeout(2000, () => {
    testServer.destroy();
    console.log('Timeout checking if galOS GUI server is running, starting it...');
    
    // Start the server using Node.js
    const galosServer = exec(`node "${galosServerPath}"`, {
      cwd: path.join(__dirname, 'renderer', 'src', 'galos-gui')
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('Error starting galOS GUI server:', error);
        return;
      }
      console.log('galOS GUI server output:', stdout);
    });
    
    galosServer.stdout?.on('data', (data) => {
      console.log('galOS GUI server:', data.toString());
    });
    
    galosServer.stderr?.on('data', (data) => {
      console.error('galOS GUI server error:', data.toString());
    });
    
    // Store the process reference for cleanup
    global.galosServerProcess = galosServer;
    
    console.log('galOS GUI server started');
  });
}

ipcMain.handle('get-galaxies', async () => {
  return store.get('galaxies', []);
});

ipcMain.handle('add-galaxy', async (event, ip, galID) => {
  let galaxies = store.get('galaxies', []);
  if (!Array.isArray(galaxies)) galaxies = [];
  // Remove any existing entry with the same IP or galID
  galaxies = galaxies.filter(g => g.ip !== ip && g.galID !== galID);
  galaxies.push({ ip, galID });
  store.set('galaxies', galaxies);
  return true;
});

app.whenReady().then(() => {
  createWindow();
  startGalOSServer(); // Start the galOS GUI server
  autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
  // Stop the galOS GUI server if it's running
  if (global.galosServerProcess) {
    console.log('Stopping galOS GUI server...');
    global.galosServerProcess.kill();
    global.galosServerProcess = null;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 