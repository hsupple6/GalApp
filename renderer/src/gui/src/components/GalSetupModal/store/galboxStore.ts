import { create } from 'zustand';
import { GalBoxError, UIGalBox } from '../../../types/galbox';
import { galboxService } from '../services/galboxService';
import { logger } from '../../../utils/logger';

interface GalBoxState {
  status: 'idle' | 'loading' | 'error';
  error?: GalBoxError;
  activeGalBox: UIGalBox | null;
  isChecking: boolean;
  serverStatus: {
    online: boolean;
    ollamaVersion?: string;
    uptime?: number;
    timestamp?: string;
    networks?: Record<string, Array<{
      address: string;
      family: string;
      netmask: string;
      mac: string;
      type: string;
    }>>;
  };
}

interface GalBoxStore extends GalBoxState {
  fetchGalBox: (serialNumber: string) => Promise<void>;
  createGalBox: (data: {
    serialNumber: string;
    name: string;
    ipAddress: string;
    username: string;
    ollamaVersion?: string;
  }) => Promise<UIGalBox>;
  updateStatus: (status: 'setup' | 'ready' | 'error') => Promise<void>;
  updateOllamaVersion: (version: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
  startPollingGalBox: (serialNumber: string, intervalMs?: number) => void;
  stopPollingGalBox: () => void;
  checkGalBoxServer: (ipAddress: string) => Promise<boolean>;
  runModel: (ipAddress: string, model: string, prompt: string, options?: any) => Promise<any>;
  listModels: (ipAddress: string) => Promise<any>;
}

const useGalBoxStore = create<GalBoxStore>((set, get) => ({
  status: 'idle',
  activeGalBox: null,
  isChecking: false,
  serverStatus: {
    online: false
  },
  
  fetchGalBox: async (serialNumber: string) => {
    set({ status: 'loading' });
    try {
      const galbox = await galboxService.fetchGalBox(serialNumber);
      set({ activeGalBox: galbox, status: 'idle' });
      
      // After fetching, check server status
      if (galbox) {
        const isOnline = await get().checkGalBoxServer(galbox.ipAddress);
        set(state => ({
          serverStatus: {
            ...state.serverStatus,
            online: isOnline
          }
        }));
      }
    } catch (error) {
      logger.error('[GalBoxStore] Error fetching GalBox:', error);
      set({
        status: 'error',
        error: error instanceof GalBoxError ? error : new GalBoxError('Unknown error', 'NETWORK_ERROR'),
      });
    }
  },

  createGalBox: async (data) => {
    set({ status: 'loading' });
    try {
      const galbox = await galboxService.createGalBox(data);
      set({ activeGalBox: galbox, status: 'idle' });
      return galbox;
    } catch (error) {
      logger.error('[GalBoxStore] Error creating GalBox:', error);
      set({
        status: 'error',
        error: error instanceof GalBoxError ? error : new GalBoxError('Unknown error', 'NETWORK_ERROR'),
      });
      throw error;
    }
  },

  updateStatus: async (status) => {
    const { activeGalBox } = get();
    if (!activeGalBox) return;

    try {
      const updated = await galboxService.updateGalBoxStatus(activeGalBox.serialNumber, status);
      set({ activeGalBox: updated });
    } catch (error) {
      logger.error('[GalBoxStore] Error updating GalBox status:', error);
      set({
        status: 'error',
        error: error instanceof GalBoxError ? error : new GalBoxError('Unknown error', 'NETWORK_ERROR'),
      });
    }
  },

  updateOllamaVersion: async (version) => {
    const { activeGalBox } = get();
    if (!activeGalBox) return;

    try {
      const updated = await galboxService.updateOllamaVersion(activeGalBox.serialNumber, version);
      set({ activeGalBox: updated });
    } catch (error) {
      logger.error('[GalBoxStore] Error updating Ollama version:', error);
      set({
        status: 'error',
        error: error instanceof GalBoxError ? error : new GalBoxError('Unknown error', 'NETWORK_ERROR'),
      });
    }
  },
  
  // Check if GalBox server is online using the health endpoint
  checkGalBoxServer: async (ipAddress: string) => {
    try {
      // Log the attempt for debugging
      logger.log(`[GalBoxStore] Checking GalBox server at ${ipAddress}`);
      
      // Try multiple possible IP addresses when connecting via Ethernet
      let possibleIPs = [ipAddress];
      
      // If IP is in 169.254.x.x range (direct USB/Ethernet connection), also try some common local IPs
      if (ipAddress.startsWith('169.254')) {
        logger.log('[GalBoxStore] Detected direct Ethernet connection, trying additional IPs');
        // Add common IP ranges for direct connections
        possibleIPs = [...possibleIPs, '192.168.2.1', '10.0.0.1', '172.16.0.1', 'localhost'];
        
        // Try to find local subnet
        try {
          // Get local IP of the connected Ethernet interface
          if (window.electron?.ipcRenderer) {
            const localIp = await window.electron.ipcRenderer.invoke('get-local-ethernet-ip', {});
            if (localIp) {
              possibleIPs.push(localIp);
            }
          }
        } catch (error) {
          logger.log('[GalBoxStore] Error getting local Ethernet IP:', error);
        }
      }
      
      logger.log('[GalBoxStore] Trying these IPs:', possibleIPs);
      
      // Try each possible IP
      for (const ip of possibleIPs) {
        // Try standard port first (3001)
        let response = await tryFetch(`http://${ip}:3001/health`, 1500); // Reduced timeout for faster fallback
        
        if (response) {
          logger.log(`[GalBoxStore] Successfully connected to GalBox API at ${ip}:3001`);
          
          // Process the standard API response
          set({
            serverStatus: {
              online: response.status === 'online',
              ollamaVersion: response.ollama?.version,
              uptime: response.uptime,
              timestamp: response.timestamp,
              networks: response.networks
            }
          });
          
          // If this isn't the primary IP, log that we're using a different one
          if (ip !== ipAddress) {
            logger.log(`[GalBoxStore] Note: Using ${ip} instead of configured ${ipAddress}`);
          }
          
          return response.status === 'online';
        }
        
        // If that fails, try direct Ollama port (11434)
        response = await tryFetch(`http://${ip}:11434/api/version`, 1500);
        
        if (response) {
          logger.log(`[GalBoxStore] Successfully connected to Ollama API at ${ip}:11434`);
          
          // Format the response to match our standard format
          set({
            serverStatus: {
              online: true,
              ollamaVersion: response.version,
              uptime: 0, // Uptime unknown when directly accessing Ollama
              timestamp: new Date().toISOString(),
              networks: {
                // Add a fallback network entry when using direct Ollama access
                'direct-connection': [{
                  address: ip,
                  family: 'IPv4',
                  netmask: '255.255.255.0',
                  mac: '',
                  type: ip.startsWith('169.254') ? 'USB/Direct' : 'LAN/WiFi'
                }]
              }
            }
          });
          
          // If this isn't the primary IP, log that we're using a different one
          if (ip !== ipAddress) {
            logger.log(`[GalBoxStore] Note: Using ${ip} instead of configured ${ipAddress}`);
          }
          
          return true;
        }
      }
      
      // If all connection attempts failed
      logger.error('[GalBoxStore] All connection attempts to GalBox server failed');
      set(state => ({
        serverStatus: {
          ...state.serverStatus,
          online: false,
          timestamp: new Date().toISOString()
        }
      }));
      return false;
    } catch (error) {
      logger.error('[GalBoxStore] Error checking GalBox server:', error);
      set(state => ({
        serverStatus: {
          ...state.serverStatus,
          online: false,
          timestamp: new Date().toISOString()
        }
      }));
      return false;
    }
  },
  
  // Run model on GalBox server
  runModel: async (ipAddress: string, model: string, prompt: string, options = {}) => {
    try {
      const response = await fetch(`http://${ipAddress}:3001/run-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          options
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to run model: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('[GalBoxStore] Error running model:', error);
      throw error;
    }
  },
  
  // List available models on GalBox server
  listModels: async (ipAddress: string) => {
    try {
      const response = await fetch(`http://${ipAddress}:3001/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('[GalBoxStore] Error listing models:', error);
      throw error;
    }
  },
  
  // Polling timer reference
  pollingInterval: null as NodeJS.Timeout | null,
  
  startPollingGalBox: (serialNumber: string, intervalMs = 30000) => {
    const { pollingInterval, stopPollingGalBox } = get() as any;
    
    // Clear any existing interval
    if (pollingInterval) {
      stopPollingGalBox();
    }
    
    // Function to check GalBox status
    const checkGalBox = async () => {
      const { activeGalBox } = get();
      if (!activeGalBox) {
        try {
          await get().fetchGalBox(serialNumber);
        } catch (error) {
          logger.error('[GalBoxStore] Error fetching GalBox during polling:', error);
        }
        return;
      }
      
      set({ isChecking: true });
      try {
        // Check if the GalBox server is online
        const isOnline = await get().checkGalBoxServer(activeGalBox.ipAddress);
        
        // If previously in error but now online, update status to ready
        if (activeGalBox.status === 'error' && isOnline) {
          await get().updateStatus('ready');
        }
        // If previously ready but now offline, update status to error
        else if (activeGalBox.status === 'ready' && !isOnline) {
          await get().updateStatus('error');
        }
      } catch (error) {
        logger.error('[GalBoxStore] Error checking GalBox status:', error);
      } finally {
        set({ isChecking: false });
      }
    };
    
    // Run immediately
    checkGalBox();
    
    // Set up interval
    const interval = setInterval(checkGalBox, intervalMs);
    (get() as any).pollingInterval = interval;
    
    return () => {
      if (interval) clearInterval(interval);
      (get() as any).pollingInterval = null;
    };
  },
  
  stopPollingGalBox: () => {
    const interval = (get() as any).pollingInterval;
    if (interval) {
      clearInterval(interval);
      (get() as any).pollingInterval = null;
    }
  },

  clearError: () => set({ status: 'idle', error: undefined }),

  reset: () => {
    // Stop polling when resetting
    (get() as any).stopPollingGalBox();
    set({
      status: 'idle',
      activeGalBox: null,
      error: undefined,
      serverStatus: { online: false }
    });
  },
}));

async function tryFetch(url: string, timeoutMs: number = 3000): Promise<any> {
  try {
    // Create an AbortController to timeout the fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    logger.log(`Connection attempt failed for ${url}:`, error);
    return null;
  }
}

export default useGalBoxStore; 