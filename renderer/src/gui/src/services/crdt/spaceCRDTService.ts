import useSpaceStore from '../../stores/spaceStore';
import { SpaceSettings, UISpace } from '../../types/spaces';
import { AnyWindowEntity, WindowEntity } from '../../types/windows';
import { CRDTServiceWS, getCRDTServiceInstance } from './crdtServiceWS';
import { debounce } from 'lodash';
import { spaceService } from '../spaceService';
import { logger } from '../../utils/logger';

// Create a single CRDT service instance
const crdtServiceWS = getCRDTServiceInstance();

// Add a high-performance local event bus for window position updates
// This avoids the CRDT overhead during dragging while maintaining local responsiveness
const windowPositionEventBus = {
  // Track last updates to prevent duplicates within short time spans
  lastUpdates: new Map<string, {position: {x: number, y: number}, timestamp: number}>(),
  
  // Use a debounce time in ms to prevent too frequent updates
  updateDebounceTime: 16,
  
  publish: (spaceId: string, windowId: string, position: { x: number; y: number }) => {
    const now = performance.now();
    const updateKey = `${windowId}`;
    const lastUpdate = windowPositionEventBus.lastUpdates.get(updateKey);
    
    // Skip if too similar to last update within debounce time
    if (lastUpdate && 
        now - lastUpdate.timestamp < windowPositionEventBus.updateDebounceTime &&
        Math.abs(lastUpdate.position.x - position.x) < 1 &&
        Math.abs(lastUpdate.position.y - position.y) < 1) {
      return;
    }
    
    // Update the last position
    windowPositionEventBus.lastUpdates.set(updateKey, {
      position,
      timestamp: now
    });
    
    // Dispatch a custom event for immediate local UI updates
    window.dispatchEvent(new CustomEvent('windowPositionUpdate', {
      detail: { spaceId, windowId, position }
    }));
  },
  
  subscribe: (callback: (detail: { spaceId: string, windowId: string, position: { x: number, y: number } }) => void) => {
    const handler = (e: any) => callback(e.detail);
    window.addEventListener('windowPositionUpdate', handler);
    return () => window.removeEventListener('windowPositionUpdate', handler);
  }
};

// Create debounced save function for persisting space data to backend
const debouncedSaveSpaceToBackend = debounce(async (spaceId: string) => {
  try {
    const store = useSpaceStore.getState();
    const windows = store.windows;
    const settings = store.activeSpace?.settings;
    
    logger.log(`[SpaceCRDT] Persisting space ${spaceId} to backend with ${Object.keys(windows).length} windows`);
    await spaceService.updateSpace(spaceId, windows, settings || {});
  } catch (error) {
    logger.error('[SpaceCRDT] Error persisting space to backend:', error);
  }
}, 1000); // Debounce to reduce database load

// Add debounced save for changes to main space data, used for all window updates
const debouncedSaveWindowToSpace = debounce((spaceId: string, windowId: string, updates: Partial<AnyWindowEntity>) => {
  try {
    logger.log('[SpaceCRDT] Saving window to space');
    const store = useSpaceStore.getState();
    // Update the main space with the window changes
    // This ensures that the next time we save to backend, we have all changes
    store.updateWindow(windowId, updates);
    
    // Also trigger a database save
    debouncedSaveSpaceToBackend(spaceId);
  } catch (error) {
    logger.error('[SpaceCRDT] Error updating window in space:', error);
  }
}, 300); // Shorter debounce for window updates

export interface SpaceUpdate {
  windows?: AnyWindowEntity[];
  activeWindowId?: string;
  layout?: any;
  settings?: {
    isContentsVisible?: boolean;
    isChatVisible?: boolean;
    bgColor?: string;
    viewMode?: 'spatial' | 'focused';
  };
}

interface SpaceCRDTData {
  windows: AnyWindowEntity[];
  timestamp: number;
}

export class SpaceCRDTService {
  private settingsListeners: Map<string, ((settings: Partial<SpaceSettings>) => void)[]> = new Map();
  private spaceUpdateListeners: Map<string, ((update: SpaceUpdate) => void)[]> = new Map();
  private initializedSpaces = new Set<string>();

