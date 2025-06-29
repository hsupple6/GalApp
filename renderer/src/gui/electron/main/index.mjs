import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import remoteMain from '@electron/remote/main/index.js';
import { protocol } from 'electron';
import fs from 'fs';
import { exec } from 'child_process';
import usb from 'usb';
import { setupNetworkDetection, connectedLinuxBoxes, simulateLinuxBoxConnection } from './network_detection.mjs';
import { spawn } from 'child_process';
import os from 'os';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug logging helper
function debug(...args) {
  // Only log if DEBUG is enabled or if it's an important message
  if (process.env.DEBUG || args[0]?.includes('SUCCESS') || args[0]?.includes('ERROR')) {
    console.log('[Main Process]', ...args);
  }
}

// Initialize remote before app is ready
remoteMain.initialize();
debug('Remote initialized');

// More robust isDev check
const isDev = process.env.NODE_ENV === 'development' || 
              process.env.DEBUG_PROD === 'true' ||
              !app.isPackaged;
debug('Environment:', process.env.NODE_ENV, 'isDev:', isDev, 'isPackaged:', app.isPackaged);

// Track connected devices and main window
const connectedDevices = new Map();
let mainWindow = null;

// USB device detection
function setupUSBDetection(mainWindow) {
  debug('[USB-DETECT] Setting up USB detection...');

  // Define Gal device identifiers (update these with your actual device IDs)
  const GAL_VENDOR_ID = 0x0bda;  // Realtek Semiconductor Corp.
  const GAL_PRODUCT_ID = 0x8153;  // USB 10/100/1000 LAN

  function isGalDevice(device) {
    // Only log in debug mode
    if (process.env.DEBUG) {
      debug('[USB-DETECT] Checking device:', device);
    }

    // Improved detection to distinguish between GalBox and regular external network adapters
    if (device.vendorId === GAL_VENDOR_ID && device.productId === GAL_PRODUCT_ID) {
      // This might be a GalBox, but might also be a regular network adapter
      // Check for additional identifiers specific to GalBox
      
      // Look for "GalBox" in the device name or manufacturer
      const nameMatches = device.name?.toLowerCase().includes('gal') || 
                          device.manufacturer?.toLowerCase().includes('gal');
                          
      if (nameMatches) {
        debug('[USB-DETECT] SUCCESS: Found Gal device by name/manufacturer:', device.name);
        return true;
      }
      
      // If we've already detected an active Ethernet connection with a direct link-local address,
      // this is very likely a GalBox
      setTimeout(async () => {
        try {
          const ip = await getLocalEthernetIP();
          if (ip && (ip.startsWith('169.254') || ip === '192.168.2.2')) {
            debug('[USB-DETECT] SUCCESS: Detected GalBox by Ethernet connection with link-local address:', ip);
            const galDevice = {
              ...device,
              ip: ip,
              isGalBox: true
            };
            mainWindow.webContents.send('gal-device-connected', galDevice);
          }
        } catch (error) {
          debug('[USB-DETECT] Error checking Ethernet connection:', error);
        }
      }, 2000); // Wait 2 seconds for the network connection to establish
      
      // Return false for now - we might detect it through other means later
      return false;
    }
    
    return false;
  }

  // Check for USB devices
  function checkUSBDevices() {
    if (process.env.DEBUG) {
      debug('[USB-DETECT] Checking USB devices...');
    }
    exec('system_profiler SPUSBDataType -json', (error, stdout) => {
      if (error) {
        debug('[USB-DETECT] ERROR: Failed to check USB devices:', error);
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const usbDevices = [];

        // Recursively find USB devices
        function findUSBDevices(obj) {
          if (Array.isArray(obj)) {
            obj.forEach(item => findUSBDevices(item));
          } else if (typeof obj === 'object' && obj !== null) {
            if (obj._name && obj.vendor_id) {
              usbDevices.push({
                name: obj._name,
                vendorId: parseInt(obj.vendor_id.replace('0x', ''), 16),
                productId: parseInt(obj.product_id.replace('0x', ''), 16),
                manufacturer: obj.manufacturer || '',
                serialNumber: obj.serial_num || '',
                locationId: obj.location_id || ''
              });
            }
            Object.values(obj).forEach(value => findUSBDevices(value));
          }
        }

        findUSBDevices(data);
        if (process.env.DEBUG) {
          debug('[USB-DETECT] Found USB devices:', usbDevices);
        }

        // Check for new devices
        usbDevices.forEach(device => {
          if (isGalDevice(device) && !connectedDevices.has(device.serialNumber)) {
            debug('[USB-DETECT] SUCCESS: New Gal device connected:', device);
            connectedDevices.set(device.serialNumber, device);
            mainWindow.webContents.send('gal-device-connected', device);
          }
        });

        // Check for removed devices
        for (const [serialNumber, device] of connectedDevices.entries()) {
          const stillConnected = usbDevices.some(d => d.serialNumber === serialNumber);
          if (!stillConnected) {
            debug('[USB-DETECT] SUCCESS: Gal device disconnected:', device);
            connectedDevices.delete(serialNumber);
            mainWindow.webContents.send('gal-device-removed', { serialNumber });
          }
        }
      } catch (err) {
        debug('[USB-DETECT] ERROR: Failed to parse USB device data:', err);
      }
    });
  }

  // Initial check
  checkUSBDevices();

  // Set up periodic checks with longer interval
  const CHECK_INTERVAL = 5000; // Increased from 2s to 5s
  const usbInterval = setInterval(checkUSBDevices, CHECK_INTERVAL);

  // Clean up on window close
  mainWindow.on('closed', () => {
    clearInterval(usbInterval);
  });
}

