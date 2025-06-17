import './Space.scss';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EntityBrowserApp from '../../apps/EntityBrowserApp/EntityBrowserApp';
import NotesApp from '../../apps/NotesApp/components/NotesApp';
import { cleanupNotesStore } from '../../apps/NotesApp/store/notesAppStore';
import { getAllApps, useCustomEventListenerWithReply } from '../../services/actionService';
import type { AIEvent } from '../../services/aiService';
import { aiService } from '../../services/aiService';
import { appRegistry } from '../../services/appRegistryService';
import { spaceCRDTService } from '../../services/crdt/spaceCRDTService';
import { useAppRegistryStore } from '../../stores/appRegistryStore';
import { useElectronWindowStore } from '../../stores/electronWindowStore';
import useEntityStore from '../../stores/entityStore';
import type { CursorData } from '../../stores/presenceStore';
import usePresenceStore from '../../stores/presenceStore';
import useSpaceStore from '../../stores/spaceStore';
import type { BaseEntityType } from '../../types/entities';
import type { AnyWindowEntity, WindowEntity } from '../../types/windows';
import { ElectronWindowManager } from '../ElectronWindow/ElectronWindowManager';
import { SpacePermissions } from '../SpacePermissions';
import FileDetailsAction, { IFileDetailsAction } from './actions/FileDetailsAction';
import GetAppsAction, { IGetAppsAction } from './actions/GetAppsAction';
import GetExtensionAppsAction, { IGetExtensionAppsAction } from './actions/GetExtensionAppsAction';
import GetFilesAction, { IGetFilesAction } from './actions/GetFilesAction';
import OpenFileAction from './actions/OpenFileAction';
import BlankWindow from './BlankWindow';
import { registerActions } from './definition';
import { createWindowHandlers } from './handlers/windowHandlers';
import { useWindowBehaviors } from './hooks/useWindowBehaviors';
import { SpatialLayout, FocusedLayout } from './layouts';
import SpaceDropZone from './SpaceDropZone';
import SpaceChat from './SpaceChat/SpaceChat';
import SpaceContents from './SpaceContents';
import SpaceDetailsButton from './SpaceDetailsButton/SpaceDetailsButton';
import SystemMenuButton from './SystemMenuButton/SystemMenuButton';
import TaskBar from './TaskBar';
import useGalBoxStore from '../../components/GalSetupModal/store/galboxStore';
import {
  fileAndGroupFilter,
  getAppTitle,
  getAppTypeByExt,
  getEntityDisplayName,
  getWindowSizeAndPosition,
  getWindowTitle,
} from './utils/windowUtils';
import Window from './Window';
import { useGalBoxServer } from '../../hooks/useGalBoxServer';
import { useAuth0 } from '@auth0/auth0-react';
import { ViewModeProvider } from './contexts/ViewModeContext';
import UserPresence, { useCursorPresence } from './UserPresence/UserPresence';
import { spaceService } from '../../services/spaceService';
import { FiUsers } from 'react-icons/fi';
import { logger } from '../../utils/logger';
// Add debug marker to help identify when this code is loaded
logger.log(`[Space] Code loaded with direct persistence at ${new Date().toISOString()}`);

declare global {
  interface Window {
    testWindowMovement?: (duration?: number, steps?: number) => void;
    testWindowPosition?: (x: number, y: number, method?: string) => void;
    __windowDragging?: boolean;
    __SPACE_INITIALIZING__?: boolean;
    __DEBUG_WINDOW_ID__?: string;
    __DEBUG_PARENT_ID__?: string | null;
  }
}

logger.log('[Space] Registering actions...');

registerActions();

interface SpaceProps {
  id: string;
}

const generateWindowId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `window-${timestamp}-${random}`;
};