  constructor(private crdt: CRDTServiceWS) {
    // Set up window position update listener for immediate local UI updates
    this.setupWindowPositionListener();
    
    // Add a global test function for debugging
    (window as any).crdt = {
      testWindowPosition: (windowId: string, x: number, y: number) => {
        const spaceId = useSpaceStore.getState().activeSpace?.id;
        if (!spaceId) {
          logger.error("[Test] No active space");
          return;
        }
        
        logger.log(`[Test] Updating window ${windowId} position to (${x}, ${y})`);
        
        // Update the window position
        this.updateWindow(spaceId, windowId, { position: { x, y } });
      },
      
      dumpWindowPositions: () => {
        const windows = useSpaceStore.getState().windows;
        const positions: Record<string, {x: number, y: number}> = {};
        
        Object.entries(windows).forEach(([id, win]: [string, any]) => {
          if (win.position) {
            positions[id] = win.position;
          }
        });
        
        logger.log("[CRDT Debug] Current window positions:", positions);
        return positions;
      },
      
      verifyPersistence: async () => {
        const spaceId = useSpaceStore.getState().activeSpace?.id;
        if (!spaceId) {
          logger.error("[Test] No active space");
          return;
        }

        try {
          // Force an immediate save to backend
          await debouncedSaveSpaceToBackend.flush();
          logger.log("[Test] Forced immediate save to backend");
          
          // Fetch the space directly from backend
          const backendSpace = await spaceService.getSpace(spaceId);
          
          // Check if we got a valid response
          if (!backendSpace) {
            logger.error("[Test] Failed to fetch space from backend");
            return { error: "Failed to fetch space from backend" };
          }
          
          // Get current window positions from store
          const storeWindows = useSpaceStore.getState().windows;
          
          // Compare
          logger.log("[Test] Backend windows:", backendSpace.windows);
          logger.log("[Test] Store windows:", storeWindows);
          
          // Check for any windows in store but not in backend
          const missingInBackend = Object.keys(storeWindows).filter(id => 
            !backendSpace.windows[id]);
            
          if (missingInBackend.length > 0) {
            logger.error("[Test] Windows in store but missing in backend:", missingInBackend);
          } else {
            logger.log("[Test] All windows in store are persisted in backend");
          }
          
          // Check window positions
          let positionMismatch = false;
          Object.entries(storeWindows).forEach(([id, window]: [string, any]) => {
            const backendWindow = backendSpace.windows[id];
            if (backendWindow) {
              if (window.position && backendWindow.position &&
                  (Math.abs(window.position.x - backendWindow.position.x) > 1 ||
                   Math.abs(window.position.y - backendWindow.position.y) > 1)) {
                logger.error(`[Test] Position mismatch for window ${id}:`, 
                  {store: window.position, backend: backendWindow.position});
                positionMismatch = true;
              }
            }
          });
          
          if (!positionMismatch) {
            logger.log("[Test] All window positions match between store and backend");
          }
          
          return {
            backendSpace,
            storeWindows
          };
        } catch (error) {
          logger.error("[Test] Error verifying persistence:", error);
          throw error;
        }
      }
    };
  }

  private setupWindowPositionListener() {
    windowPositionEventBus.subscribe(({spaceId, windowId, position}) => {
      // IMPORTANT: We need to detect update loops here too
      if ((window as any).__isUpdatingStore) {
        logger.log(`[CRDT] Skipping recursive store update for window ${windowId}`);
        return;
      }

      // Set flag to prevent circular updates
      (window as any).__isUpdatingStore = true;
      
      // Directly update the store without going through CRDT
      try {
        const store = useSpaceStore.getState();
        store.updateWindow(windowId, { position });
      } finally {
        // Always reset the flag
        (window as any).__isUpdatingStore = false;
      }
    });
  }