// Function to check system devices
function checkSystemDevices(mainWindow) {
  if (process.env.DEBUG) {
    debug('[DEVICE-CHECK] Starting System Device Check');
  }
  
  // Check USB devices
  exec("system_profiler SPUSBDataType -json", (error, stdout) => {
    if (error) {
      debug('[DEVICE-CHECK] ERROR: Failed to check USB devices:', error);
      return;
    }
    try {
      const data = JSON.parse(stdout);
      if (process.env.DEBUG) {
        debug('[DEVICE-CHECK] Found USB devices:', JSON.stringify(data, null, 2));
      }
      
      // Send to renderer
      mainWindow.webContents.send('usb-devices-system', data);
    } catch (e) {
      debug('[DEVICE-CHECK] ERROR: Failed to parse USB data:', e);
    }
  });
  
  // Check mounted volumes
  fs.readdir('/Volumes', (err, files) => {
    if (err) {
      debug('[DEVICE-CHECK] ERROR: Failed to check volumes:', err);
      return;
    }
    if (process.env.DEBUG) {
      debug('[DEVICE-CHECK] Found mounted volumes:', files);
    }
    
    // Send to renderer
    mainWindow.webContents.send('mounted-volumes', files);
  });
}

// Function to handle Linux setup completion
async function handleLinuxSetup(event, data) {
  try {
    const { ip, hostname } = data;
    await installGalOS(ip, hostname);
    mainWindow?.webContents.send('linux-setup-success', { ip, hostname });
  } catch (error) {
    mainWindow?.webContents.send('linux-setup-error', { error: error.message });
  }
}

