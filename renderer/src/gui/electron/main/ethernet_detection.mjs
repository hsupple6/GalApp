import { exec } from 'child_process';

// Debug logging helper
function debug(...args) {
  console.log('[Ethernet Detection]', ...args);
}

// Function to parse networksetup output
function parseNetworksetupOutput(output) {
  const interfaces = [];
  const lines = output.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && line !== '(Hardware Port)') {
      interfaces.push({
        name: line,
        hardware: lines[i + 1]?.trim() || '',
        device: lines[i + 2]?.trim() || ''
      });
      i += 2; // Skip the next two lines as we've already processed them
    }
  }
  
  return interfaces;
}

// Function to check if an interface is an Ethernet connection
function isEthernetInterface(iface) {
  return iface.hardware.toLowerCase().includes('ethernet') ||
         iface.name.toLowerCase().includes('ethernet') ||
         iface.name.toLowerCase().includes('lan');
}

// Function to get IP address for an interface
async function getInterfaceIP(interfaceName) {
  return new Promise((resolve, reject) => {
    exec(`ipconfig getifaddr "${interfaceName}"`, (error, stdout) => {
      if (error) {
        debug(`Error getting IP for interface ${interfaceName}:`, error);
        resolve(null);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

// Main function to detect Ethernet connections
export function setupEthernetDetection(mainWindow) {
  debug('Setting up Ethernet detection...');

  async function checkEthernetConnections() {
    try {
      // Get list of network interfaces
      const interfaces = await new Promise((resolve, reject) => {
        exec('networksetup -listallhardwareports', (error, stdout) => {
          if (error) {
            debug('Error listing hardware ports:', error);
            reject(error);
            return;
          }
          resolve(parseNetworksetupOutput(stdout));
        });
      });

      // Filter for Ethernet interfaces and get their IPs
      const ethernetInterfaces = interfaces.filter(isEthernetInterface);
      debug('Found Ethernet interfaces:', ethernetInterfaces);

      // Get IP addresses for each interface
      const connectedInterfaces = await Promise.all(
        ethernetInterfaces.map(async (iface) => {
          const ip = await getInterfaceIP(iface.device);
          return {
            ...iface,
            ip,
            connected: !!ip
          };
        })
      );

      // Filter for actually connected interfaces
      const activeConnections = connectedInterfaces.filter(iface => iface.connected);
      debug('Active Ethernet connections:', activeConnections);

      // Notify renderer about ethernet connections
      mainWindow.webContents.send('ethernet-connections-updated', activeConnections);

      return activeConnections;
    } catch (error) {
      debug('Error checking Ethernet connections:', error);
      return [];
    }
  }

  // Initial check
  checkEthernetConnections();

  // Set up periodic checks
  const CHECK_INTERVAL = 5000; // 5 seconds
  const intervalId = setInterval(checkEthernetConnections, CHECK_INTERVAL);

  // Clean up on window close
  mainWindow.on('closed', () => {
    clearInterval(intervalId);
  });

  // Return the check function for manual checks
  return checkEthernetConnections;
} 