  // Connect to the window position updates CRDT key to receive live updates from other clients
  setupWindowPositionReceiver(spaceId: string) {
    logger.log(`[SpaceCRDT] Setting up window position receiver for space: ${spaceId}`);
    
    const positionKey = `window-position:${spaceId}`;
    
    // Use the connect method with no debounce to get instant position updates
    return this.crdt.connect(positionKey, (update) => {
      if (!update.data) return;
      
      // Prevent circular updates
      if ((window as any).__isUpdatingStore) return;
      
      // New format directly maps windowIds to position objects
      Object.entries(update.data).forEach(([windowId, position]) => {
        // Skip processing if this is the position we just sent
        if ((window as any).__lastDragWindowId === windowId && 
            (window as any).__lastDragPosition &&
            (window as any).__lastDragPosition.x === (position as any).x &&
            (window as any).__lastDragPosition.y === (position as any).y) {
          return;
        }
        
        logger.log(`[SpaceCRDT] Received position update for window ${windowId}:`, position);
        
        // Set the flag to prevent circular updates
        (window as any).__isUpdatingStore = true;
        
        try {
          // Publish to the event bus first for immediate UI updates
          windowPositionEventBus.publish(spaceId, windowId, position as any);
          
          // Then update the store for persistence
          const store = useSpaceStore.getState();
          store.updateWindow(windowId, { position: position as any });
          
          // Ensure the update also gets persisted to the database
          debouncedSaveWindowToSpace(spaceId, windowId, { position: position as any });
        } finally {
          // Always reset the flag
          (window as any).__isUpdatingStore = false;
        }
      });
    });
  }

  hasListener(spaceId: string): boolean {
    const listeners = this.spaceUpdateListeners.get(spaceId);
    return !!listeners && listeners.length > 0;
  }

  onSpaceUpdate(spaceId: string, callback: (update: SpaceUpdate) => void) {
    logger.log('[SpaceCRDT] Setting up listener for:', spaceId);
    
    return this.crdt.connect(`space:${spaceId}`, (update: any) => {
      // Make sure we're getting and sending the full windows array
      if (update.data?.windows) {
        // logger.log('[SpaceCRDT] Got windows update:', update.data.windows);
        callback({
          ...update.data,
          windows: update.data.windows
        });
      }
    });
  }

  observeSpace(spaceId: string, onUpdate: (update: UISpace) => void) {
    const key = this.getKey(spaceId);
    logger.log('[SpaceCRDT] Observing space:', key);
    
    return this.crdt.connect<UISpace>(key, (update) => {
      logger.log('[SpaceCRDT] Got update:', !!update.data, update);
      if (update.data) {
        onUpdate(update.data);
      }
    });
  }

  removeWindow(spaceId: string, windowId: string) {
    logger.log('[SpaceCRDT][update path] Removing window:', { spaceId, windowId });

    // Use regular space key for removal since it's not frequent
    const key = this.getKey(spaceId);
    
    // Use null explicitly instead of undefined to ensure key deletion in CRDT
    this.crdt.update(key, {
      windows: {
        [windowId]: null
      }
    }, {
      preserveOtherConnections: true,
      preserveNoteConnections: true,
      updateType: 'remove'
    });
    
    // Also ensure window gets removed from backend
    debouncedSaveSpaceToBackend(spaceId);
    
    // Log this removal for debugging
    logger.log(`[SpaceCRDT] Window ${windowId} removed from space ${spaceId}`);
    
    // Since saving to backend is critical, also perform an immediate save
    // after a small delay to ensure CRDT has processed the removal
    setTimeout(() => {
      try {
        const store = useSpaceStore.getState();
        const windows = store.windows;
        const settings = store.activeSpace?.settings;
        
        // Log to confirm window is removed from store
        if (windows[windowId]) {
          logger.warn(`[SpaceCRDT] Window ${windowId} still exists in store after removal!`);
        } else {
          logger.log(`[SpaceCRDT] Confirmed window ${windowId} is removed from store`);
        }
        
        // Save to backend to ensure persistence
        spaceService.updateSpace(spaceId, windows, settings || {})
          .then(() => logger.log(`[SpaceCRDT] Successfully persisted window removal to backend`))
          .catch(err => logger.error(`[SpaceCRDT] Error persisting window removal to backend:`, err));
      } catch (error) {
        logger.error('[SpaceCRDT] Error in delayed backend save after window removal:', error);
      }
    }, 500);
  }