// Function to install GalOS on Linux box
async function installGalOS(ip, hostname) {
  const scriptPath = path.join(__dirname, '../../scripts/install_galos.sh');
  return new Promise((resolve, reject) => {
    exec(`ssh root@${ip} 'bash -s' < ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

// Function to find Gal Box IP address
async function findGalBoxIP() {
  return new Promise((resolve, reject) => {
    exec('arp-scan --localnet', (error, stdout) => {
      if (error) {
        debug('[IP-DETECT] ERROR: Failed to scan network:', error);
        reject(error);
        return;
      }

      // Look for Realtek devices (Gal Box vendor ID)
      const realtekDevices = stdout.match(/169\.254\.\d+\.\d+.*Realtek/g);
      if (realtekDevices && realtekDevices.length > 0) {
        const ip = realtekDevices[0].split(/\s+/)[0];
        debug('[IP-DETECT] SUCCESS: Found Gal Box at IP:', ip);
        resolve(ip);
      } else {
        debug('[IP-DETECT] ERROR: No Gal Box found on network');
        reject(new Error('No Gal Box found on network'));
      }
    });
  });
}

function setupUSBHandlers(mainWindow) {
  ipcMain.on('gal-device-connected', async (event, device) => {
    debug('[USB-HANDLER] Gal device connected:', device);
    connectedDevices.set(device.serialNumber, device);
    
    try {
      // Find the Gal Box's IP address
      const ip = await findGalBoxIP();
      device.ip = ip;
      connectedDevices.set(device.serialNumber, device);
      
      // Show the setup modal with IP information
      debug('[USB-HANDLER] Sending show-gal-setup-modal event with IP:', ip);
      mainWindow.webContents.send('show-gal-setup-modal', device);
    } catch (error) {
      debug('[USB-HANDLER] ERROR: Failed to find Gal Box IP:', error);
      // Still show the modal, but without IP
      mainWindow.webContents.send('show-gal-setup-modal', device);
    }
  });

  ipcMain.on('gal-device-disconnected', (event, { serialNumber }) => {
    debug('[USB-HANDLER] Gal device disconnected:', serialNumber);
    connectedDevices.delete(serialNumber);
    
    // Notify renderer about disconnection
    mainWindow.webContents.send('gal-device-removed', serialNumber);
  });

  // Handle setup completion
  ipcMain.on('gal-setup-complete', (event, { serialNumber, config }) => {
    debug('[USB-HANDLER] Device setup complete:', { serialNumber, config });
    const device = connectedDevices.get(serialNumber);
    if (device) {
      device.configured = true;
      device.config = config;
      connectedDevices.set(serialNumber, device);
      
      // Notify renderer that device is ready
      mainWindow.webContents.send('gal-device-ready', device);
    }
  });
}

// Set up AI chat IPC handlers
function setupAIChatHandlers(mainWindow) {
  debug('Setting up AI chat IPC handlers');

  // Handle sending messages
  ipcMain.on('ai-chat-send-message', (event, { text, context }) => {
    debug('[AI-CHAT] Message received:', { text, context });
    // Process the message and send response back to renderer
    mainWindow.webContents.send('ai-chat-message', {
      id: Date.now().toString(),
      text: `Received: ${text}`,
      sender: 'ai',
      timestamp: new Date()
    });
  });

  // Handle message history
  ipcMain.on('ai-chat-send-message-history', (event, { text }) => {
    debug('[AI-CHAT] Message history received:', text);
    mainWindow.webContents.send('ai-chat-history-updated', {
      messages: [],
      timestamp: new Date()
    });
  });

  // Handle tool output
  ipcMain.on('ai-chat-tool-output', (event, { toolId, output, history }) => {
    debug('[AI-CHAT] Tool output received:', { toolId, output });
    mainWindow.webContents.send('ai-chat-message', {
      id: Date.now().toString(),
      text: `Tool output processed: ${output}`,
      sender: 'ai',
      timestamp: new Date()
    });
  });

  // Handle thread management
  ipcMain.on('ai-chat-create-thread', (event, { threadId, mode }) => {
    debug('[AI-CHAT] Thread created:', { threadId, mode });
    mainWindow.webContents.send('ai-chat-thread-created', { threadId, mode });
  });

  ipcMain.on('ai-chat-switch-thread', (event, { threadId }) => {
    debug('[AI-CHAT] Thread switched:', threadId);
    mainWindow.webContents.send('ai-chat-thread-switched', { threadId });
  });

  ipcMain.on('ai-chat-add-message', (event, message) => {
    debug('[AI-CHAT] Message added to thread:', message);
  });

  // Handle error logging
  ipcMain.on('ai-chat-error', (event, error) => {
    debug('[AI-CHAT] Error occurred:', error);
    mainWindow.webContents.send('ai-chat-error', error);
  });
}

// Helper function to execute SSH commands
async function executeSSHCommand(ip, command, credentials, event = null) {
  return new Promise((resolve, reject) => {
    // Construct the full command as a single string
    const sshCommand = `sshpass -p "${credentials.password}" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${credentials.username}@${ip} "${command}"`;
    
    debug('[SSH] Executing command:', command);
    debug('[SSH] Full command (without password):', sshCommand.replace(credentials.password, '********'));
    debug('[SSH] Using credentials:', { username: credentials.username, ip });
    
    // Send the command being executed to the terminal
    if (event) {
      event.sender.send('ollama-install-progress', {
        command: command,
        output: ''
      });
    }
    
    const ssh = spawn('sh', ['-c', sshCommand]);
    
    let output = '';
    let error = '';
    
    ssh.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      debug('[SSH] stdout:', str);
      
      // Send real-time output to the terminal
      if (event) {
        event.sender.send('ollama-install-progress', {
          output: str
        });
      }
      
      // Check for specific patterns in the output
      if (str.includes('Downloading') || str.includes('Installing')) {
        event?.sender.send('ollama-install-progress', {
          status: str.trim(),
          log: str.trim()
        });
      }
    });
    
    ssh.stderr.on('data', (data) => {
      const str = data.toString();
      // Don't add password prompts to error output
      if (!str.includes('[sudo] password for')) {
        error += str;
        debug('[SSH] stderr:', str);
        
        // Send error output to the terminal
        if (event) {
          event.sender.send('ollama-install-progress', {
            output: str
          });
        }
      }
    });
    
    ssh.on('close', (code) => {
      debug('[SSH] Command exited with code:', code);
      if (code === 0) {
        debug('[SSH] Command completed successfully');
        resolve(output.trim());
      } else {
        debug('[SSH] Command failed with error:', error);
        reject(new Error(`SSH command failed with code ${code}: ${error}`));
      }
    });

    ssh.on('error', (err) => {
      debug('[SSH] Spawn error:', err);
      reject(new Error(`Failed to execute SSH command: ${err.message}`));
    });
  });
}

// Function to install Ollama on Linux box
async function installOllama(event, { ip, credentials }) {
  try {
    debug('[OLLAMA] Starting installation...');
    debug('[OLLAMA] Using IP:', ip);
    debug('[OLLAMA] Using credentials:', { username: credentials.username });
    
    event.sender.send('ollama-install-progress', { 
      status: 'Checking system requirements...',
      progress: 10,
      log: `Connecting to ${ip}...`
    });
    
    // Test SSH connection first
    try {
      debug('[OLLAMA] Testing SSH connection...');
      await executeSSHCommand(ip, 'echo "SSH connection successful"', credentials, event);
      debug('[OLLAMA] SSH connection test successful');
      event.sender.send('ollama-install-progress', { 
        status: 'SSH connection established',
        progress: 20,
        log: 'SSH connection successful'
      });
    } catch (error) {
      debug('[OLLAMA] SSH connection test failed:', error);
      throw new Error(`Failed to connect to ${ip}: ${error.message}`);
    }
    
    // Check if curl is installed
    try {
      await executeSSHCommand(ip, 'which curl', credentials, event);
      event.sender.send('ollama-install-progress', { 
        status: 'curl is installed',
        progress: 30,
        log: 'curl is already installed'
      });
    } catch (error) {
      event.sender.send('ollama-install-progress', { 
        status: 'Installing curl...',
        progress: 40,
        log: 'Installing curl...'
      });
      
      // Use a heredoc to create a script that will be executed with sudo once
      const installCurlScript = `cat << 'EOSUDO' | sudo -S bash
${credentials.password}
apt-get update
apt-get install -y curl
EOSUDO`;
      
      await executeSSHCommand(ip, installCurlScript, credentials, event);
      event.sender.send('ollama-install-progress', { 
        status: 'curl installed successfully',
        progress: 50,
        log: 'curl installed successfully'
      });
    }
    
    event.sender.send('ollama-install-progress', { 
      status: 'Downloading Ollama installer...',
      progress: 60,
      log: 'Downloading Ollama installer...'
    });
    
    // Download and run the Ollama installation script using a single sudo session
    const installScript = `cat << 'EOSUDO' | sudo -S bash
${credentials.password}
curl -fsSL https://ollama.ai/install.sh | sh
EOSUDO`;
    
    event.sender.send('ollama-install-progress', { 
      status: 'Installing Ollama...',
      progress: 70,
      log: 'Running Ollama installer...'
    });
    
    await executeSSHCommand(ip, installScript, credentials, event);
    
    // Verify installation
    event.sender.send('ollama-install-progress', { 
      status: 'Verifying installation...',
      progress: 80,
      log: 'Verifying Ollama installation...'
    });
    
    const version = await executeSSHCommand(ip, 'ollama --version', credentials, event);
    
    // Pull the llama2 model by default using a single sudo session
    event.sender.send('ollama-install-progress', { 
      status: 'Downloading base model (llama2)...',
      progress: 90,
      log: 'Downloading llama2 model...'
    });
    
    const pullModelScript = `cat << 'EOSUDO' | sudo -S bash
${credentials.password}
ollama pull llama2
EOSUDO`;
    
    await executeSSHCommand(ip, pullModelScript, credentials, event);
    
    debug('Ollama installed successfully:', version);
    event.sender.send('ollama-install-progress', { 
      status: 'Installation complete!',
      progress: 100,
      version,
      log: `Ollama version ${version} installed successfully`
    });
    
    return { success: true, version };
  } catch (error) {
    debug('Failed to install Ollama:', error);
    event.sender.send('ollama-install-progress', { 
      status: 'Installation failed',
      error: error.message,
      log: `Error: ${error.message}`
    });
    throw error;
  }
}

// Function to create a custom model using Ollama
async function createCustomModel(event, data) {
  const { ip, credentials, modelName, baseModel = 'llama3', writingSample, notifyOnComplete, phoneNumber } = data;
  debug('[OLLAMA-MODEL] Creating custom model:', modelName);
  
  try {
    const modelTag = modelName.toLowerCase().replace(/\s+/g, '-');
    
    // Create Modelfile content with writing sample
    const modelfileContent = `
FROM ${baseModel}
SYSTEM You are an assistant trained to write in the user's style. Study the following writing samples to learn the user's style and mimic it in your responses.
TEMPLATE "{{ .System }}\n\nUser: {{ .Prompt }}\n\nAssistant: "

# User writing samples
"""
${writingSample}
"""
`;
    
    // Write modelfile to a temporary location
    const tempModelfilePath = `/tmp/modelfile-${modelTag}`;
    fs.writeFileSync(tempModelfilePath, modelfileContent);
    
    // Use SSH to transfer modelfile and create model
    const sshCmd = `scp ${tempModelfilePath} ${credentials.username}@${ip}:/tmp/modelfile && ssh ${credentials.username}@${ip} "ollama create ${modelTag} -f /tmp/modelfile"`;
    
    const modelProcess = spawn('bash', ['-c', sshCmd]);
    let modelOutput = '';
    
    // Stream output to renderer process
    modelProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      modelOutput += chunk;
      
      // Parse progress if it's there
      const progressMatch = chunk.match(/(\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1], 10);
        mainWindow?.webContents.send('ollama-model-progress', {
          modelName: modelTag,
          progress,
          output: chunk
        });
      } else {
        mainWindow?.webContents.send('ollama-model-progress', {
          modelName: modelTag,
          output: chunk
        });
      }
    });
    
    modelProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      modelOutput += chunk;
      mainWindow?.webContents.send('ollama-model-progress', {
        modelName: modelTag,
        error: chunk
      });
    });
    
    return new Promise((resolve, reject) => {
      modelProcess.on('close', (code) => {
        debug(`[OLLAMA-MODEL] Process exited with code ${code}`);
        if (code === 0) {
          // Remove temporary file
          fs.unlinkSync(tempModelfilePath);
          
          // Signal completion
          mainWindow?.webContents.send('ollama-model-progress', {
            modelName: modelTag,
            status: 'completed',
            output: 'Model creation complete'
          });
          
          // Send SMS notification if requested
          if (notifyOnComplete && phoneNumber) {
            sendSMSNotification(phoneNumber, `Your custom model "${modelName}" is now ready to use! Log in to your GalBox to start using it.`);
          }
          
          // Update user record with phone number if provided
          if (phoneNumber) {
            updateUserPhoneNumber(phoneNumber).catch(err => 
              debug('[OLLAMA-MODEL] Error updating user phone number:', err.message)
            );
          }
          
          resolve({
            success: true,
            modelName: modelTag,
            output: modelOutput
          });
        } else {
          const errorMsg = `Failed to create model: process exited with code ${code}`;
          mainWindow?.webContents.send('ollama-model-progress', {
            modelName: modelTag,
            status: 'error',
            error: errorMsg
          });
          
          // Send failure notification if requested
          if (notifyOnComplete && phoneNumber) {
            sendSMSNotification(phoneNumber, `There was an issue creating your model "${modelName}". Please check your GalBox for details.`);
          }
          
          reject(new Error(errorMsg));
        }
      });
    });
  } catch (error) {
    debug('[OLLAMA-MODEL] Error creating model:', error.message);
    mainWindow?.webContents.send('ollama-model-progress', {
      status: 'error',
      error: error.message
    });
    throw error;
  }
}

// Function to send SMS notification
async function sendSMSNotification(phoneNumber, message) {
  try {
    debug('[SMS] Sending notification to:', phoneNumber);
    
    // This is a placeholder for actual SMS integration
    // You would typically use a service like Twilio, AWS SNS, or similar
    
    // Example implementation with Twilio (commented out)
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);
    
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    */
    
    // For now, just log the message
    debug('[SMS] Would send message:', message);
    debug('[SMS] Notification sent successfully');
    return true;
  } catch (error) {
    debug('[SMS] Error sending notification:', error.message);
    return false;
  }
}

// Function to update user's phone number in the database
async function updateUserPhoneNumber(phoneNumber) {
  try {
    debug('[USER] Updating user phone number:', phoneNumber);
    
    // Get auth token from localStorage via the renderer process
    let authToken = null;
    try {
      // We need to ask the renderer for the auth token
      if (mainWindow) {
        debug('[USER] Requesting auth token from renderer');
        authToken = await mainWindow.webContents.executeJavaScript(
          `localStorage.getItem('authToken')`
        );
      }
    } catch (err) {
      debug('[USER] Failed to get auth token from renderer:', err.message);
    }
    
    if (!authToken) {
      debug('[USER] No auth token available, skipping API call');
      return { success: false, message: 'No auth token available' };
    }
    
    // Make the API call to update phone number
    debug('[USER] Making API call to update phone number');
    const API_BASE_URL = 'http://localhost:5001';
    
    const response = await fetch(`${API_BASE_URL}/api/user/update-phone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ phoneNumber })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update phone number: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    debug('[USER] Phone number updated successfully');
    return result;
  } catch (error) {
    debug('[USER] Error updating phone number:', error.message);
    return { success: false, error: error.message };
  }
}

