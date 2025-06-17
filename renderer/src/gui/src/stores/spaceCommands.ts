import { Command } from "types/commands";
import useSpaceStore from "./spaceStore";
import { WindowEntity } from "types/windows";
import { generateWindowId } from "../components/Space/utils/windowUtils";
import { registerCommands } from "./commandRegistryStore";

// Space-level commands for window and UI management
export const spaceCommands: Command[] = [
  {
    id: 'space_createWindow',
    description: 'Create a new window in the space with the specified app type. Returns the created window ID and details.',
    parameters: [
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space where the window should be created',
        required: true
      },
      {
        name: 'appType',
        type: 'string',
        description: 'The type of app to open in the window (docs, notes, browser, pdfium, etc.)',
        required: true
      },
      {
        name: 'title',
        type: 'string',
        description: 'Optional title for the window (defaults to app name)',
        required: false
      },
      {
        name: 'position',
        type: 'object',
        description: 'Optional position for the window {x: number, y: number} (defaults to 100, 100)',
        required: false
      },
      {
        name: 'size',
        type: 'object', 
        description: 'Optional size for the window {width: number, height: number} (defaults to 800x600)',
        required: false
      },
      {
        name: 'entity',
        type: 'object',
        description: 'Optional entity to associate with the window (for entity-based apps)',
        required: false
      }
    ],
    handler: ({spaceId, appType, title, position, size, entity, callback}: {
      spaceId: string, 
      appType: string, 
      title?: string, 
      position?: {x: number, y: number}, 
      size?: {width: number, height: number},
      entity?: any,
      callback: (text: string) => void
    }) => {
      try {
        // Validate required parameters
        if (!spaceId || typeof spaceId !== 'string') {
          throw new Error('spaceId is required and must be a string');
        }
        
        if (!appType || typeof appType !== 'string') {
          throw new Error('appType is required and must be a string');
        }
        
        const { addWindow, bringWindowToFront } = useSpaceStore.getState();
        
        const windowId = generateWindowId();
        const defaultPosition = position || { x: 100, y: 100 };
        const defaultSize = size || { width: 800, height: 600 };
        const windowTitle = title || (appType.charAt(0).toUpperCase() + appType.slice(1));
        
        const window: WindowEntity = {
          id: windowId,
          type: 'window',
          position: defaultPosition,
          size: defaultSize,
          appType: appType,
          title: windowTitle,
          ...(entity && { entity })
        };
        
        console.log('[space_createWindow] Creating window:', window);
        
        addWindow(window);
        bringWindowToFront(windowId);
        
        callback(JSON.stringify({
          success: true,
          window: {
            id: windowId,
            appType,
            title: windowTitle,
            position: defaultPosition,
            size: defaultSize,
            ...(entity && { entity })
          }
        }));
        
      } catch (error: any) {
        console.error('[space_createWindow] Error:', error);
        callback(JSON.stringify({
          success: false,
          error: `Failed to create window: ${error.message || 'Unknown error'}`,
          spaceId,
          appType: appType || 'undefined'
        }));
      }
    }
  },
  {
    id: 'space_updateWindow',
    description: 'Update properties of an existing window (position, size, title, etc.)',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window to update',
        required: true
      },
      {
        name: 'updates',
        type: 'object',
        description: 'Object containing the properties to update (position, size, title, etc.)',
        required: true
      }
    ],
    handler: ({windowId, updates, callback}: {windowId: string, updates: any, callback: (text: string) => void}) => {
      try {
        const { updateWindow, windows } = useSpaceStore.getState();
        
        if (!windows[windowId]) {
          throw new Error(`Window with ID ${windowId} not found`);
        }
        
        console.log('[space_updateWindow] Updating window:', { windowId, updates });
        
        updateWindow(windowId, updates);
        
        const updatedWindow = useSpaceStore.getState().windows[windowId];
        
        callback(JSON.stringify({
          success: true,
          window: updatedWindow
        }));
        
      } catch (error: any) {
        console.error('[space_updateWindow] Error:', error);
        callback(JSON.stringify({
          success: false,
          error: `Failed to update window: ${error.message || 'Unknown error'}`,
          windowId,
          updates
        }));
      }
    }
  },
  {
    id: 'space_removeWindow',
    description: 'Remove/close a window from the space',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window to remove',
        required: true
      }
    ],
    handler: ({windowId, callback}: {windowId: string, callback: (text: string) => void}) => {
      try {
        const { removeWindow, windows } = useSpaceStore.getState();
        
        if (!windows[windowId]) {
          throw new Error(`Window with ID ${windowId} not found`);
        }
        
        console.log('[space_removeWindow] Removing window:', windowId);
        
        removeWindow(windowId);
        
        callback(JSON.stringify({
          success: true,
          windowId,
          message: 'Window removed successfully'
        }));
        
      } catch (error: any) {
        console.error('[space_removeWindow] Error:', error);
        callback(JSON.stringify({
          success: false,
          error: `Failed to remove window: ${error.message || 'Unknown error'}`,
          windowId
        }));
      }
    }
  },
  {
    id: 'space_listWindows',
    description: 'Get a list of all windows in the space with their details',
    parameters: [
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space to list windows for',
        required: true
      }
    ],
    handler: ({spaceId, callback}: {spaceId: string, callback: (text: string) => void}) => {
      try {
        const { windows } = useSpaceStore.getState();
        
        const windowList = Object.values(windows).map(window => ({
          id: window.id,
          type: window.type,
          appType: window.appType,
          title: window.title,
          position: window.position,
          size: window.size,
          entity: window.entity ? {
            id: window.entity.id || window.entity._id,
            name: window.entity.name,
            entityType: window.entity.entityType
          } : undefined
        }));
        
        callback(JSON.stringify({
          success: true,
          spaceId,
          windows: windowList,
          count: windowList.length
        }));
        
      } catch (error: any) {
        console.error('[space_listWindows] Error:', error);
        callback(JSON.stringify({
          success: false,
          error: `Failed to list windows: ${error.message || 'Unknown error'}`,
          spaceId
        }));
      }
    }
  },
  {
    id: 'space_focusWindow',
    description: 'Bring a window to the front and focus it',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window to focus',
        required: true
      }
    ],
    handler: ({windowId, callback}: {windowId: string, callback: (text: string) => void}) => {
      try {
        const { bringWindowToFront, windows } = useSpaceStore.getState();
        
        if (!windows[windowId]) {
          throw new Error(`Window with ID ${windowId} not found`);
        }
        
        console.log('[space_focusWindow] Focusing window:', windowId);
        
        bringWindowToFront(windowId);
        
        callback(JSON.stringify({
          success: true,
          windowId,
          message: 'Window focused successfully'
        }));
        
      } catch (error: any) {
        console.error('[space_focusWindow] Error:', error);
        callback(JSON.stringify({
          success: false,
          error: `Failed to focus window: ${error.message || 'Unknown error'}`,
          windowId
        }));
      }
    }
  }
];

// Register space commands - call this once when the space initializes
export const registerSpaceCommands = () => {
  registerCommands(spaceCommands);
  console.log('[SpaceCommands] Registered space-level commands');
}; 