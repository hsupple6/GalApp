import { contextBridge, ipcRenderer } from 'electron';
import remote from '@electron/remote';
const { BrowserView, getCurrentWindow } = remote;

// Debug logging helper
function debug(...args) {
  console.log('[Preload]', ...args);
  // Also send to main process
  try {
    ipcRenderer.send('log-message', args.join(' '));
  } catch (e) {
    console.error('[Preload] Failed to send log:', e);
  }
}

debug('Preload script starting...');

// Verify electron modules are available
debug('Checking electron modules:', {
  contextBridge: !!contextBridge,
  ipcRenderer: !!ipcRenderer,
  BrowserView: !!BrowserView,
  getCurrentWindow: !!getCurrentWindow
});

// Channels we allow the renderer process to send messages through
const validSendChannels = [
  'gal-device-connected',
  'gal-device-disconnected',
  'gal-setup-complete',
  'linux-setup-complete',
  'app-ready',
  'log-message',
  'renderer-ready',
  'error-occurred',
  'ai-chat-send-message',
  'ai-chat-send-message-history',
  'ai-chat-tool-output',
  'ai-chat-clear-messages',
  'ai-chat-create-thread',
  'ai-chat-switch-thread',
  'ai-chat-add-message',
  'ai-chat-get-thread',
  'ai-chat-get-history',
  'test-linux-connection',
  'install-ollama'
];

// Channels we allow the renderer process to listen to
const validReceiveChannels = [
  'show-gal-setup-modal',
  'gal-device-connected',
  'gal-device-removed',
  'gal-device-ready',
  'linux-box-connected',
  'linux-box-disconnected',
  'usb-device-attached',
  'usb-device-detached',
  'usb-devices-system',
  'thunderbolt-devices',
  'mounted-volumes',
  'app-error',
  'main-process-message',
  'ai-chat-message',
  'ai-chat-error',
  'ai-chat-processing',
  'ai-chat-stream',
  'ai-chat-thread-created',
  'ai-chat-thread-switched',
  'ai-chat-history-updated',
  'ollama-install-progress',
  'ollama-model-progress'
];

debug('Valid channels configured:', { send: validSendChannels, receive: validReceiveChannels });

