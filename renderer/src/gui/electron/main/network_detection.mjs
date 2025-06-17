import { exec } from 'child_process';
import os from 'os';

// Debug logging helper
function debug(...args) {
  // Only log if DEBUG is enabled or if it's an important message
  if (process.env.DEBUG || args[0]?.includes('SUCCESS') || args[0]?.includes('ERROR')) {
    console.log('[Network Detection]', ...args);
  }
}

// Store connected Linux boxes
export const connectedLinuxBoxes = new Map();

// Function to ping an IP address with more detailed output
async function pingHost(ip) {
  return new Promise((resolve) => {
    exec(`ping -c 1 -W 1 ${ip}`, (error, stdout, stderr) => {
      if (!error && stdout.includes('1 packets transmitted, 1 packets received')) {
        if (process.env.DEBUG) {
          debug(`SUCCESS: Host responding at ${ip}`);
        }
        resolve(true);
      } else {
        // Don't log failed pings unless in debug mode
        if (process.env.DEBUG) {
          debug(`Ping failed for ${ip}`);
        }
        resolve(false);
      }
    });
  });
}

// Function to check if a host is running Linux
async function checkIfLinux(ip) {
  return new Promise((resolve) => {
    if (process.env.DEBUG) {
      debug(`Attempting SSH to ${ip}...`);
    }
    exec(`ssh -o ConnectTimeout=2 -o BatchMode=yes -o StrictHostKeyChecking=no root@${ip} "uname -s"`, 
      (error, stdout, stderr) => {
        if (error && process.env.DEBUG) {
          debug(`SSH failed for ${ip}:`, error.message);
        } else if (!error && process.env.DEBUG) {
          debug(`SSH successful for ${ip}:`, stdout.trim());
        }
        if (!error && stdout.trim() === 'Linux') {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    );
  });
}

// Function to get hostname of a Linux box
async function getLinuxHostname(ip) {
  return new Promise((resolve) => {
    if (process.env.DEBUG) {
      debug(`Getting hostname for ${ip}...`);
    }
    exec(`ssh -o ConnectTimeout=2 -o BatchMode=yes -o StrictHostKeyChecking=no root@${ip} "hostname"`,
      (error, stdout, stderr) => {
        if (error && process.env.DEBUG) {
          debug(`Failed to get hostname for ${ip}:`, error.message);
        } else if (!error && process.env.DEBUG) {
          debug(`Got hostname for ${ip}:`, stdout.trim());
        }
        resolve(error ? null : stdout.trim());
      }
    );
  });
}

// Function to get IP address for an interface
async function getInterfaceIP(interfaceName) {
  return new Promise((resolve) => {
    if (process.env.DEBUG) {
      debug(`Getting IP for interface ${interfaceName}...`);
    }
    exec(`ipconfig getifaddr ${interfaceName}`, (error, stdout, stderr) => {
      if (error) {
        if (process.env.DEBUG) {
          debug(`No IP address found for interface ${interfaceName}:`, error.message);
        }
        resolve(null);
      } else {
        const ip = stdout.trim();
        if (process.env.DEBUG) {
          debug(`Found IP ${ip} for interface ${interfaceName}`);
        }
        resolve(ip);
      }
    });
  });
}

// Function to get network interface details
async function getInterfaceDetails(interfaceName) {
  return new Promise((resolve) => {
    exec(`ifconfig ${interfaceName}`, (error, stdout, stderr) => {
      if (error) {
        if (process.env.DEBUG) {
          debug(`Failed to get details for ${interfaceName}:`, error.message);
        }
        resolve(null);
      } else {
        if (process.env.DEBUG) {
          debug(`Interface details for ${interfaceName}:`, stdout.trim());
        }
        resolve(stdout.trim());
      }
    });
  });
}

// Function to scan network for Linux boxes
async function scanNetwork(subnet) {
  if (process.env.DEBUG) {
    debug(`Starting network scan on subnet ${subnet}`);
  }
  const results = [];
  const tasks = [];

  // Scan IPs in smaller batches to reduce network load
  const BATCH_SIZE = 10;
  for (let start = 2; start <= 254; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, 254);
    const batchTasks = [];
    
    for (let i = start; i <= end; i++) {
      const ip = `${subnet}.${i}`;
      batchTasks.push(
        (async () => {
          const isReachable = await pingHost(ip);
          if (isReachable) {
            if (process.env.DEBUG) {
              debug(`SUCCESS: Found reachable host at ${ip}`);
            }
            const isLinux = await checkIfLinux(ip);
            if (isLinux) {
              const hostname = await getLinuxHostname(ip);
              if (hostname) {
                debug(`SUCCESS: Identified Linux box: ${hostname} at ${ip}`);
                return { ip, hostname };
              }
            }
          }
          return null;
        })()
      );
    }
    
    const batchResults = await Promise.all(batchTasks);
    results.push(...batchResults.filter(result => result !== null));
  }

  return results;
}

// Function to get local subnet
async function getLocalSubnet() {
  const interfaces = os.networkInterfaces();
  let ethernetSubnet = null;
  let wifiSubnet = null;
  
  if (process.env.DEBUG) {
    debug('Available network interfaces:', Object.keys(interfaces));
  }
  
  // Find active interfaces
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    // Skip loopback and virtual interfaces
    if (name === 'lo0' || name.startsWith('bridge') || name.startsWith('utun')) {
      continue;
    }

    // Get detailed interface information
    await getInterfaceDetails(name);

    // Get IP address for this interface
    const ip = await getInterfaceIP(name);
    if (!ip) continue;

    // Check if this is WiFi (en0) or Ethernet
    if (name.startsWith('en0')) {
      wifiSubnet = ip.replace(/\d+$/, '0');
      if (process.env.DEBUG) {
        debug(`Found WiFi interface: ${name} with IP ${ip} (subnet: ${wifiSubnet})`);
      }
    } else if (name.startsWith('en')) {
      // This is an Ethernet interface
      ethernetSubnet = ip.replace(/\d+$/, '0');
      if (process.env.DEBUG) {
        debug(`Found Ethernet interface: ${name} with IP ${ip} (subnet: ${ethernetSubnet})`);
      }
    }
  }

  // If we found an Ethernet interface, use it
  if (ethernetSubnet) {
    debug(`SUCCESS: Using Ethernet subnet for Linux box detection: ${ethernetSubnet}`);
    return ethernetSubnet;
  }

  // If no Ethernet, but we have WiFi, use that
  if (wifiSubnet) {
    debug(`SUCCESS: No Ethernet found, falling back to WiFi subnet: ${wifiSubnet}`);
    return wifiSubnet;
  }

  debug('ERROR: No active network interfaces found');
  return null;
}

