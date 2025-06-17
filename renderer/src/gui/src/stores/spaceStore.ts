import { ObjectId } from 'bson';
import { create } from 'zustand';
import { debounce } from 'lodash';

import { spaceCRDTService } from '../services/crdt/spaceCRDTService';
import { spaceService } from '../services/spaceService';
import { AnyWindowEntity, WindowEntity } from '../types/windows';
import { notesService } from '../services/notesService';
import { logger } from '../utils/logger';
import { registerSpaceCommands } from './spaceCommands';

// Add this type declaration for the global lock
declare global {
  interface Window {
    __SPACE_INITIALIZING__?: boolean;
    __windowDragging?: boolean;
    __lastDragUpdate?: number;
  }
}

// Add a timestamp marker to track code loading
logger.log(`[SpaceStore] Code loaded with direct persistence at ${new Date().toISOString()}`);

// Track drag state for all windows
const windowDragState = {
  isDragging: false,
  pendingSave: false,
  lastDragTime: 0
};

// Create debounced save for drag operations specifically
const debouncedPersistStore = debounce((store: any) => {
  logger.log('[SpaceStore] Saving to backend after drag debounce');
  const state = store.getState();
  const spaceId = state.activeSpace?.id;
  
  if (!spaceId) return;
  
  // Save all windows to the backend
  store.saveToBackend()
    .then(() => {
      logger.log('[SpaceStore] Successfully saved windows to backend');
      windowDragState.pendingSave = false;
    })
    .catch((error: Error) => {
      logger.error('[SpaceStore] Failed to save to backend:', error);
      windowDragState.pendingSave = false;
    });
}, 500); // 500ms debounce for drag operations

export type SpaceStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface SpaceSettings {
  isContentsVisible: boolean;
  isChatVisible: boolean;
  bgColor?: string;
  viewMode?: 'spatial' | 'focused';
  spaceChat?: {
    currentThreadIds: Record<string, string>; // mode -> threadId mapping
    isHistoryOpen: boolean;
    mode: string; // current chat mode
    model: string; // current model
    isContextVisible: boolean;
    widths: {
      focused: number;
      spatial: number;
    };
  };
}

export interface Space {
  id: string;
  name: string;
  windows: Record<string, AnyWindowEntity>;
  settings: SpaceSettings;
  created?: Date;
  updated?: Date;
  acl?: Array<{
    subject: string;
    role: 'owner' | 'editor' | 'viewer' | 'commenter';
    granted_at?: string;
    granted_by?: string;
  }>;
}