  addWindow(spaceId: string, windowId: string, updates: Partial<AnyWindowEntity>) {
    logger.log('[SpaceCRDT][update path] Adding window:', { spaceId, windowId, updates });
    // Use regular space key for adding a window since it's not frequent
    const key = this.getKey(spaceId);
    this.crdt.update(key, {
      windows: {
        [windowId]: updates
      }
    }, {
      preserveOtherConnections: true,
      preserveNoteConnections: true,
      updateType: 'update'
    });
  }

  updateWindow(spaceId: string, windowId: string, updates: Partial<AnyWindowEntity>) {
    // Check if this is a drag operation to use specialized handling
    const isDragOperation = updates.position && (window as any).__windowDragging;

    // CRITICAL: Detect update loops - but only for non-dragging operations
    // During dragging, we want to send all updates to ensure other clients see the movement
    const lastUpdateKey = `${windowId}:${JSON.stringify(updates.position || {})}`;
    if (!isDragOperation && (window as any).__lastWindowUpdate === lastUpdateKey) {
      logger.log(`[CRDT] Skipping duplicate update for window ${windowId}`);
      return;
    }
    (window as any).__lastWindowUpdate = lastUpdateKey;

    // 1. Update local UI for immediate feedback, but NOT the store yet
    if (updates.position) {
      // Just dispatch UI event but don't update store (to avoid circular updates)
      windowPositionEventBus.publish(spaceId, windowId, updates.position);
    }
    
    // Special handling for drag operations - use a dedicated CRDT key with zero debounce
    if (isDragOperation && updates.position) {
      // Use a special key for window position updates during dragging
      // This will use the zero-debounce setting for window positions
      const positionKey = `window-position:${spaceId}`;
      
      try {
        // Use a specialized format for window position updates for speed
        this.crdt.update(positionKey, {
          [windowId]: updates.position
        }, {
          updateType: 'update',
          preserveOtherConnections: true,
          preserveNoteConnections: true
        });
        
        // Also update the main space data for persistence but with less priority
        this.updateSpaceWithPosition(spaceId, windowId, updates);
        
        // Schedule a debounced save to backend for persistence
        debouncedSaveWindowToSpace(spaceId, windowId, updates);
        
        return; // Skip the regular update path for performance
      } catch (error) {
        logger.error(`[CRDT] Error sending position update for window ${windowId}:`, error);
        // Fall through to regular update path if this fails
      }
    }
    
    // 2. Regular update path - send to main space CRDT
    this.updateSpaceWithPosition(spaceId, windowId, updates);
    
    // 3. Make sure changes are persisted to backend
    debouncedSaveWindowToSpace(spaceId, windowId, updates);
  }
  
  // Helper method to update the main space CRDT with window position/data
  private updateSpaceWithPosition(spaceId: string, windowId: string, updates: Partial<AnyWindowEntity>) {
    // Use the space key to ensure proper storage
    const spaceKey = this.getKey(spaceId);
    
    try {
      // First, check if the window already exists in the current space
      const space = useSpaceStore.getState().activeSpace;
      
      // Output detailed debug info for positions
      if (updates.position) {
        logger.log(`[CRDT] Sending position update to key "${spaceKey}":`, {
          windowId,
          position: updates.position,
          updatePath: `windows.${windowId}.position`
        });
      }
      
      // If no existing window in space, we need to add more than just position
      const existingWindow = space?.windows?.[windowId];
      
      if (!existingWindow && updates.position) {
        // We need to create a more complete window object
        logger.log('[CRDT] Window does not exist yet, creating more complete object');
        
        // Try to get full window from store
        const fullWindow = useSpaceStore.getState().windows[windowId];
        if (fullWindow) {
          // Use the full window data instead of just position
          logger.log('[CRDT] Using full window data for initial sync');
          this.crdt.update(spaceKey, {
            windows: {
              [windowId]: fullWindow
            }
          }, {
            updateType: 'update',
            preserveOtherConnections: true,
            preserveNoteConnections: true,
          });
          return;
        }
      }
      
      // Normal case - just update the properties provided
      this.crdt.update(spaceKey, {
        windows: {
          [windowId]: updates
        }
      }, {
        updateType: 'update',
        preserveOtherConnections: true,
        preserveNoteConnections: true,
      });
    } catch (error) {
      logger.error(`[CRDT] Error updating window ${windowId}:`, error);
    }
  }