// Main function to set up network detection
export async function setupNetworkDetection(mainWindow) {
  debug('Setting up network detection...');
  
  // Initial check
  await checkNetwork(mainWindow);
  
  // Increase the interval to reduce network load
  const NETWORK_CHECK_INTERVAL = 120000; // Check every 2 minutes instead of every minute
  setInterval(async () => {
    await checkNetwork(mainWindow);
  }, NETWORK_CHECK_INTERVAL);
}

async function checkNetwork(mainWindow) {
  const subnet = await getLocalSubnet();
  if (!subnet) {
    debug('ERROR: No active network subnet found - skipping network scan');
    return;
  }

  if (process.env.DEBUG) {
    debug(`Starting network scan on subnet: ${subnet}`);
  }
  const linuxBoxes = await scanNetwork(subnet);
  
  if (linuxBoxes.length > 0) {
    debug(`SUCCESS: Found ${linuxBoxes.length} Linux boxes`);
    if (process.env.DEBUG) {
      debug('Linux boxes:', linuxBoxes);
    }
  } else if (process.env.DEBUG) {
    debug('No Linux boxes found on subnet:', subnet);
  }
  
  // Create a Map from the array of boxes
  const linuxBoxesMap = new Map(linuxBoxes.map(box => [box.ip, box]));
  
  // Only log significant changes
  for (const [ip, box] of linuxBoxesMap.entries()) {
    if (!connectedLinuxBoxes.has(ip)) {
      debug(`SUCCESS: New Linux box detected: ${ip} (${box.hostname})`);
      mainWindow.webContents.send('linux-box-connected', box);
    }
  }

  // Check for disconnected boxes
  for (const [ip] of connectedLinuxBoxes.entries()) {
    if (!linuxBoxesMap.has(ip)) {
      debug(`SUCCESS: Linux box disconnected: ${ip}`);
      mainWindow.webContents.send('linux-box-disconnected', { ip });
    }
  }

  // Update our connected boxes map
  connectedLinuxBoxes.clear();
  for (const [ip, box] of linuxBoxesMap.entries()) {
    connectedLinuxBoxes.set(ip, box);
  }
}

// Function to simulate a Linux box connection (for testing)
export function simulateLinuxBoxConnection(mainWindow) {
  const testDevice = {
    ip: '192.168.1.100',
    hostname: 'test-linux-box',
    systemInfo: 'Linux 5.15.0-1-amd64',
    status: 'connected',
    timestamp: Date.now()
  };
  
  mainWindow.webContents.send('linux-box-connected', testDevice);
} 