export interface WindowState {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface SpaceState {
  status: SpaceStatus;
  error?: Error;
  activeSpace: Space | null;
  windows: Record<string, AnyWindowEntity>;
  selectedIds: string[];
  initialized: boolean;
  activeWindowId: string | null;
  layout?: any;
  cleanupFn: () => void;
  initializing: boolean;
  currentSpaceId?: string;
  initializationStatus: 'idle' | 'initializing' | 'initialized' | 'error';
  windowStates: Record<string, WindowState>;
  windowZIndexes: Record<string, number>;
  isChatVisible: boolean;
  setIsChatVisible: (isChatVisible: boolean) => void;
}

export interface SpaceStore extends SpaceState {
  getSpaceStatus: () => Promise<SpaceStatus>;
  initialize: (spaceId: string) => Promise<void>;
  addWindow: (window: WindowEntity) => void;
  removeWindow: (windowId: string) => void;
  updateWindow: (windowId: string, updates: Partial<AnyWindowEntity>) => void;
  selectWindow: (windowId: string, isMultiSelect: boolean) => void;
  groupSelected: () => void;
  ungroup: (windowId: string) => void;
  setWindows: (windows: AnyWindowEntity[]) => void;
  setStatus: (status: SpaceStatus) => void;
  cleanup: () => void;
  updateSpaceName: (newName: string) => Promise<void>;
  setBackgroundColor: (bgColor: string) => void;
  showDebugger: boolean;
  toggleDebugger: () => void;
  setActiveWindow: (windowId: string | null) => void;
  bringWindowToFront: (windowId: string) => void;
  setWindowState: (windowId: string, state: WindowState) => void;
  updateWindowPosition: (windowId: string, position: { x: number; y: number }) => void;
  updateWindowSize: (windowId: string, size: { width: number; height: number }) => void;
  setViewMode: (mode: 'spatial' | 'focused') => void;
  saveToBackend: () => Promise<void>;
  finalizeWindowDrag: (windowId: string, position: { x: number, y: number }) => void;
  updateSpaceChatSettings: (spaceChatUpdates: Partial<NonNullable<SpaceSettings['spaceChat']>>) => Promise<void>;
}

export const useSpaceStore = create<SpaceStore>((set, get) => ({
  status: 'idle',
  activeSpace: null,
  windows: {},
  selectedIds: [],
  initialized: false,
  initializing: false,
  activeWindowId: null,
  layout: undefined,
  cleanupFn: () => {},
  currentSpaceId: undefined,
  initializationStatus: 'idle',
  showDebugger: false,
  windowStates: {},
  windowZIndexes: {},
  isChatVisible: false,
  setIsChatVisible: (isChatVisible: boolean) => set({ isChatVisible }),

  getSpaceStatus: async () => {
    return get()?.status;
  },

  initialize: async (spaceId: string) => {
    // Register space commands once
    if (!get().initializing) {
      registerSpaceCommands();
    }

    const state = get();
    logger.log('[SpaceStore] Starting initialization:', spaceId);

    // We also maintain this variable separately from state to avoid race conditions
    if (window.__SPACE_INITIALIZING__ === true) {
      logger.log('[SpaceStore] Already initializing (global lock)');
      
      // Return a promise that resolves when the current initialization is done
      return new Promise<void>((resolve) => {
        let attempts = 0;
        const checkDone = () => {
          attempts++;
          if (window.__SPACE_INITIALIZING__ !== true) {
            logger.log('[SpaceStore] Global lock released, continuing');
            resolve();
          } else if (attempts > 50) { // 5 seconds timeout
            logger.log('[SpaceStore] Timeout waiting for lock, forcing release');
            window.__SPACE_INITIALIZING__ = false;
            resolve();
          } else {
            setTimeout(checkDone, 100);
          }
        };
        setTimeout(checkDone, 100);
      });
    }

    if (state.initializationStatus === 'initializing') {
      logger.log('[SpaceStore] Already initializing');
      return;
    }

    if (state.initializationStatus === 'initialized' && state.currentSpaceId === spaceId) {
      logger.log('[SpaceStore] Already initialized for this space');
      return;
    }

    try {
      // Set global initialization lock
      window.__SPACE_INITIALIZING__ = true;
      set({ initializationStatus: 'initializing' });
      
      // First try to get existing space data from CRDT to preserve state
      let existingCRDTSpace = null;
      try {
        existingCRDTSpace = await spaceCRDTService.getSpace(spaceId);
        logger.log('[SpaceStore] Fetched space from CRDT:', existingCRDTSpace);
      } catch (e) {
        logger.log('[SpaceStore] No existing CRDT data');
      }
      
      // Then get the space from the backend
      const existingSpace = await spaceService.getSpace(spaceId);
      if (existingSpace) {
        delete existingSpace.created;
        delete existingSpace.updated;
      }
      logger.log('[SpaceStore] Fetched space from backend:', existingSpace);
      
      // Clean up any ghost windows from the backend space
      if (existingSpace && existingSpace.windows) {
        let windowsNeedCleanup = false;
        const validWindows: Record<string, AnyWindowEntity> = {};
        
        // Check each window to see if it's valid
        Object.entries(existingSpace.windows).forEach(([windowId, window]) => {
          // Valid windows must have id, type, position, and size
          if (window && 
              window.id && 
              window.type === 'window' && 
              window.position && 
              window.size) {
            validWindows[windowId] = window;
          } else {
            // This is a ghost window
            windowsNeedCleanup = true;
            logger.log(`[SpaceStore] Found ghost window during init: ${windowId}`, window);
          }
        });
        
        // If we found ghost windows, replace with cleaned version
        if (windowsNeedCleanup) {
          logger.log(`[SpaceStore] Cleaning up ${Object.keys(existingSpace.windows).length - Object.keys(validWindows).length} ghost windows`);
          existingSpace.windows = validWindows;
          
          // Also persist the cleaned windows to the backend
          try {
            await spaceService.updateSpace(spaceId, validWindows, existingSpace.settings || {});
            logger.log('[SpaceStore] Successfully persisted cleaned windows to backend');
          } catch (error) {
            logger.error('[SpaceStore] Error persisting cleaned windows:', error);
          }
        }
      }
      
      const newSpace = createUISpace(spaceId);
      
      // Choose the source space, prioritizing CRDT data
      const space = existingCRDTSpace || existingSpace || newSpace;
      
      // CRDT service now handles merging of application state directly
      // We just need to pass the most complete space data we have
      logger.log('[SpaceStore] Initializing space with data:', space);
      await spaceCRDTService.initializeSpace(spaceId, space);
      
      // Set up observer after initialization is complete
      const cleanupFn = spaceCRDTService.observeSpace(spaceId, (update) => {
        logger.log('[SpaceStore][update path] Received space update, windows count:', 
          Object.keys(update.windows || {}).length);
        
        // Add retry logic for the space update
        const updateWithRetry = async (retries = 3, delay = 500) => {
          for (let attempt = 0; attempt < retries; attempt++) {
            try {
              await spaceService.updateSpace(spaceId, update.windows || {}, update.settings || {});
              break; // Success, exit the retry loop
            } catch (error) {
              logger.error(`[SpaceStore] Update attempt ${attempt + 1} failed:`, error);
              
              // If this is the last attempt, or it's not a 404 error, don't retry
              if (attempt === retries - 1 || 
                  !(error instanceof Error && error.message.includes('404'))) {
                logger.error('[SpaceStore] Error updating space after max retries:', error);
                break;
              }
              
              // Wait before trying again
              await new Promise(resolve => setTimeout(resolve, delay));
              
              // Increase delay for exponential backoff
              delay *= 2;
            }
          }
        };
        
        // Trigger the update with retry
        updateWithRetry().catch(error => {
          logger.error('[SpaceStore] Failed to persist space update:', error);
          // Continue anyway - local state should still be updated
        });
        
        // Update local state regardless of persistence status
        set((state) => ({
          ...state,
          activeSpace: update,
          windows: update.windows || {}
        }));
      });

      set({ 
        initialized: true,
        activeSpace: space,
        windows: space?.windows || {},
        initializationStatus: 'initialized',
        currentSpaceId: spaceId,
        cleanupFn,
        activeWindowId: space?.activeWindowId || null,
        isChatVisible: space?.settings?.isChatVisible || false
      });
    } catch (err) {
      set({ 
        initializationStatus: 'error',
        initializing: false 
      });
      throw err;
    } finally {
      // Release the global lock
      window.__SPACE_INITIALIZING__ = false;
    }
  },

  addWindow: (window: WindowEntity) => {
    const spaceId = get().activeSpace?.id;
    if (!spaceId) return;
    logger.log('[SpaceStore][update path] Adding window:', window);
    const newWindowsState = {
      ...get().windows,
      [window.id]: {
        ...window,
        type: 'window'
      } as AnyWindowEntity
    }

    logger.log('Adding window to store:', window);

    // Only set as active window if this is not during space initialization
    // and there's no currently active window
    const shouldSetActive = get().initializationStatus === 'initialized' && !get().activeWindowId;

    set((state) => ({
      windows: newWindowsState,
      activeWindowId: shouldSetActive ? window.id : state.activeWindowId
    } as Partial<SpaceStore>));
    
    // Sync full window state to CRDT
    // spaceCRDTService.addWindow(spaceId, (Object.keys(newWindowsState).length - 1).toString(), window);
    spaceCRDTService.addWindow(spaceId, window.id, window);
  },

  removeWindow: (windowId: string) => {
    const spaceId = get().activeSpace?.id;
    if (!spaceId) return;
    logger.log('[SpaceStore][update path] Removing window:', windowId);

    set((state) => {
      const { [windowId]: removed, ...rest } = state.windows;
      return {
        windows: rest,
        selectedIds: state.selectedIds.filter((id) => id !== windowId),
      };
    });

    // Notify CRDT of window removal
    spaceCRDTService.removeWindow(spaceId, windowId);
    
    // Additionally, force save to backend to ensure persistence
    get().saveToBackend()
      .catch(error => logger.error('[SpaceStore] Error saving to backend after window removal:', error));
  },

  updateWindow: (windowId: string, updates: Partial<AnyWindowEntity>) => {
    // Track if this is a position update during dragging
    const isDragOperation = window.__windowDragging && updates.position;
    
    // Reduce logging during window drag operations except for significant position changes
    if (!isDragOperation) {
      logger.log('[SpaceStore] Updating window:', { windowId, updates });
    }
    
    const spaceId = get().activeSpace?.id;
    if (!spaceId) return;

    // Update drag state for persistence tracking
    if (isDragOperation) {
      windowDragState.isDragging = true;
      windowDragState.lastDragTime = Date.now();
      windowDragState.pendingSave = true;
    }

    // Update local state first for immediate UI response
    set((state) => {
      // Handle case where window doesn't exist yet (during initialization)
      if (!state.windows[windowId]) {
        return {
          windows: {
            ...state.windows,
            [windowId]: updates as AnyWindowEntity
          },
          // Don't change activeWindowId during dragging to avoid focus issues
          activeWindowId: isDragOperation ? state.activeWindowId : windowId
        };
      }
      
      // Normal update for existing window
      return {
        windows: {
          ...state.windows,
          [windowId]: {
            ...state.windows[windowId],
            ...updates,
          }
        },
        // Don't change activeWindowId during dragging
        activeWindowId: isDragOperation ? state.activeWindowId : windowId
      };
    });

    // Always send updates to CRDT service for real-time collaboration
    spaceCRDTService.updateWindow(spaceId, windowId, updates);
    
    // Handle persistence for non-drag operations immediately
    // For drag operations, we'll handle at drag end to avoid excessive API calls
    if (!isDragOperation) {
      // For non-position updates or manual position changes, save immediately
      get().saveToBackend()
        .catch(error => logger.error('[SpaceStore] Error saving to backend:', error));
    } else {
      // For drag operations, use debounced save
      debouncedPersistStore(useSpaceStore);
    }
  },

  selectWindow: (windowId: string, isMultiSelect: boolean) => {
    set((state) => ({
      selectedIds: isMultiSelect ? [...state.selectedIds, windowId] : windowId ? [windowId] : [],
    }));
  },

  groupSelected: () => {
    const { selectedIds } = get();
    logger.debug('Store groupSelected called with:', { selectedIds });

    if (selectedIds.length < 2) {
      logger.debug('Not enough windows selected to group');
      return;
    }

    const spaceId = get().activeSpace?.id;
    if (spaceId) {
      logger.debug('Triggering CRDT groupWindows');
      spaceCRDTService.groupWindows(spaceId, selectedIds);
    }
  },

  ungroup: (windowId) => {
    const window = get().windows[windowId] as WindowEntity;
    if (!window?.tabs) return;

    // Remove tab properties from window
    const updatedWindow = {
      ...window,
      tabs: undefined,
      activeTabId: undefined,
      isParentWindow: undefined
    };

    set(state => ({
      windows: {
        ...state.windows,
        [windowId]: updatedWindow
      }
    }));

    spaceCRDTService.ungroupWindows(windowId);
  },

  setWindows: (windows: AnyWindowEntity[]) => {
    logger.debug('Store setWindows called with:', {
      windowCount: windows?.length || 0,
      windows,
    });

    set((state) => {
      const newWindows = (windows || []).reduce((acc, win) => {
        // All windows are now just WindowEntity
        if (win && win.id && !acc[win.id]) {
          acc[win.id] = win;
        }
        return acc;
      }, {} as Record<string, AnyWindowEntity>);

      return { windows: newWindows };
    });
  },

  setStatus: (status) => {
    set({ status });
  },

  updateSpaceName: async (newName: string) => {
    logger.log('[SpaceStore] Updating space name:', newName);
    const spaceId = get().activeSpace?.id;
    if (!spaceId) {
      logger.error('Cannot update name - no active space');
      return;
    }

    try {
      await spaceService.updateSpaceName(spaceId, newName);
      
      // Update local state
      set((state) => ({
        activeSpace: state.activeSpace ? {
          ...state.activeSpace,
          name: newName
        } : null
      }));
    } catch (error) {
      logger.error('Failed to update space name:', error);
      throw error;
    }
  },

  updateSpaceChatSettings: async (spaceChatUpdates: Partial<NonNullable<SpaceSettings['spaceChat']>>) => {
    logger.log('[SpaceStore] Updating SpaceChat settings:', spaceChatUpdates);
    const spaceId = get().activeSpace?.id;
    const activeSpace = get().activeSpace;
    if (!spaceId || !activeSpace) {
      logger.error('Cannot update SpaceChat settings - no active space');
      return;
    }

    try {
      // Merge with existing spaceChat settings
      const currentSpaceChatSettings = activeSpace.settings.spaceChat || {
        currentThreadIds: {},
        isHistoryOpen: false,
        mode: 'chat',
        model: 'claude-3.5-sonnet',
        isContextVisible: false,
        widths: { focused: 300, spatial: 500 }
      };

      const newSpaceChatSettings = { ...currentSpaceChatSettings, ...spaceChatUpdates };
      const newSettings = { ...activeSpace.settings, spaceChat: newSpaceChatSettings };

      // Update via spaceService (which handles backend persistence)
      await spaceService.updateSpace(spaceId, activeSpace.windows, newSettings);
      
      // Update local state after successful backend update
      set((state) => ({
        activeSpace: state.activeSpace ? {
          ...state.activeSpace,
          settings: newSettings
        } : null
      }));

      // Also update CRDT for real-time collaboration
      spaceCRDTService.updateSettings(spaceId, newSettings);
    } catch (error) {
      logger.error('Failed to update SpaceChat settings:', error);
      throw error;
    }
  },

  cleanup: () => {
    const { cleanupFn } = get();
    logger.log('[SpaceStore] Cleaning up...');
    if (cleanupFn) {
      cleanupFn();
    }
    set({ 
      status: 'idle',
      activeSpace: null,
      windows: {},
      initialized: false,
      cleanupFn: () => {}
    } as Partial<SpaceStore>);
  },

  setBackgroundColor: (bgColor: string) => {
    const spaceId = get().activeSpace?.id;
    if (!spaceId) return;

    const activeSpace = get().activeSpace;
    if (!activeSpace) return;

    const newSettings = {
      ...activeSpace.settings,
      bgColor
    };

    set((state) => ({
      activeSpace: {
        ...activeSpace,
        settings: newSettings
      }
    }));

    spaceCRDTService.updateSettings(spaceId, newSettings);
  },

  toggleDebugger: () => set(state => ({ showDebugger: !state.showDebugger })),

  setActiveWindow: (windowId: string | null) => {
    logger.log('[SpaceStore] Setting active window:', windowId);
    set({ activeWindowId: windowId });
    
    // Persist the active window ID to CRDT if not null
    if (windowId) {
      const spaceId = get().activeSpace?.id;
      if (spaceId) {
        spaceCRDTService.updateActiveWindowId(spaceId, windowId);
      }
    }
  },

  bringWindowToFront: (windowId: string) => {
    const { windows, windowZIndexes } = get();
    if (!windows[windowId]) {
      logger.warn('[SpaceStore] Attempted to bring non-existent window to front:', windowId);
      return;
    }

    const maxZIndex = Math.max(0, ...Object.values(windowZIndexes));
    const newZIndexes = {
      ...windowZIndexes,
      [windowId]: maxZIndex + 1
    };

    // Update electron BrowserView if needed
    const electron = (window as any).electron;
    if (electron?.BrowserView?.reorder) {
      electron.BrowserView.reorder(newZIndexes);
    }

    set({ 
      activeWindowId: windowId,
      windowZIndexes: newZIndexes
    });
    
    // Persist the active window ID to CRDT
    const spaceId = get().activeSpace?.id;
    if (spaceId) {
      spaceCRDTService.updateActiveWindowId(spaceId, windowId);
    }
  },

  setWindowState: (windowId: string, state: WindowState) => {
    set(store => ({
      windowStates: {
        ...store.windowStates,
        [windowId]: state
      }
    }));
  },

  updateWindowPosition: (windowId: string, position: { x: number; y: number }) => {
    set(store => ({
      windowStates: {
        ...store.windowStates,
        [windowId]: {
          ...store.windowStates[windowId],
          position
        }
      }
    }));
  },

  updateWindowSize: (windowId: string, size: { width: number; height: number }) => {
    set(store => ({
      windowStates: {
        ...store.windowStates,
        [windowId]: {
          ...store.windowStates[windowId],
          size
        }
      }
    }));
  },

  setViewMode: (viewMode: 'spatial' | 'focused') => {
    const spaceId = get().activeSpace?.id;
    if (!spaceId) return;

    const activeSpace = get().activeSpace;
    if (!activeSpace) return;

    const newSettings = {
      ...activeSpace.settings,
      viewMode
    };

    set((state) => ({
      activeSpace: {
        ...activeSpace,
        settings: newSettings
      }
    }));

    spaceCRDTService.updateSettings(spaceId, newSettings);
  },

  saveToBackend: async () => {
    const spaceId = get().activeSpace?.id;
    if (!spaceId) return;

    const state = get();
    const windows = state.windows;
    const settings = state.activeSpace?.settings;
    
    logger.log('[SpaceStore] Persisting to backend after space update');
    
    await spaceService.updateSpace(spaceId, windows, settings || {});
  },

  finalizeWindowDrag: (windowId: string, position: { x: number, y: number }) => {
    logger.log(`[SpaceStore] Finalizing window drag for ${windowId} at (${position.x}, ${position.y})`);
    
    // Mark drag as complete
    windowDragState.isDragging = false;
    
    const spaceId = get().activeSpace?.id;
    if (!spaceId) return;
    
    // Update the window position one last time
    const updates = { position };
    
    // Set the specific window position
    set(state => ({
      windows: {
        ...state.windows,
        [windowId]: {
          ...state.windows[windowId],
          position
        }
      }
    }));
    
    // Update CRDT to ensure all clients see the final position
    spaceCRDTService.updateWindow(spaceId, windowId, updates);
    
    // Always save to backend after drag completes
    logger.log('[SpaceStore] Saving final position to backend');
    
    // Cancel any debounced saves
    debouncedPersistStore.cancel();
    windowDragState.pendingSave = false;
    
    // Directly save to backend
    get().saveToBackend()
      .then(() => logger.log('[SpaceStore] Successfully saved window positions after drag'))
      .catch(error => logger.error('[SpaceStore] Error saving window positions after drag:', error));
  },
}));

export type { AnyWindowEntity, WindowEntity };
export default useSpaceStore;

const createUISpace = (id: string) => {
	return {
		id: id,
		entityType: 'Space',
		name: 'New Space',
		windows: {},
		activeWindowId: undefined,
		settings: {
			isContentsVisible: false,
			isChatVisible: false,
			viewMode: 'spatial' as 'spatial',
			spaceChat: {
				currentThreadIds: {},
				isHistoryOpen: false,
				mode: 'chat',
				model: 'claude-3.5-sonnet',
				isContextVisible: false,
				widths: {
					focused: 300,
					spatial: 500
				}
			}
		},
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	}
}