try {
  const windowRegistry = new Map();
  const currentWindow = getCurrentWindow();
  debug('Current window obtained');

  // Expose protected APIs to renderer
  debug('Exposing APIs to renderer...');
  
  // Create the API object
  const api = {
    // Process information
    process: {
      platform: process.platform,
      env: {
        NODE_ENV: process.env.NODE_ENV
      }
    },

    // Window operations
    window: {
      minimize: () => {
        debug('Window minimize requested');
        currentWindow.minimize();
      },
      maximize: () => {
        debug('Window maximize requested');
        currentWindow.maximize();
      },
      restore: () => {
        debug('Window restore requested');
        currentWindow.restore();
      },
      close: () => {
        debug('Window close requested');
        currentWindow.close();
      }
    },

    // IPC communication
    ipcRenderer: {
      send: (channel, data) => {
        if (validSendChannels.includes(channel)) {
          debug(`IPC Send - Channel: ${channel}`, data);
          ipcRenderer.send(channel, data);
        } else {
          console.warn(`Invalid send channel requested: ${channel}`);
          debug(`Invalid send channel requested: ${channel}`);
        }
      },
      on: (channel, func) => {
        if (validReceiveChannels.includes(channel)) {
          debug(`IPC Listener registered for channel: ${channel}`);
          const subscription = (event, ...args) => {
            debug(`IPC Received - Channel: ${channel}`, ...args);
            func(...args);
          };
          ipcRenderer.on(channel, subscription);
          return () => {
            debug(`IPC Listener removed for channel: ${channel}`);
            ipcRenderer.removeListener(channel, subscription);
          };
        } else {
          console.warn(`Invalid receive channel requested: ${channel}`);
          debug(`Invalid receive channel requested: ${channel}`);
        }
      },
      once: (channel, func) => {
        if (validReceiveChannels.includes(channel)) {
          debug(`IPC One-time listener registered for channel: ${channel}`);
          ipcRenderer.once(channel, (event, ...args) => {
            debug(`IPC Received (once) - Channel: ${channel}`, ...args);
            func(...args);
          });
        }
      },
      removeListener: (channel, func) => {
        if (validReceiveChannels.includes(channel)) {
          debug(`IPC Listener manually removed for channel: ${channel}`);
          ipcRenderer.removeListener(channel, func);
        }
      },
      invoke: (channel, data) => {
        const validInvokeChannels = [
          'install-galos',
          'install-ollama',
          'check-ollama',
          'create-ollama-model',
          'list-ollama-models',
          'chat-with-ollama'
        ];
        if (validInvokeChannels.includes(channel)) {
          debug(`Invoking channel ${channel}:`, data);
          return ipcRenderer.invoke(channel, data);
        } else {
          debug(`Invalid channel for invoke: ${channel}`);
        }
      }
    },

    // Browser window management
    BrowserView: {
      create: (config) => {
        debug('Creating BrowserView with config:', config);
        try {
          const view = new BrowserView({
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              webSecurity: true
            }
          });
          
          currentWindow.addBrowserView(view);
          view.setBounds(config.bounds);
          debug(`Loading URL in BrowserView: ${config.url}`);
          view.webContents.loadURL(config.url);
          
          windowRegistry.set(config.id, view);
          debug(`BrowserView created successfully with ID: ${config.id}`);
          
          return {
            id: config.id,
            setBounds: (bounds) => {
              debug(`Setting bounds for view ${config.id}:`, bounds);
              view.setBounds(bounds);
            },
            loadURL: (url) => {
              debug(`Loading new URL in view ${config.id}:`, url);
              view.webContents.loadURL(url);
            },
            destroy: () => {
              debug(`Destroying view ${config.id}`);
              currentWindow.removeBrowserView(view);
              windowRegistry.delete(config.id);
            }
          };
        } catch (error) {
          console.error('Error creating BrowserView:', error);
          debug('Error creating BrowserView:', error);
          return null;
        }
      },
      update: (id, updates) => {
        const view = windowRegistry.get(id);
        if (!view) return;
        
        if (updates.bounds) {
          view.setBounds(updates.bounds);
        }
        if (updates.url) {
          view.webContents.loadURL(updates.url);
        }
      },
      reorder: (zIndexes) => {
        try {
          Array.from(windowRegistry.values()).forEach(view => {
            currentWindow.removeBrowserView(view);
          });

          Array.from(windowRegistry.entries())
            .sort(([id1], [id2]) => {
              const z1 = zIndexes[id1] || 0;
              const z2 = zIndexes[id2] || 0;
              return z1 - z2;
            })
            .forEach(([, view]) => {
              currentWindow.addBrowserView(view);
            });
        } catch (error) {
          console.error('Error reordering views:', error);
        }
      }
    }
  };

  debug('API object created:', api);

  // Expose the API
  contextBridge.exposeInMainWorld('electron', api);
  debug('API exposed to renderer');

  // Verify the API was exposed and wait for it to be available
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 100;
  let retryCount = 0;

  const verifyAndSignalReady = () => {
    if (window.electron) {
      debug('API successfully exposed to window.electron');
      // Signal that preload script is ready
      debug('Sending renderer-ready signal');
      ipcRenderer.send('renderer-ready', true);
      return;
    }

    retryCount++;
    if (retryCount >= MAX_RETRIES) {
      debug('Failed to verify API exposure after', MAX_RETRIES, 'attempts');
      ipcRenderer.send('error-occurred', {
        location: 'preload',
        error: 'Failed to verify API exposure',
        details: { retries: retryCount }
      });
      return;
    }

    debug(`API not yet available, retry ${retryCount}/${MAX_RETRIES}...`);
    setTimeout(verifyAndSignalReady, RETRY_DELAY);
  };

  // Start verification process after a short delay to allow for initialization
  setTimeout(verifyAndSignalReady, 50);
  
  // Add window load event listener
  window.addEventListener('DOMContentLoaded', () => {
    debug('DOMContentLoaded event fired');
    debug('Document readyState:', document.readyState);
    debug('window.electron available:', !!window.electron);
    
    // If API is still not available after DOMContentLoaded, try one last time
    if (!window.electron) {
      debug('API not available after DOMContentLoaded, attempting final exposure');
      contextBridge.exposeInMainWorld('electron', api);
      verifyAndSignalReady();
    }
  });
  
} catch (error) {
  console.error('Error in preload script:', error);
  debug('Critical error in preload script:', error);
  ipcRenderer.send('error-occurred', {
    location: 'preload',
    error: error.message,
    stack: error.stack
  });
} 