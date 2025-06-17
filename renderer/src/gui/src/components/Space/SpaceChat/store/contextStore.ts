import { create } from 'zustand';
import { useSpaceStore } from '../../../../stores/spaceStore';
import { AnyWindowEntity } from '../../../../types/windows';
import { EventEmitter } from 'events';
import { WindowContent, SpaceContext } from '../types';
import { contextUtils } from '../utils/contextUtils';
import useEntityStore from '../../../../stores/entityStore';
import { BaseEntityType } from '../../../../types';

interface PastedContext {
  text: string;
  source: {
    window: AnyWindowEntity;
    type: string;
    metadata: {
      docId: string;
      nodeRange?: {
        startLine: number;
        endLine: number;
      };
    };
  };
}

interface ContextStore {
  context: SpaceContext;
  setActiveSpace: (spaceId: string) => void;
  removeWindowContent: (windowId: string) => void;
  setWindowContent: (windowId: string, update: Partial<WindowContent>) => void;
  addWindowToContext: (windowId: string) => void;

  cleanup?: () => void;
  dispose: () => void;
  
  // Pasted context methods
  pastedContext: PastedContext | null;
  setPastedContext: (context: PastedContext | null) => void;
  getPastedContext: () => PastedContext | null;

  setContext: (newContext: SpaceContext) => void;
}

// Create a singleton event emitter instance
const contextEventEmitter = new EventEmitter();

export const useContextStore = create<ContextStore>((set, get) => {
  // Only subscribe to track active window changes, not to auto-add all windows
  useSpaceStore.subscribe((state, prevState) => {
    // Only update the isActive flag for existing context windows when activeWindowId changes
    if (state.activeWindowId !== prevState?.activeWindowId) {
      const currentContext = get().context;
      const updatedWindowContents = { ...currentContext.windowContents };
      let hasChanges = false;
      
      // Update isActive flag for all context windows
      Object.keys(updatedWindowContents).forEach(windowId => {
        const wasActive = updatedWindowContents[windowId].isActive;
        const shouldBeActive = state.activeWindowId === windowId;
        
        if (wasActive !== shouldBeActive) {
          updatedWindowContents[windowId] = {
            ...updatedWindowContents[windowId],
            isActive: shouldBeActive
          };
          hasChanges = true;
        }
      });
      
      // Only update if there were actual changes
      if (hasChanges) {
        set((currentState) => ({
          context: {
            ...currentState.context,
            windowContents: updatedWindowContents
          }
        }));
      }
    }
    
    // Update space ID if it changes
    if (state.activeSpace && state.activeSpace.id !== get().context.spaceId) {
      get().setActiveSpace(state.activeSpace.id);
    }
  });

  return {
    context: {
      spaceId: '',
      windowContents: {},
    },
    pastedContext: null,

    setActiveSpace: (spaceId: string) => {
      set((state) => {
        const { [spaceId]: _, ...rest } = state.context.windowContents;
        return { context: { spaceId, windowContents: rest } };
      });
    },

    removeWindowContent: (windowId: string) => {
      set((state) => {
        const { [windowId]: _, ...rest } = state.context.windowContents;
        return { context: { ...state.context, windowContents: rest } };
      });
    },

    setWindowContent: (windowId: string, update: Partial<WindowContent>) => {
      const currentContent = get().context.windowContents[windowId] || {};
      const newContent = {
        ...currentContent,
        ...update,
      } as WindowContent;

      set((state) => {
        return {
          context: {
            ...state.context,
            windowContents: {
              ...state.context.windowContents,
              [windowId]: newContent,
            },
          },
        };
      });
    },

    // Pasted context methods
    setPastedContext: (context: PastedContext | null) => {
      set({ pastedContext: context });
      contextEventEmitter.emit('pastedContextChange', context);
    },

    getPastedContext: () => {
      return get().pastedContext;
    },

    dispose: () => {
      contextEventEmitter.removeAllListeners();
    },

    // Add a window or entity to context
    addWindowToContext: (windowId: string) => {
      const { windows } = useSpaceStore.getState();
      const { entities } = useEntityStore.getState();
      
      // First check if this is a window
      if (windows[windowId]) {
        const window = windows[windowId];
        
        // Create window content for this window
        const windowContent = contextUtils.createWindowContent(window);
        if (!windowContent) {
          return;
        }
        
        // If this is a PDF window, make sure the entityId is set correctly from applicationState
        if (window.appType === 'pdfium' && window.applicationState?.pdfium?.entityId) {
          if (windowContent.appType === 'PDF') {
            (windowContent as any).entityId = window.applicationState.pdfium.entityId;
          }
        }
        
        // If this is the active window, mark it as active
        if (useSpaceStore.getState().activeWindowId === windowId) {
          windowContent.isActive = true;
        }
        
        // Add to context
        set((state) => ({
          context: {
            ...state.context,
            windowContents: {
              ...state.context.windowContents,
              [windowId]: windowContent
            }
          }
        }));
        
        return;
      }
      
      // If it's not a window, check if it's an entity
      const entity = entities.find(e => e.id === windowId || e._id === windowId);
      if (entity) {
        
        // Create a pseudo-window from the entity to create content
        const pseudoWindow: AnyWindowEntity = {
          id: entity.id,
          type: 'window',
          title: entity.name,
          position: { x: 0, y: 0 },
          size: { width: 0, height: 0 },
          appType: entity.entityType.toLowerCase(),
          entity: entity
        };
        
        // Create window content from pseudo-window
        const windowContent = contextUtils.createWindowContent(pseudoWindow);
        if (!windowContent) {
          return;
        }
        
        // Add to context
        set((state) => ({
          context: {
            ...state.context,
            windowContents: {
              ...state.context.windowContents,
              [windowId]: windowContent
            }
          }
        }));
        
        return;
      }
      
    },

    setContext: (newContext: SpaceContext) => {
      set({ context: newContext });
    },
  };
});