// Function to list available Ollama models
async function listOllamaModels(event, data) {
  const { ip, credentials } = data;
  debug('[OLLAMA-MODEL] Listing models on:', ip);
  
  try {
    return await executeSSHCommand(ip, credentials, 'ollama list');
  } catch (error) {
    debug('[OLLAMA-MODEL] Error listing models:', error.message);
    throw error;
  }
}

// Function to chat with an Ollama model
async function chatWithOllama(event, data) {
  const { ip, credentials, modelName, prompt } = data;
  debug('[OLLAMA-CHAT] Chatting with model:', modelName);
  
  try {
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    return await executeSSHCommand(ip, credentials, `ollama run ${modelName} "${escapedPrompt}"`);
  } catch (error) {
    debug('[OLLAMA-CHAT] Error chatting with model:', error.message);
    throw error;
  }
}

// Function to check if Ollama is already installed
async function checkOllama(event, { ip, credentials }) {
  try {
    debug('[OLLAMA] Checking if Ollama is installed...');
    const output = await executeSSHCommand(event, 'which ollama && ollama --version', { ip, credentials });
    
    if (output && !output.includes('no ollama')) {
      debug('[OLLAMA] Found installed version:', output);
      return { version: output.trim() };
    } else {
      debug('[OLLAMA] Ollama not found');
      return { error: 'Ollama is not installed' };
    }
  } catch (error) {
    debug('[OLLAMA] Error checking Ollama:', error);
    return { error: error.message };
  }
}