  updateSettings(spaceId: string, settings: Partial<SpaceSettings>) {
    const key = this.getKey(spaceId);
    this.crdt.update(key, {
      settings,
    }, {
      updateType: 'update',
      preserveOtherConnections: true,
      preserveNoteConnections: true,
    });
    const listeners = this.settingsListeners.get(spaceId) || [];
    listeners.forEach((listener) => listener(settings));
  }

  // Add new method to update the activeWindowId
  updateActiveWindowId(spaceId: string, activeWindowId: string) {
    logger.log('[SpaceCRDT] Updating activeWindowId:', { spaceId, activeWindowId });
    const key = this.getKey(spaceId);
    this.crdt.update(key, {
      activeWindowId
    }, {
      updateType: 'update',
      preserveOtherConnections: true,
      preserveNoteConnections: true,
    });
  }

  disconnectAll() {
    logger.log('[SpaceCRDT] Disconnecting all');
    this.settingsListeners.clear();
    this.spaceUpdateListeners.clear();
    this.initializedSpaces.clear();
    
    try {
      this.crdt.disconnect('space');
      // Also disconnect window-specific connections
      this.crdt.disconnect('window:space');
    } catch (err) {
      logger.warn('[SpaceCRDT] Error during disconnect:', err);
    }
  }

  /**
   * Disconnects a specific tab's connection to a space.
   * This is safer for multi-tab scenarios than disconnectAll.
   */
  disconnectSpace(spaceId: string, tabId: string) {
    logger.log(`[SpaceCRDT] Disconnecting space ${spaceId} for tab ${tabId}`);
    
    try {
      // Since we're keeping CRDT connections alive for other tabs,
      // we only remove listeners for this specific tab-space instance
      const key = this.getKey(spaceId);
      const windowKey = this.getWindowKey(spaceId);
      
      // Mark this instance as disconnected, but don't affect other tabs
      // We don't actually disconnect the CRDT connection because other tabs might need it
      logger.log(`[SpaceCRDT] Marked ${key} disconnected for tab ${tabId}`);
      
      // If no other tabs are using this space, we can remove it from initialized spaces
      // In a real implementation, you'd track which tabs are using which spaces
      // For now, we'll leave the space initialized to be safe
    } catch (err) {
      logger.warn(`[SpaceCRDT] Error disconnecting space ${spaceId} for tab ${tabId}:`, err);
    }
  }

  groupWindows(spaceId: string, windowIds: string[]) {
    const existingWindows = useSpaceStore.getState().windows;
    const firstWindow = existingWindows[windowIds[0]];
    if (!firstWindow) return;

    // Convert first window to parent window with tabs
    const updatedWindow: WindowEntity = {
      ...firstWindow,
      tabs: windowIds,
      activeTabId: windowIds[0],
      isParentWindow: true
    };

    // Update the windows
    const updatedWindows = Object.values(existingWindows).map(win => 
      win.id === firstWindow.id ? updatedWindow : win
    );
    
    // this.updateWindows(spaceId, updatedWindows);
  }

  ungroupWindows(windowId: string) {
    const spaceId = windowId.split('-')[0];
    const currentWindows = useSpaceStore.getState().windows;
    const window = currentWindows[windowId] as WindowEntity;

    if (!window?.tabs) return;

    // Remove tab properties from window
    const updatedWindow = {
      ...window,
      tabs: undefined,
      activeTabId: undefined,
      isParentWindow: undefined
    };

    const updatedWindows = Object.values(currentWindows).map(win => 
      win.id === windowId ? updatedWindow : win
    );
    
    // this.updateWindows(spaceId, updatedWindows);
  }

