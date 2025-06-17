import { useState, useEffect } from 'react';
import useGalBoxStore from '../components/GalSetupModal/store/galboxStore';

// FEATURE FLAG: Set to false to disable all GalBox connection attempts
const GALBOX_FEATURES_ENABLED = false;

// Control logging verbosity with this constant
const DEBUG = process.env.NODE_ENV === 'development';

// Add a connection pool manager to manage connection resources
// This is a global singleton to enforce limits across all component instances
const ConnectionPoolManager = {
  maxConcurrentConnections: 4, // Strict limit on connections
  activeConnections: 0,
  pendingQueue: [] as (() => void)[],
  
  // Request a connection slot
  acquireConnection(): Promise<() => void> {
    return new Promise((resolve) => {
      // If we have capacity, grant immediately
      if (this.activeConnections < this.maxConcurrentConnections) {
        this.activeConnections++;
        // Return a release function
        resolve(() => {
          this.activeConnections--;
          this.processQueue();
        });
      } else {
        // Otherwise queue the request
        this.pendingQueue.push(() => {
          this.activeConnections++;
          // Return a release function
          resolve(() => {
            this.activeConnections--;
            this.processQueue();
          });
        });
      }
    });
  },
  
  // Process the pending queue when connections are released
  processQueue() {
    if (this.pendingQueue.length > 0 && this.activeConnections < this.maxConcurrentConnections) {
      const next = this.pendingQueue.shift();
      if (next) next();
    }
  }
};

interface GalBoxServerStatus {
  online: boolean;
  address: string;
  port: number;
  connectionType: 'direct' | 'network' | 'unknown';
  ollamaVersion?: string;
  lastChecked: Date;
  networks?: Record<string, Array<{
    address: string;
    family: string;
    netmask: string;
    mac: string;
    type: string;
  }>>;
}

// Utility function to check if a string is a valid URL
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * A hook to manage connections to GalBox servers
 * This will attempt to detect and connect to a GalBox server on various network interfaces
 * It also supports remote access via Ngrok URL configured in localStorage
 */