// Function to get Ethernet interface IP
async function getLocalEthernetIP() {
  return new Promise((resolve) => {
    try {
      const networkInterfaces = os.networkInterfaces();
      debug('[NETWORK] Getting Ethernet IP from interfaces:', Object.keys(networkInterfaces));
      
      // Look for Ethernet or en0/en1 interfaces
      const ethernetPatterns = ['Ethernet', 'eth', 'en'];
      
      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        // Check if the interface name includes any Ethernet patterns
        const isEthernet = ethernetPatterns.some(pattern => name.includes(pattern));
        
        if (isEthernet) {
          debug(`[NETWORK] Found potential Ethernet interface: ${name}`);
          
          // Get the IPv4 address
          for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
              debug(`[NETWORK] Using ${name} IPv4 address: ${iface.address}`);
              return resolve(iface.address);
            }
          }
        }
      }
      
      // Fallback: Try to find any external IPv4 address
      for (const interfaces of Object.values(networkInterfaces)) {
        for (const iface of interfaces) {
          if (iface.family === 'IPv4' && !iface.internal) {
            debug(`[NETWORK] Fallback to available external IPv4: ${iface.address}`);
            return resolve(iface.address);
          }
        }
      }
      
      debug('[NETWORK] No suitable network interface found');
      resolve(null);
    } catch (error) {
      debug('[NETWORK] Error getting network interfaces:', error);
      resolve(null);
    }
  });
}