  async initializeSpace(spaceId: string, initialState: UISpace) {
    logger.log('[SpaceCRDT] Initialize space:', spaceId, initialState);
    this.initializedSpaces.add(spaceId);
    
    // Set up the window position receiver for real-time position updates
    this.setupWindowPositionReceiver(spaceId);
    
    // Check if we already have data in the CRDT
    let existingData: any = null;
    try {
      existingData = await this.crdt.get(this.getKey(spaceId));
      logger.log('[SpaceCRDT] Existing CRDT data:', existingData);
    } catch (e) {
      logger.log('[SpaceCRDT] No existing data in CRDT, using initial state from backend');
    }
    
    // If we have existing data with windows and application state, ensure we preserve it
    if (existingData && existingData.windows) {
      // Create a deep merged state where CRDT data takes precedence for application state
      const mergedState = {
        ...initialState,
        windows: { ...initialState.windows },
        settings: {
          ...initialState.settings,
          ...(existingData.settings || {})
        }
      };
      
      // Get all window IDs from both sources to ensure we don't miss any
      const allWindowIds = new Set([
        ...Object.keys(existingData.windows || {}),
        ...Object.keys(initialState.windows || {})
      ]);
      
      logger.log(`[SpaceCRDT] Merging windows from backend (${Object.keys(initialState.windows || {}).length}) and CRDT (${Object.keys(existingData.windows || {}).length})`);
      
      // For each window, properly merge with applicationState preservation
      allWindowIds.forEach(windowId => {
        const crdtWindow = existingData.windows[windowId];
        const initialWindow = initialState.windows ? initialState.windows[windowId] : undefined;
        
        if (crdtWindow && initialWindow) {
          // Both sources have the window - merge with CRDT taking precedence
          mergedState.windows[windowId] = {
            ...initialWindow,
            ...crdtWindow,
            applicationState: {
              ...(initialWindow.applicationState || {}),
              ...(crdtWindow.applicationState || {})
            }
          };
          logger.log(`[SpaceCRDT] Merged window ${windowId} from both sources`);
        } else if (crdtWindow) {
          // Only CRDT has the window - keep it
          mergedState.windows[windowId] = { ...crdtWindow };
          logger.log(`[SpaceCRDT] Using window ${windowId} from CRDT only`);
        } else if (initialWindow) {
          // Only initial state has the window - keep it
          mergedState.windows[windowId] = { ...initialWindow };
          logger.log(`[SpaceCRDT] Using window ${windowId} from backend only`);
        }
      });
      
      logger.log('[SpaceCRDT] Using merged state with preserved application state:', mergedState);
      
      // Persist merged state to backend to ensure alignment
      debouncedSaveSpaceToBackend(spaceId);
      
      // Use a transaction to ensure atomic update
      this.crdt.update(this.getKey(spaceId), mergedState, {
        updateType: 'update',
        preserveOtherConnections: true,
        preserveNoteConnections: true,
      });
    } else {
      // No existing state in CRDT, use the initial state from backend
      logger.log('[SpaceCRDT] No windows in CRDT, using windows from initial state:', 
        Object.keys(initialState.windows || {}).length);
      
      this.crdt.update(this.getKey(spaceId), initialState, {
        updateType: 'update',
        preserveOtherConnections: true,
        preserveNoteConnections: true,
      });
    }
  }

  async updateSpaceName(spaceId: string, name: string) {
    logger.log('[SpaceCRDT] Updating name:', { spaceId, name });
    const key = this.getKey(spaceId);
    await this.crdt.update(key, {
      data: {
        name
      }
    }, {
      updateType: 'update',
      preserveOtherConnections: true,
      preserveNoteConnections: true,
    });
  }

  // Add a method to get space data directly from CRDT
  async getSpace(spaceId: string): Promise<UISpace | null> {
    try {
      const key = this.getKey(spaceId);
      const data = await this.crdt.get(key);
      // Need to handle the Doc type correctly
      return data as unknown as UISpace;
    } catch (e) {
      logger.error('[SpaceCRDT] Error getting space:', e);
      return null;
    }
  }

  private getKey(spaceId: string) {
    return `space:${spaceId}`;
  }
  
  private getWindowKey(spaceId: string) {
    // Use a dedicated key for window updates to take advantage of window-specific debounce
    return `window:space:${spaceId}`;
  }
}

// Only export one instance
export const spaceCRDTService = new SpaceCRDTService(crdtServiceWS);