export function useGalBoxServer() {
  const [serverStatus, setServerStatus] = useState<GalBoxServerStatus>({
    online: false,
    address: '',
    port: 3001,
    connectionType: 'unknown',
    lastChecked: new Date()
  });
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pauseConnection, setPauseConnection] = useState(!GALBOX_FEATURES_ENABLED); // Start with connection paused if features disabled
  
  // Get GalBox information from the store
  const { activeGalBox, checkGalBoxServer } = useGalBoxStore();
  
  // Common IP patterns for GalBox devices
  const possibleIpPatterns = [
    '169.254.',     // Direct Ethernet connection
    '192.168.2.',   // Common GalBox network
    '10.0.0.',      // Another common local network
    '172.16.'       // Another common local network
  ];
  
  // Potential server ports
  const portsToBeTried = [3001, 11434];
  
  // Check if a server is online at the given address and port
  const pingServer = async (address: string, port: number): Promise<boolean> => {
    // If features are disabled, immediately return false
    if (!GALBOX_FEATURES_ENABLED) {
      return false;
    }
    
    // Acquire a connection resource from the pool
    let releaseConnection: (() => void) | null = null;
    
    try {
      // Wait for an available connection slot
      releaseConnection = await ConnectionPoolManager.acquireConnection();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      
      const url = `http://${address}:${port}${port === 3001 ? '/health' : '/api/version'}`;
      // Only log attempts in development mode
      if (DEBUG) {
        // Reduce verbosity by only logging once per batch of checks
        const loggingProbability = 0.01; // Only log 1% of attempts to reduce noise
        if (Math.random() < loggingProbability) {
          console.debug(`[GalBoxServer] Trying ${url}`);
        }
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        // Add cache control to prevent browser from caching failed requests
        cache: 'no-store',
        // Explicitly tell browser not to keep connection alive
        keepalive: false
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return false;
      }
      
      // Handle potential JSON parsing errors
      let data;
      try {
        data = await response.json();
      } catch (e: unknown) {
        console.debug(`[GalBoxServer] Error parsing JSON from ${url}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        return false;
      }
      
      // Only log when server status changes from offline to online
      if (!serverStatus.online) {
        console.log(`[GalBoxServer] Server found at ${url}`);
      }
      
      // Only update server status if it has changed
      const statusHasChanged = 
        !serverStatus.online || 
        serverStatus.address !== address || 
        serverStatus.port !== port;
      
      if (statusHasChanged) {
        setServerStatus({
          online: true,
          address: address,
          port: port,
          connectionType: address.startsWith('169.254') ? 'direct' : 'network',
          ollamaVersion: port === 3001 ? data?.ollama?.version : data?.version,
          lastChecked: new Date()
        });
      } else {
        // Just update the timestamp for the last check
        setServerStatus(prev => ({
          ...prev,
          lastChecked: new Date()
        }));
      }
      
      return true;
    } catch (error) {
      // Only log failures in debug mode
      if (DEBUG && 
          (error instanceof Error && !error.message.includes('aborted'))) {
        // Reduce verbosity by only logging explicit errors, not timeouts
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          // Further reduce error logging by only showing 1% of errors
          if (Math.random() < 0.01) {
            console.debug(`[GalBoxServer] Connection error at ${address}:${port}: ${error.message}`);
          }
        }
      }
      return false;
    } finally {
      // Always release the connection back to the pool
      if (releaseConnection) {
        releaseConnection();
      }
    }
  };
  
  // Try to detect a GalBox server on the network
  const detectServer = async (): Promise<boolean> => {
    // If features are disabled or already checking or connection is paused, don't start another check
    if (!GALBOX_FEATURES_ENABLED || isChecking || pauseConnection) {
      return false;
    }
    
    setIsChecking(true);
    setError(null);
    
    try {
      // Use a more aggressive throttling approach - quit early if we're offline and have tried recently
      const now = Date.now();
      const timeSinceLastCheck = now - serverStatus.lastChecked.getTime();
      
      // If we checked within the last 10 seconds and are still offline, skip this check
      if (!serverStatus.online && timeSinceLastCheck < 10000) {
        console.debug(`[GalBoxServer] Skipping rapid rechecks (last check: ${Math.round(timeSinceLastCheck/1000)}s ago)`);
        setIsChecking(false);
        return false;
      }
      
      // Check for Ngrok URL in localStorage first
      const ngrokUrl = localStorage.getItem('galBoxNgrokUrl');
      if (ngrokUrl && isValidUrl(ngrokUrl)) {
        try {
          if (DEBUG) {
            console.debug(`[GalBoxServer] Checking Ngrok URL: ${ngrokUrl}`);
          }
          
          // Extract hostname and port from URL
          const url = new URL(ngrokUrl);
          const protocol = url.protocol.includes('https') ? 'https:' : 'http:';
          const hostname = url.hostname;
          const port = url.port ? parseInt(url.port, 10) : (protocol === 'https:' ? 443 : 80);
          
          // Try the health endpoint first
          const healthUrl = `${protocol}//${hostname}${port !== 80 && port !== 443 ? `:${port}` : ''}/health`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500); // Longer timeout for remote connections
          
          const response = await fetch(healthUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            cache: 'no-store'
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            // Process the response
            const data = await response.json();
            
            setServerStatus({
              online: true,
              address: hostname,
              port: port,
              connectionType: 'network', // Mark as network connection
              ollamaVersion: data?.ollama?.version,
              lastChecked: new Date()
            });
            
            console.log(`[GalBoxServer] Successfully connected via Ngrok: ${ngrokUrl}`);
            setIsChecking(false);
            return true;
          }
        } catch (error) {
          if (DEBUG) {
            console.debug(`[GalBoxServer] Failed to connect to Ngrok URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          // Continue to try other connection methods
        }
      }
      
      // Known GalBox IPs - prioritize these to reduce unnecessary checks
      const knownGalBoxIPs = [
        "192.168.2.2",   // Ethernet
        "192.168.1.14",  // WiFi
      ];

      // Only log once per detection attempt
      const initialMessage = serverStatus.online 
        ? "Checking GalBox server connection..." 
        : "Looking for GalBox server...";
      
      if (DEBUG) {
        console.debug(`[GalBoxServer] ${initialMessage}`);
      }
      
      // Function to add delay between connection attempts
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      // Try the known IPs first
      for (const ip of knownGalBoxIPs) {
        // Try both the API server and the Ollama ports
        for (const port of portsToBeTried) {
          if (await pingServer(ip, port)) {
            setIsChecking(false);
            return true;
          }
          // Add a small delay between connection attempts
          await delay(250); // Increase delay to 250ms
        }
      }
      
      // First, check the active GalBox from the store
      if (activeGalBox?.ipAddress && !knownGalBoxIPs.includes(activeGalBox.ipAddress)) {
        // Try both the API server and the Ollama ports
        for (const port of portsToBeTried) {
          if (await pingServer(activeGalBox.ipAddress, port)) {
            setIsChecking(false);
            return true;
          }
          // Add a small delay between connection attempts
          await delay(250); // Increase delay to 250ms
        }
      }
      
      // If that fails, try common local IPs - but only if we're not already connected
      // And only try this every few checks to reduce network load
      const shouldDoFullScan = !serverStatus.online && Math.random() < 0.1; // Only do a full scan 10% of the time
      
      if (shouldDoFullScan) {
        const discoveryMessage = "Known IPs unavailable, scanning network...";
        if (DEBUG) {
          console.debug(`[GalBoxServer] ${discoveryMessage}`);
        }
        
        // Try a smaller number of common IPs to reduce network traffic
        const priorityPatterns = possibleIpPatterns.slice(0, 1); // Just try the first pattern
        
        // Limit to just 1 IP per pattern to reduce connection load
        for (const pattern of priorityPatterns) {
          // Try fewer IPs in each range - only 1
          for (let i = 1; i <= 1; i++) {
            const ip = `${pattern}${i}`;
            
            // Skip IPs we've already tried
            if (knownGalBoxIPs.includes(ip) || ip === activeGalBox?.ipAddress) {
              continue;
            }
            
            // Try both ports for each IP
            for (const port of portsToBeTried) {
              if (await pingServer(ip, port)) {
                setIsChecking(false);
                return true;
              }
              // Add a larger delay between connection attempts during network scan
              await delay(500); // Increase delay to 500ms
            }
          }
        }
      }
      
      // If we reach here, no server was found
      setServerStatus({
        ...serverStatus,
        online: false,
        lastChecked: new Date()
      });
      
      setIsChecking(false);
      return false;
    } catch (error) {
      console.error('[GalBoxServer] Error detecting server:', error);
      setError(error instanceof Error ? error.message : 'Unknown error detecting server');
      setIsChecking(false);
      return false;
    }
  };
  
  // Modified runModel function to use Ngrok URL if available
  const runModel = async (model: string, prompt: string, options?: any): Promise<any> => {
    // If features are disabled, throw an informative error
    if (!GALBOX_FEATURES_ENABLED) {
      throw new Error('GalBox features are currently disabled');
    }
    
    // Try Ngrok URL first if available
    const ngrokUrl = localStorage.getItem('galBoxNgrokUrl');
    
    if (ngrokUrl && isValidUrl(ngrokUrl)) {
      try {
        const response = await fetch(`${ngrokUrl}/run-model`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            ...options
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[GalBoxServer] Error running model via Ngrok:', errorText);
          throw new Error(`Failed to run model: ${errorText || response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('[GalBoxServer] Error with Ngrok connection:', error);
        // Fall through to try direct connection
      }
    }
    
    // If Ngrok fails or isn't configured, try direct connection
    if (serverStatus.online) {
      try {
        const response = await fetch(`http://${serverStatus.address}:${serverStatus.port}/run-model`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            ...options
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to run model: ${errorText || response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('[GalBoxServer] Error running model:', error);
        throw error;
      }
    } else {
      // If not connected, try to detect server first
      const connected = await detectServer();
      if (connected) {
        // Try again now that we're connected
        return runModel(model, prompt, options);
      } else {
        throw new Error('No connection to GalBox server');
      }
    }
  };
  
  // Auto-detect on mount and set up polling
  useEffect(() => {
    // Skip all connection attempts if features are disabled
    if (!GALBOX_FEATURES_ENABLED) {
      if (DEBUG) {
        console.debug('[GalBoxServer] GalBox features are disabled');
      }
      return;
    }
    
    // Detect server on mount
    detectServer();
    
    // Set up polling with dynamic interval
    const pollInterval = setInterval(() => {
      detectServer();
    }, serverStatus.online ? 60000 : 30000); // Poll less frequently when online
    
    return () => clearInterval(pollInterval);
  }, [serverStatus.online, pauseConnection]);
  
  return {
    serverStatus,
    isChecking,
    error,
    detectServer,
    runModel,
    pauseConnection,
    setPauseConnection
  };
} 