// Function to show GalBox server setup instructions
function showGalBoxServerInstructions() {
  const instructionsWindow = new BrowserWindow({
    width: 800,
    height: 700,
    title: 'GalBox Server Setup Instructions',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  // Create HTML content with setup instructions
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>GalBox Server Setup</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            background-color: #121212;
            color: #f0f0f0;
          }
          pre {
            background-color: #1e1e1e;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
            white-space: pre-wrap;
          }
          h1, h2 {
            color: #4fc3f7;
          }
          .command {
            background-color: #2a2a2a;
            padding: 10px;
            border-radius: 4px;
            border-left: 4px solid #4fc3f7;
            margin: 10px 0;
          }
          .note {
            background-color: #3c3c00;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
          }
          button {
            background-color: #4fc3f7;
            color: black;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            margin-top: 10px;
          }
          button:hover {
            background-color: #3ba8d8;
          }
        </style>
      </head>
      <body>
        <h1>GalBox Server Setup Instructions</h1>
        
        <p>To enable your GalBox to serve AI models, you need to install and run the GalBox server software on your GalBox Linux device.</p>
        
        <div class="note">
          <strong>Note:</strong> These instructions assume you can SSH into your GalBox device. If you can't SSH yet, connect your GalBox with an HDMI monitor and keyboard first.
        </div>
        
        <h2>Option 1: Quick Setup (Recommended)</h2>
        
        <p>SSH into your GalBox and run this simple setup script:</p>
        
        <pre class="command">ssh username@your-galbox-ip</pre>
        
        <p>Then run:</p>
        
        <pre class="command">sudo bash -c "curl -fsSL https://raw.githubusercontent.com/yourusername/galOS/main/galbox-server/EASY_SETUP.sh | bash"</pre>
        
        <p>That's it! The script will:</p>
        <ul>
          <li>Install Ollama and Node.js</li>
          <li>Set up the GalBox API server</li>
          <li>Configure everything to start automatically</li>
          <li>Open the necessary firewall ports</li>
          <li>Download the llama2 model</li>
        </ul>
        
        <h2>Option 2: Manual Setup</h2>
        
        <p>If you prefer to set things up manually:</p>
        
        <h3>1. Install Ollama</h3>
        <pre class="command">curl -fsSL https://ollama.ai/install.sh | sudo sh</pre>
        
        <h3>2. Configure Ollama to listen on all interfaces</h3>
        <pre class="command">sudo systemctl stop ollama
echo 'OLLAMA_HOST=0.0.0.0:11434' | sudo tee -a /etc/environment
sudo systemctl start ollama</pre>
        
        <h3>3. Open firewall ports</h3>
        <pre class="command">sudo ufw allow 11434/tcp</pre>
        
        <h3>4. Download a model</h3>
        <pre class="command">ollama pull llama2</pre>
        
        <h2>Verifying Installation</h2>
        
        <p>Once the server is running, you can check it by:</p>
        
        <pre class="command">curl http://localhost:11434/api/version</pre>
        
        <p>You should see a JSON response with version information.</p>
        
        <h2>Troubleshooting</h2>
        
        <p>If you can't connect to the GalBox server:</p>
        <ul>
          <li>Make sure Ollama is running: <code>sudo systemctl status ollama</code></li>
          <li>Check the firewall: <code>sudo ufw status</code></li>
          <li>Verify the IP address: <code>ip addr</code></li>
        </ul>
        
        <button onclick="window.close()">Close this window</button>
      </body>
    </html>
  `;
  
  // Load the HTML content
  instructionsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
}

async function createWindow() {
  debug('Creating main window...');
  
  // Set up CSP
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    debug('Setting CSP headers for:', details.url);
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: http://localhost:* ws://localhost:*;" +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" +
          "font-src 'self' https://fonts.gstatic.com;" +
          "img-src 'self' data: https: http:;" +
          "connect-src 'self' ws: wss: http: https:;" +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://js.stripe.com https://*.stripe.com;" +
          "frame-src 'self' https://js.stripe.com https://*.stripe.com https://m.stripe.network;"
        ]
      }
    });
  });

  const preloadPath = path.join(__dirname, '../preload/preload.mjs');
  debug('Loading preload script from:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: preloadPath
    }
  });

  // Enable remote before loading URL
  remoteMain.enable(mainWindow.webContents);
  debug('Remote enabled for window');

  // Always open dev tools for now
  mainWindow.webContents.openDevTools();

  // Set up error handling
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    debug('Load failed:', { errorCode, errorDescription });
  });

  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('Preload script error:', error);
    debug('Preload error:', { preloadPath, error });
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
    debug('Renderer crashed');
  });

  mainWindow.on('unresponsive', () => {
    console.error('Window became unresponsive');
    debug('Window unresponsive');
  });

  // Enhanced renderer console logging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['debug', 'info', 'warning', 'error'];
    debug(`[Renderer ${levels[level] || level}] ${message}`);
    if (sourceId) {
      debug(`Source: ${sourceId}:${line}`);
    }
  });

  // Set up correct paths for production build
  if (!isDev) {
    const basePath = path.resolve(__dirname, '../../');
    debug('Base path for protocol:', basePath);
    protocol.registerFileProtocol('app', (request, callback) => {
      const filePath = path.join(basePath, request.url.slice('app://'.length));
      debug('Protocol request:', request.url, '-> File:', filePath);
      callback(filePath);
    });
  }

  // Resolve the correct path to index.html
  const buildPath = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.resolve(__dirname, '../../build/index.html')}`;

  debug('Loading URL:', buildPath);
  
  try {
    debug('Attempting to load URL:', buildPath);
    await mainWindow.loadURL(buildPath);
    debug('URL loaded successfully');
  } catch (error) {
    console.error('Failed to load URL:', error);
    debug('Load URL failed:', error);
    app.quit();
  }

  // Set up USB detection after window is created
  setupUSBDetection(mainWindow);
  debug('USB detection initialized');

  // Set up IPC handlers for USB events
  setupUSBHandlers(mainWindow);
  debug('USB handlers set up');

  // Set up IPC handlers for AI chat
  setupAIChatHandlers(mainWindow);
  debug('AI chat handlers set up');

  // Set up IPC handlers for Ollama
  ipcMain.handle('install-ollama', installOllama);
  ipcMain.handle('check-ollama', checkOllama);
  ipcMain.handle('create-ollama-model', createCustomModel);
  ipcMain.handle('list-ollama-models', listOllamaModels);
  ipcMain.handle('chat-with-ollama', chatWithOllama);

  // Listen for renderer ready event
  ipcMain.on('renderer-ready', () => {
    debug('Renderer process reported ready');
  });

  // Listen for renderer errors
  ipcMain.on('error-occurred', (event, details) => {
    debug('Renderer error:', details);
  });

  // Set up device detection
  checkSystemDevices(mainWindow);
  
  // Set up periodic system device checks with longer interval
  setInterval(() => checkSystemDevices(mainWindow), 10000); // Increased from 5s to 10s

  // Set up network detection
  setupNetworkDetection(mainWindow);

  // Handle Linux setup completion
  ipcMain.on('linux-setup-complete', handleLinuxSetup);

  // Add this near other IPC handlers
  ipcMain.on('test-linux-connection', () => {
    simulateLinuxBoxConnection(mainWindow);
  });

  // Add to IPC handlers
  ipcMain.handle('find-gal-box-ip', async () => {
    try {
      const ip = await findGalBoxIP();
      return { success: true, ip };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Add this to the createWindow function before returning
  ipcMain.handle('get-local-ethernet-ip', async () => {
    try {
      const ip = await getLocalEthernetIP();
      debug('[IPC] Returning local Ethernet IP:', ip);
      return ip;
    } catch (error) {
      debug('[IPC] Error getting local Ethernet IP:', error);
      return null;
    }
  });

  // Handle showing server setup instructions
  ipcMain.on('show-galbox-server-instructions', (event) => {
    debug('[IPC] Showing GalBox server setup instructions');
    showGalBoxServerInstructions();
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