const Space: React.FC<SpaceProps> = ({ id }) => {
  const { user } = useAuth0();
  const [isLoading, setIsLoading] = useState(true);
  const {
    activeSpace,
    activeWindowId,
    windows,
    bringWindowToFront,
    setActiveWindow,
    windowZIndexes,
    selectedIds,
    addWindow,
    removeWindow,
    selectWindow,
    updateWindow,
    isChatVisible,
    setIsChatVisible,
    setViewMode,
  } = useSpaceStore();

  // Get app registry store functions
  const initializeApps = useAppRegistryStore(state => state.initializeApps);

  // Initialize apps when Space mounts
  useEffect(() => {
    const initApps = async () => {
      setIsLoading(true);
      logger.debug('[Space] Starting app initialization...');
      
      // Add retry logic with exponential backoff
      const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3, initialDelay = 1000) => {
        let retries = 0;
        let delay = initialDelay;
        
        while (retries < maxRetries) {
          try {
            return await fn();
          } catch (error) {
            retries++;
            if (retries >= maxRetries) {
              logger.warn(`[Space] Maximum retries (${maxRetries}) reached, operation failed.`);
              throw error;
            }
            
            // Exponential backoff + small random jitter
            delay = delay * 2 + Math.random() * 500;
            logger.log(`[Space] Retrying operation in ${Math.round(delay)}ms (attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      };
      
      try {
        // First initialize system apps with retry
        await retryWithBackoff(async () => {
          await appRegistry.initializeSystemApps();
          logger.debug('[Space] System apps initialized');
        });
        
        // Then load all apps into store with retry
        await retryWithBackoff(async () => {
          await initializeApps();
          logger.debug('[Space] Apps loaded into store');
        });
      } catch (error) {
        logger.error('[Space] Failed to initialize apps after multiple retries:', error);
        // Continue anyway - app might work with partial initialization
      } finally {
        // Set loading to false after initialization completes
        setTimeout(() => setIsLoading(false), 500);
      }
    };
    
    // Delay initial app loading slightly to allow UI to render first
    setTimeout(() => {
      initApps();
    }, 500);
  }, [initializeApps]);

  useEffect(() => {
    logger.log('[Space][ActiveWindowId] Active window ID:', activeWindowId);
  }, [activeWindowId]);

  const { entities } = useEntityStore();

  const windowBehaviors = useWindowBehaviors({
    spaceWidth: window.innerWidth,
    spaceHeight: window.innerHeight,
  });

  const [windowIdToAppIdMap, setWindowIdToAppIdMap] = useState<{ [key: string]: string }>({});
  const [isContentsVisible, setIsContentsVisible] = useState(false);
  const navigate = useNavigate();
  const clientId = usePresenceStore((state) => state.clientId);
  const setCursor = usePresenceStore((state) => state.setCursor);
  
  // Electron window management (rename to avoid conflicts)
  const { addWindow: addElectronWindow, removeWindow: removeElectronWindow } = useElectronWindowStore();

  // Get componentMap from store
  const componentMap = useAppRegistryStore((state) => state.componentMap);

  // Add notesEditorRef at the component level
  const notesEditorRef = useRef(null);

  // Get the GalBox store to check for status
  const { activeGalBox, serverStatus: galBoxStoreStatus, startPollingGalBox, stopPollingGalBox, checkGalBoxServer } = useGalBoxStore();
  const [isGalBoxReady, setIsGalBoxReady] = useState(false);

  // Check if GalBox is ready
  useEffect(() => {
    setIsGalBoxReady(activeGalBox?.status === 'ready' && galBoxStoreStatus.online);
  }, [activeGalBox, galBoxStoreStatus]);

  // Start polling for GalBox status when component mounts
  useEffect(() => {
    // First check if there's a GalBox already detected
    if (!activeGalBox) {
      // Look through stored GalBoxes
      // This would be a good place to add a method to check for GalBoxes
      logger.log('[Space] No active GalBox detected');
    }

    if (activeGalBox?.serialNumber) {
      logger.log('[Space] Starting GalBox status polling for', activeGalBox.serialNumber);
      // Poll more frequently (every 10 seconds) to catch network changes
      startPollingGalBox(activeGalBox.serialNumber, 10000);
    }

    return () => {
      logger.log('[Space] Stopping GalBox status polling');
      stopPollingGalBox();
    };
  }, [activeGalBox?.serialNumber, startPollingGalBox, stopPollingGalBox]);

  // Force an immediate check when IP address changes
  useEffect(() => {
    if (activeGalBox?.ipAddress) {
      // If IP starts with 169.254.x.x, it's a direct Ethernet connection
      // which might need special handling
      if (activeGalBox.ipAddress.startsWith('169.254')) {
        logger.log('[Space] Detected direct Ethernet connection, checking connection...');
        // Immediate check
        checkGalBoxServer(activeGalBox.ipAddress);
      }
    }
  }, [activeGalBox?.ipAddress, checkGalBoxServer]);

  // First define closeApp
  const closeApp = useCallback(
    (windowId: string) => {
      setActiveWindow(null);
      
      setWindowIdToAppIdMap((prev) => {
        const newMap = { ...prev };
        delete newMap[windowId];
        return newMap;
      });
    },
    [setActiveWindow],
  );

  // Then define handleRemoveWindow
  const handleRemoveWindow = useCallback(
    (windowId: string) => {
      // First remove from local state
      removeWindow(windowId);
      // Clean up window management state
      closeApp(windowId);
    },
    [removeWindow, closeApp],
  );

  const renderWindowContent = useCallback(
    (window: WindowEntity) => {
      logger.log('Rendering window content:', {
        window,
        availableComponents: Object.keys(componentMap),
        component: window.appType ? componentMap[window.appType] : null,
      });

      // For blank windows
      if (window.component === 'blank') {
        return <BlankWindow onSelect={window.props?.onSelect} />;
      }

      // For EntityBrowserApp (special case due to props)
      if (window.component === 'EntityBrowserApp') {
        return (
          <EntityBrowserApp
            windowId={window.id}
            spaceId={id}
            title={window.title || 'Entity Browser'}
            onClose={() => handleRemoveWindow(window.id)}
            {...window.props}
          />
        );
      }

      // For Notes app, ensure we have an entity with _id
      if (window.appType === 'notes') {
        // If no entity exists, create one with the noteId
        const noteEntity = window.entity || {
          _id: window.props?.noteId || `note-${Date.now()}`,
          entityType: 'Note',
          type: 'Note',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        return (
          <NotesApp
            ref={notesEditorRef}
            noteId={noteEntity._id}
            windowId={window.id}
            spaceId={id}
            onClose={() => handleRemoveWindow(window.id)}
          />
        );
      }

      // For all other apps, use componentMap
      if (window.appType) {
        const Component = componentMap[window.appType];
        if (Component) {
          return (
            <Component
              {...window.props}
              entity={window.entity}
              entityId={window.appType}
              windowId={window.id}
              spaceId={id}
              title={window.title}
              onClose={() => handleRemoveWindow(window.id)}
              appType={window.appType}
            />
          );
        }
      }

      logger.warn('Unknown window type:', window);
      return <div>Unknown Component</div>;
    },
    [id, handleRemoveWindow, componentMap],
  );

  const { openWebDocument } = useWindowBehaviors({
    spaceWidth: window.innerWidth,
    spaceHeight: window.innerHeight,
  });

  // Handle mouse movement
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Update cursor position in the presence store
      setCursor(x, y);
    },
    [setCursor],
  );

  // Modify your existing setIsContentsVisible and setIsChatVisible calls:
  const handleSetContentsVisible = useCallback(
    (visible: boolean) => {
      setIsContentsVisible(visible);
      if (id) {
        spaceCRDTService.updateSettings(id, {
          isContentsVisible: visible,
          isChatVisible,
        });
      }
    },
    [id, isChatVisible],
  );

  const handleSetChatVisible = useCallback(
    (visible: boolean) => {
      setIsChatVisible(visible);
      if (id && activeSpace) {
        const newSettings = {
          ...activeSpace.settings,
          isChatVisible: visible,
        };
        
        // Update backend first, then CRDT
        spaceService.updateSpace(id, activeSpace.windows, newSettings)
          .then(() => {
            logger.log('[Space] Successfully updated isChatVisible in backend');
            // Also update CRDT for real-time collaboration
            spaceCRDTService.updateSettings(id, newSettings);
          })
          .catch(error => {
            logger.error('[Space] Error updating isChatVisible in backend:', error);
          });
      }
    },
    [id, activeSpace, setIsChatVisible],
  );

  // Window Management
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!id) return;

      windowBehaviors.handleKeyboardShortcuts(event);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [id, windowBehaviors]);

  // Add a helper function to manage window state
  const manageWindowState = useCallback(
    (windowId: string, appId?: string) => {
      const windowIds = Object.keys(windows);
      
      if (appId) {
        setWindowIdToAppIdMap((prev) => ({
          ...prev,
          [windowId]: appId,
        }));
      }

      // Only bring to front if the window exists and isn't already active
      if (windowIds.includes(windowId) && activeWindowId !== windowId) {
        bringWindowToFront(windowId);
      }
    },
    [windows, bringWindowToFront, activeWindowId],
  );

  // Modify openApp to handle BrowserView windows
  const openApp = useCallback(
    (appId: string) => {
      if (!id) {
        logger.error('Cannot open app - space not initialized');
        return;
      }

      const windowId = generateWindowId();
      const isElectron = !!(window as any).electron?.BrowserView;
      const { size, position } = getWindowSizeAndPosition();

      // Handle Electron browser windows
      if (appId === 'browser' && isElectron) {
        addElectronWindow({
          id: windowId,
          type: 'browserView',
          url: 'https://www.google.com',
          title: getAppTitle(appId),
          bounds: {
            ...position,
            ...size,
          },
          zIndex: 0,
        });
      }
      // Handle component-based windows
      else if (appId === 'EntityBrowserApp') {
        addWindow({
          id: windowId,
          type: 'window',
          component: appId, // Use appId directly as component name
          title: getAppTitle(appId),
          props: {
            windowId,
            spaceId: id,
          },
          position,
          size,
        });
      }
      // Handle PDF viewer
      else if (appId === 'pdfium') {
        addWindow({
          id: windowId,
          type: 'window',
          appType: 'pdfium',
          title: getAppTitle(appId),
          position,
          size,
          entity: null,
        });
      }
      // Handle other entity-based windows
      else {
        addWindow({
          id: windowId,
          type: 'window',
          position,
          size,
          appType: appId,
          title: getAppTitle(appId),
        });
      }

      manageWindowState(windowId, appId);
    },
    [addElectronWindow, addWindow, id, manageWindowState],
  );

  useCustomEventListenerWithReply<IGetFilesAction>(GetFilesAction.name, (event, { path }) => {
    const pathParts = path.split('/').filter(Boolean);

    let currentEntities: BaseEntityType[] = entities.filter(fileAndGroupFilter);

    for (let pathPart of pathParts) {
      const nextDir = currentEntities.find(
        (entity) => getEntityDisplayName(entity) === pathPart && entity.entityType === 'Group',
      );

      if (nextDir) {
        currentEntities = nextDir?.children?.filter(fileAndGroupFilter) || [];
      } else {
        return 'Directory not found';
      }
    }

    return currentEntities.map((entity: BaseEntityType) => ({
      type: entity.entityType === 'Group' ? 'directory' : 'file',
      name: getEntityDisplayName(entity),
    }));
  });

  useCustomEventListenerWithReply<IFileDetailsAction>(FileDetailsAction.name, (event, { filePath }) => {
    return entities.find((entity) => filePath.includes(getEntityDisplayName(entity)));
  });

  useEffect(() => {
    const handleOpenFile = (event: CustomEvent) => {
      logger.log('[Space] OpenFileAction received:', {
        event,
        detail: event.detail,
        arguments: event.detail?.arguments,
      });

      const { filePath, appName, entityId } = event.detail?.arguments || {};

      if (!appName) {
        logger.error('[Space] No appName provided for file:', filePath);
        return;
      }

      const windowId = generateWindowId();
      const { size, position } = getWindowSizeAndPosition();

      const windowConfig: WindowEntity = {
        id: windowId,
        type: 'window' as const,
        position,
        size,
        appType: appName,
        title: filePath?.split('/').pop() || 'Untitled',
        entity: {
          _id: entityId,
          name: filePath?.split('/').pop() || 'Untitled',
          type: 'File',
          entityType: 'File',
        },
      };

      logger.log('[Space] Adding window:', windowConfig);
      addWindow(windowConfig);
    };

    document.addEventListener(OpenFileAction.name, handleOpenFile as EventListener);
    return () => document.removeEventListener(OpenFileAction.name, handleOpenFile as EventListener);
  }, [addWindow]);

  useCustomEventListenerWithReply<IGetExtensionAppsAction>(GetExtensionAppsAction.name, (event, { ext }) => {
    return getAppTypeByExt(ext);
  });

  // Handle window selection (only triggered by clicking the select-handle)
  const handleWindowClick = useCallback((windowId: string, event: React.MouseEvent) => {
    logger.debug('Window clicked:', {
      windowId,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
    });

    event.stopPropagation();
    const isMultiSelect = event.metaKey || event.ctrlKey;
    selectWindow(windowId, isMultiSelect);
  }, [selectWindow]);

  // Handle window focus (triggered by clicking anywhere else on the window)
  const handleWindowFocus = useCallback((windowId: string) => {
    bringWindowToFront(windowId);
  }, [bringWindowToFront]);

  // Clear selection when clicking space background
  const handleSpaceClick = (event: React.MouseEvent) => {
    // Only clear selection if clicking directly on the space background
    if (event.target === event.currentTarget) {
      selectWindow('', false);
    }
  };

  // Modify memoizedAppContents to use useMemo more effectively
  const memoizedAppContents = useMemo(() => {
    logger.debug('[Space] Creating memoized app contents, windows:', windows);
    if (!windows) return {};

    return Object.values(windows).reduce(
      (acc, entity) => {
        if (entity.type !== 'window') {
          logger.debug(`Skipping non-window entity:`, entity);
          return acc;
        }

        // Create a stable key for the content
        const contentKey = `${entity.id}-${entity.appType}`;
        if (!acc[contentKey]) {
          logger.debug(`[Space] Creating content for`, entity);
          acc[contentKey] = renderWindowContent(entity);
        }
        return acc;
      },
      {} as Record<string, React.ReactNode>,
    );
  }, [windows, renderWindowContent]);

  const windowHandlers = useMemo(
    () =>
      createWindowHandlers({
        addWindow,
        windowManager: {
          bringToFront: bringWindowToFront,
          windows: windows,
        },
        spaceId: id,
        updateWindow: (windowId: string, updates: Partial<AnyWindowEntity>) => {
          useSpaceStore.getState().updateWindow(windowId, updates);
        },
        groupSelected: useSpaceStore.getState().groupSelected,
      }),
    [addWindow, bringWindowToFront, windows, id],
  );

  const handleCreateBlankWindow = useCallback(() => {
    windowHandlers.createBlankWindow();
  }, [windowHandlers]);

  // Add this effect alongside other event listeners
  useEffect(() => {
    const handleOpenNote = (event: Event) => {
      const customEvent = event as CustomEvent<{ noteId: string }>;
      logger.debug('Space handling openNote event:', customEvent.detail);

      const windowId = generateWindowId();

      const noteEntity: BaseEntityType = {
        _id: customEvent.detail.noteId,
        id: customEvent.detail.noteId,
        name: 'Note',
        type: 'note',
        entityType: 'Note',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      addWindow({
        id: windowId,
        type: 'window',
        position: { x: 100, y: 100 },
        size: { width: 800, height: 600 },
        appType: 'notes',
        entity: noteEntity,
      });
      bringWindowToFront(windowId);
    };

    window.addEventListener('openNote', handleOpenNote);
    return () => window.removeEventListener('openNote', handleOpenNote);
  }, [addWindow, bringWindowToFront]);

  // Sync window updates to CRDT
  const handleUpdateWindow = useCallback((windowId: string, updates: Partial<AnyWindowEntity>) => {
    updateWindow(windowId, updates);
  }, [updateWindow]);

  useEffect(() => {
    const handleOpenWebDocument = (event: Event) => {
      const customEvent = event as CustomEvent<{ entity: BaseEntityType }>;
      const url = (customEvent.detail.entity as any).skeleton.url;
      const { window, windowId } = openWebDocument(url);

      window.appType = 'webdoc';
      window.entity = customEvent.detail.entity;

      addWindow(window);
      manageWindowState(windowId, 'webdoc');
    };

    window.addEventListener('openWebDocument', handleOpenWebDocument);
    return () => window.removeEventListener('openWebDocument', handleOpenWebDocument);
  }, [openWebDocument, addWindow, manageWindowState]);

  // Add this effect to handle CRDT updates
  // useEffect(() => {
  //   if (!id) return;

  //   const handleSettingsUpdate = (settings: { isContentsVisible?: boolean; isChatVisible?: boolean }) => {
  //     if (settings.isContentsVisible !== undefined) {
  //       setIsContentsVisible(settings.isContentsVisible);
  //     }
  //     if (settings.isChatVisible !== undefined) {
  //       setIsChatVisible(settings.isChatVisible);
  //     }
  //   };

  //   spaceCRDTService.onSettingsUpdate(id, handleSettingsUpdate);
  //   return () => spaceCRDTService.offSettingsUpdate(id, handleSettingsUpdate);
  // }, [id]);

  // const handleGroupWindows = (windowIds: string[]) => {
  //   if (!id) return; // id should be your space ID
  //   spaceService.groupWindows(windowIds, id).catch((error) => logger.error('Failed to group windows:', error));
  // };
  //
  // const handleUngroupWindows = (groupId: string) => {
  //   if (!id) return; // id should be your space ID
  //   spaceService.ungroupWindows(groupId, id).catch((error) => logger.error('Failed to ungroup windows:', error));
  // };

  // Add effect to log store updates
  useEffect(() => {
    logger.debug('Store windows updated:', windows);
  }, [windows]);

  // Add this effect to record window events
  useEffect(() => {
    const recordWindowEvent = (windowId: string, eventType: string, data?: any) => {
      const window = windows[windowId];
      if (!window) return;

      const event: AIEvent = {
        type: eventType,
        window: window,
        entity: window.type === 'window' ? window.entity : undefined,
        data,
        timestamp: Date.now(),
      };

      aiService.recordEvent(event);
    };

    // Record events for each window
    Object.keys(windows).forEach((windowId) => {
      recordWindowEvent(windowId, 'window_opened');
    });

    return () => {
      // Cleanup if needed
    };
  }, [windows]);

  // First, let's fix the window movement effect
  useEffect(() => {
    const handleWindowMove = () => {
      // Force update of all BrowserViews
      document.querySelectorAll('.browser-content').forEach((container) => {
        const event = new CustomEvent('browser-update-bounds');
        container.dispatchEvent(event);
      });
    };

    // Use a passive event listener for better performance during window dragging
    window.addEventListener('mousemove', handleWindowMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleWindowMove);
  }, []);

  useCustomEventListenerWithReply<IGetAppsAction>(GetAppsAction.name, () => getAllApps());

  // Then fix the active window title rendering
  const activeWindow = activeWindowId ? windows[activeWindowId] : null;

  const handleCloseTab = useCallback(
    (tabId: string, parentId: string) => {
      const parentWindow = windows[parentId];
      if (!parentWindow?.tabs) return;

      if (parentWindow.tabs.length === 2) {
        // If only 2 tabs left, remove tab properties entirely
        handleUpdateWindow(parentId, {
          tabs: undefined,
          activeTabId: undefined,
          isParentWindow: undefined,
        });
      } else {
        // Remove the tab and update active tab if needed
        const newTabs = parentWindow.tabs.filter((id) => id !== tabId);
        handleUpdateWindow(parentId, {
          tabs: newTabs,
          activeTabId: parentWindow.activeTabId === tabId ? newTabs[0] : parentWindow.activeTabId,
        });
        // Also remove the window itself
        handleRemoveWindow(tabId);
      }
    },
    [windows, handleUpdateWindow, handleRemoveWindow],
  );

  // Local state for drag positions to avoid CRDT spam during drag
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});
  const isDraggingRef = useRef(false);

  const handleDrag = useCallback(
    (windowId: string, x: number, y: number) => {
      if (!id) return;
      
      // Set flags to indicate we're dragging
      (window as any).__windowDragging = true;
      isDraggingRef.current = true;
      
      // AGGRESSIVE OPTIMIZATION: Skip ALL store updates during drag
      // Only update local drag positions for immediate visual feedback
      setDragPositions(prev => ({
        ...prev,
        [windowId]: { x, y }
      }));
      
      // Track this for final sync on drag stop
      (window as any).__lastDragWindowId = windowId;
      (window as any).__lastDragPosition = { x, y };
    },
    [id]
  );
  
  const handleDragStop = useCallback(
    (windowId: string, x: number, y: number) => {
      // Log for debugging
      logger.log(`[Space][handleDragStop] Window ${windowId} stopped at (${x}, ${y})`);
      
      // Reset drag state
      (window as any).__windowDragging = false;
      isDraggingRef.current = false;
      
      // Clear drag position and apply final position to store
      setDragPositions(prev => {
        const newState = { ...prev };
        delete newState[windowId];
        return newState;
      });
      
      // Use the store's finalizeWindowDrag method to handle persistence properly
      useSpaceStore.getState().finalizeWindowDrag(windowId, { x, y });
    },
    [/* No dependencies needed since we're using getState() */]
  );

  const renderWindows = useMemo(() => {
    return Object.values(windows || {})
      .filter((entity) => entity.type === 'window' && (!entity.isTab || entity.isParentWindow))
      .map((entity) => (
        <Window
          key={entity.id}
          id={entity.id}
          entityId={entity.appType}
          title={getWindowTitle(entity)}
          position={dragPositions[entity.id] || entity.position}
          size={entity.size}
          isSelected={selectedIds.includes(entity.id)}
          onClose={() => handleRemoveWindow(entity.id)}
          onClick={handleWindowClick}
          onFocus={() => handleWindowFocus(entity.id)}
          onDrag={handleDrag}
          onDragStop={(x, y) => {
            handleDragStop(entity.id, x, y);
          }}
          onResizeStop={(width, height) => {
            // First finalize any position changes
            useSpaceStore.getState().finalizeWindowDrag(
              entity.id, 
              entity.position || { x: 0, y: 0 }
            );
            
            // Then update the window size
            useSpaceStore.getState().updateWindow(
              entity.id, 
              { size: { width, height } }
            );
          }}
          zIndex={windowZIndexes[entity.id] || 0}
          isFocused={activeWindowId === entity.id}
          onAddWindow={() => windowHandlers.addTab(entity.id)}
          tabs={entity.tabs}
          activeTabId={entity.activeTabId}
          onActivateTab={(tabId) => {
            handleUpdateWindow(entity.id, {
              activeTabId: tabId,
            });
          }}
          onCloseTab={(tabId) => handleCloseTab(tabId, entity.id)}
          tabContents={memoizedAppContents}
        >
          {memoizedAppContents[`${entity.id}-${entity.appType}`]}
        </Window>
      ));
  }, [
    windows,
    dragPositions,
    windowZIndexes,
    selectedIds,
    activeWindowId,
    handleWindowClick,
    handleWindowFocus,
    memoizedAppContents,
    handleRemoveWindow,
    handleDrag,
    handleDragStop,
    windowHandlers,
    handleCloseTab,
    handleUpdateWindow,
    id,
  ]);

  const createEntityBrowserWindow = (spaceId: string) => {
    const windowId = generateWindowId();

    addWindow({
      id: windowId,
      type: 'window',
      component: 'EntityBrowser',
      title: 'Entity Browser',
      props: {
        windowId,
        spaceId,
      },
      position: { x: 100, y: 100 },
      size: { width: 400, height: 600 },
    });

    return windowId;
  };

  useEffect(() => {
    return () => {
      // Make sure to cleanup notes store when Space unmounts
      cleanupNotesStore('window-1', id);
    };
  }, [id]);

  // Add a new state for the dropdown menu visibility
  const [showGalBoxDetails, setShowGalBoxDetails] = useState(false);
  
  // Add a ref for the dropdown
  const galBoxDropdownRef = useRef<HTMLDivElement>(null);
  
  // Effect to close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (galBoxDropdownRef.current && !galBoxDropdownRef.current.contains(event.target as Node)) {
        setShowGalBoxDetails(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Use the new useGalBoxServer hook
  const { serverStatus: galBoxServerStatus, detectServer, runModel } = useGalBoxServer();

  // Get the current view mode from space settings (default to spatial)
  const viewMode = activeSpace?.settings?.viewMode || 'spatial';

  // Add a toggle function for the view mode
  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'spatial' ? 'focused' : 'spatial';
    setViewMode(newMode);
  }, [viewMode, setViewMode]);

  // Get cursor components for rendering in the space
  const { renderCursors } = useCursorPresence();

  useEffect(() => {
    // Add an improved test function to the window object
    (window as any).testWindowPosition = (x: number, y: number, method = 'direct') => {
      // Get the first window ID
      const windowIds = Object.keys(windows);
      if (windowIds.length === 0) {
        logger.error('[TEST] No windows found');
        return;
      }
      
      const windowId = windowIds[0];
      logger.log(`[TEST] Setting window ${windowId} position to (${x}, ${y}) using ${method} method`);
      
      if (method === 'direct') {
        // Update via CRDT
        spaceCRDTService.updateWindow(id, windowId, { 
          position: { x, y } 
        });
      } else if (method === 'both') {
        // Update both ways for comparison
        // First direct
        spaceCRDTService.updateWindow(id, windowId, { 
          position: { x, y } 
        });
        
        // Then also local state
        updateWindow(windowId, { 
          position: { x, y } 
        });
      } else {
        // Standard update via local state only
        updateWindow(windowId, { 
          position: { x, y } 
        });
      }
    };
    
    // Add automated test for moving windows in a pattern
    (window as any).testWindowMovement = (duration = 5000, steps = 30) => {
      const windowIds = Object.keys(windows);
      if (windowIds.length === 0) {
        logger.error('[TEST] No windows found');
        return;
      }
      
      const windowId = windowIds[0];
      logger.log(`[TEST] Starting automated window movement test for ${windowId}`);
      
      // First enable debug panel
      useSpaceStore.getState().toggleDebugger();
      
      // Get current position of window
      const currentWindow = windows[windowId];
      if (!currentWindow || !currentWindow.position) {
        logger.error('[TEST] Window has no position');
        return;
      }
      
      const startPosition = { 
        x: currentWindow.position.x, 
        y: currentWindow.position.y 
      };
      
      // Create circle motion path
      const radius = 100;
      const interval = duration / steps;
      let step = 0;
      
      const moveWindow = () => {
        if (step >= steps) {
          logger.log('[TEST] Window movement test completed');
          return;
        }
        
        // Calculate position on circle
        const angle = (step / steps) * Math.PI * 2;
        const x = startPosition.x + Math.cos(angle) * radius;
        const y = startPosition.y + Math.sin(angle) * radius;
        
        // Move window
        spaceCRDTService.updateWindow(id, windowId, { 
          position: { x, y } 
        });
        
        step++;
        setTimeout(moveWindow, interval);
      };
      
      // Start the test
      moveWindow();
    };
    
    return () => {
      delete (window as any).testWindowPosition;
      delete (window as any).testWindowMovement;
    };
  }, [id, windows, updateWindow]);

  // In Space component, add this effect to handle Ctrl+D shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+D to toggle debug panel
      if (event.key === 'd' && event.ctrlKey) {
        event.preventDefault();
        useSpaceStore.getState().toggleDebugger();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Add this near the other debug functions
  useEffect(() => {
    // Add space debugging tools to the global window object
    (window as any).spaceTools = {
      ...(window as any).spaceTools || {},
      // Add a function to clean up ghost windows in the current space
      cleanupGhostWindows: async () => {
        if (!id) {
          logger.error("[SpaceTools] No active space");
          return { error: "No active space" };
        }
        
        try {
          logger.log(`[SpaceTools] Starting cleanup of space ${id}`);
          
          // First, let's get the current state
          const beforeWindows = { ...useSpaceStore.getState().windows };
          logger.log(`[SpaceTools] Before cleanup: ${Object.keys(beforeWindows).length} windows`, 
            Object.keys(beforeWindows));
          
          // Call the cleanup function in spaceService
          const cleanedSpace = await spaceService.cleanupSpace(id);
          
          logger.log(`[SpaceTools] Space cleaned. Result:`, cleanedSpace);
          
          // Now sync the store with the cleaned data
          useSpaceStore.getState().setWindows(
            Object.entries(cleanedSpace.windows).map(([id, win]) => ({
              ...win,
              id
            }))
          );
          
          // Get the new state
          const afterWindows = { ...useSpaceStore.getState().windows };
          logger.log(`[SpaceTools] After cleanup: ${Object.keys(afterWindows).length} windows`, 
            Object.keys(afterWindows));
            
          // Return a summary of what was done
          return {
            spaceId: id,
            removed: Object.keys(beforeWindows).filter(id => !afterWindows[id]),
            kept: Object.keys(afterWindows),
            beforeCount: Object.keys(beforeWindows).length,
            afterCount: Object.keys(afterWindows).length
          };
        } catch (error) {
          logger.error("[SpaceTools] Error cleaning up ghost windows:", error);
          return { error: String(error) };
        }
      }
    };
  }, [id]);

  const [showPermissions, setShowPermissions] = useState(false);

  return (
    <ViewModeProvider>
      <SpaceDropZone className="desktop">
        {/* User avatars and view mode toggle in top right */}
        <div className="top-right-controls">
          <UserPresence spaceId={id} user={user} />
          
          {/* Share button */}
          <button
            className="share-button"
            onClick={() => setShowPermissions(true)}
            title="Share this space"
            style={{ opacity: isLoading ? 0 : 1 }}
          >
            + <FiUsers />
          </button>
          
          {/* View mode toggle button */}
          <button 
            className="view-mode-toggle"
            onClick={toggleViewMode}
            title={`Switch to ${viewMode === 'spatial' ? 'focused' : 'spatial'} view`}
            style={{ opacity: isLoading ? 0 : 1 }}
          >
            {viewMode === 'spatial' ? '👓' : '🌐'}
          </button>
        </div>

        {/* Space Permissions Modal */}
        {showPermissions && (
          <SpacePermissions
            spaceId={id}
            onClose={() => setShowPermissions(false)}
          />
        )}

        {isLoading ? (
          <div className="space-loading">
            <div className="space-loading-spinner">
              <div className="spinner-circle"></div>
              <div className="spinner-text">Loading space...</div>
            </div>
          </div>
        ) : (
          <>
            {viewMode === 'spatial' ? (
              <>
                <SpatialLayout
                  id={id}
                  windows={renderWindows}
                  cursors={renderCursors}
                  isContentsVisible={isContentsVisible}
                  handleSetContentsVisible={handleSetContentsVisible}
                  isChatVisible={isChatVisible}
                  handleSetChatVisible={handleSetChatVisible}
                  handleSpaceClick={handleSpaceClick}
                  handleMouseMove={handleMouseMove}
                  bgColor={activeSpace?.settings?.bgColor}
                  user={user}
                  entities={windows}
                  selectedIds={selectedIds}
                  handleWindowClick={handleWindowClick}
                  openApp={openApp}
                  handleCreateBlankWindow={handleCreateBlankWindow}
                  activeWindow={activeWindow}
                  getWindowTitle={getWindowTitle}
                />
              </>
            ) : (
              <FocusedLayout
                id={id}
                activeWindowId={activeWindowId}
                windows={windows}
                windowContents={memoizedAppContents}
                isChatVisible={isChatVisible}
                handleSetChatVisible={handleSetChatVisible}
                user={user}
                handleWindowClick={handleWindowClick}
                handleWindowFocus={handleWindowFocus}
                openApp={openApp}
                handleMouseMove={handleMouseMove}
                bgColor={activeSpace?.settings?.bgColor}
                getWindowTitle={getWindowTitle}
                activeWindow={activeWindow}
                handleCreateBlankWindow={handleCreateBlankWindow}
              />
            )}
          </>
        )}
      </SpaceDropZone>
    </ViewModeProvider>
  );
};

export default Space;
