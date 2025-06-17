import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

import { entityBrowserCRDTService } from '../../services/crdt/entityBrowserAppCRDTService';
import type { BaseEntityType } from '../../types/entities';
import useEntityStore from '../entityStore';
import { logger } from '../../utils/logger';

interface EntityBrowserEvent {
  id: string;
  timestamp: number;
  userId: string;
  action: 'select' | 'expand' | 'collapse' | 'change_view' | 'change_sort';
  data?: any;
}

interface EntityBrowserState {
  windowId: string;
  spaceId: string;
  selectedEntityIds: Set<string>;
  expandedGroups: Set<string>;
  viewMode: 'list' | 'grid';
  sortBy: 'name' | 'date' | 'type';
  status: 'idle' | 'loading' | 'error';
  error?: Error;
  events: EntityBrowserEvent[];
  initialized: boolean;
  cleanupFn?: () => void;
}

interface EntityBrowserStore extends EntityBrowserState {
  // UI Actions
  selectEntity: (id: string) => void;
  toggleGroup: (groupId: string) => void;
  setViewMode: (mode: 'list' | 'grid') => void;
  setSortBy: (sort: 'name' | 'date' | 'type') => void;

  // Lifecycle
  initialize: (windowId: string, spaceId: string) => Promise<void>;
  cleanup: () => void;

  // Event handling
  logEvent: (event: Omit<EntityBrowserEvent, 'id' | 'timestamp'>) => void;
}

// Helper function to check if entity exists in tree
const findEntityInTree = (entities: BaseEntityType[], targetId: string): boolean => {
  return entities.some(entity => {
    if (entity._id === targetId) return true;
    if (entity.children) {
      return findEntityInTree(entity.children, targetId);
    }
    return false;
  });
};

// Store factory pattern
export const createEntityBrowserStore = (windowId: string, spaceId: string) => {
  return create(
    subscribeWithSelector<EntityBrowserStore>((set, get) => ({
    // State
    windowId,
    spaceId,
    selectedEntityIds: new Set<string>(),
    expandedGroups: new Set<string>(),
    viewMode: 'list',
    sortBy: 'name',
    status: 'idle',
    events: [],
    initialized: false,

    // UI Actions with CRDT sync
    selectEntity: (id: string) => {
      // Check if entity exists in entityStore (including nested entities)
      const entityExists = findEntityInTree(
        useEntityStore.getState().entities,
        id
      );

      if (!entityExists) {
        logger.warn('[EntityBrowserStore] Attempted to select non-existent entity:', id);
        return;
      }

      logger.log('[EntityBrowserStore] Selecting entity:', {
        id,
        currentSelection: Array.from(get().selectedEntityIds),
      });

      // Log event
      get().logEvent({
        userId: 'current-user',
        action: 'select',
        data: { entityId: id }
      });

      // Update CRDT
      entityBrowserCRDTService.updateSelection(
        get().windowId,
        get().spaceId,
        id
      );

      // Update local state
      set(state => {
        const newSelection = new Set([id]);
        logger.log('[EntityBrowserStore] Updated selection:', {
          id,
          newSelection: Array.from(newSelection)
        });
        return { selectedEntityIds: newSelection };
      });
    },

    toggleGroup: (groupId: string) => {
      const isExpanded = get().expandedGroups.has(groupId);
      logger.log('[EntityBrowserStore] Toggling group:', {
        groupId,
        wasExpanded: isExpanded,
        currentGroups: Array.from(get().expandedGroups)
      });
      
      get().logEvent({
        userId: 'current-user',
        action: isExpanded ? 'collapse' : 'expand',
        data: { groupId }
      });

      // Update CRDT
      entityBrowserCRDTService.updateExpandedGroups(
        get().windowId,
        get().spaceId,
        groupId,
        !isExpanded
      );

      // Also update local state immediately for responsiveness
      set(state => {
        const newExpandedGroups = new Set(state.expandedGroups);
        if (isExpanded) {
          newExpandedGroups.delete(groupId);
        } else {
          newExpandedGroups.add(groupId);
        }
        return { expandedGroups: newExpandedGroups };
      });
    },

    setViewMode: (mode: 'list' | 'grid') => {
      // Log event
      get().logEvent({
        userId: 'current-user',
        action: 'change_view',
        data: { mode }
      });

      // Update CRDT
      entityBrowserCRDTService.updateViewMode(
        get().windowId,
        get().spaceId,
        mode
      );

      // Update local state
      set({ viewMode: mode });
    },

    setSortBy: (sort: 'name' | 'date' | 'type') => {
      // Log event
      get().logEvent({
        userId: 'current-user',
        action: 'change_sort',
        data: { sort }
      });

      // Update CRDT
      entityBrowserCRDTService.updateSortBy(
        get().windowId,
        get().spaceId,
        sort
      );

      // Update local state
      set({ sortBy: sort });
    },

    // Initialization with CRDT
    initialize: async (windowId: string, spaceId: string) => {
      logger.log('[EntityBrowserStore] Initializing:', {
        windowId,
        spaceId,
        currentState: get()
      });
      set({ status: 'loading' });
      
      try {
        const cleanupFn = await entityBrowserCRDTService.observeBrowser(
          windowId,
          spaceId,
          (updates) => {
            logger.log('[EntityBrowserStore] Received CRDT update:', updates);
            set(state => {
              // Convert arrays to Sets
              const selectedIds = new Set(updates.selectedEntityIds || []);
              const expandedGroups = new Set(updates.expandedGroups || []); // Convert array to Set

              // Clear selection if selected entity was deleted
              if (selectedIds.size > 0) {
                const entityExists = Array.from(selectedIds).every(id => 
                  findEntityInTree(useEntityStore.getState().entities, id)
                );
                if (!entityExists) {
                  selectedIds.clear();
                }
              }

              return {
                ...state,
                selectedEntityIds: selectedIds,
                expandedGroups: expandedGroups, // Use the new Set
                viewMode: updates.viewMode || state.viewMode,
                sortBy: updates.sortBy || state.sortBy,
                status: 'idle'
              };
            });
          }
        );

        // Update to use simple subscribe instead of selector-based subscription
        const unsubscribeFromEntityStore = useEntityStore.subscribe((state) => {
          const entities = state.entities;
          // Clear selection and expanded state for deleted entities
          set(state => {
            const newSelectedIds = new Set(state.selectedEntityIds);
            const newExpandedGroups = new Set(state.expandedGroups);
            
            // Remove deleted entities from selection
            Array.from(newSelectedIds).forEach(id => {
              if (!findEntityInTree(entities, id)) {
                newSelectedIds.delete(id);
              }
            });
            
            // Remove deleted entities from expanded groups
            Array.from(newExpandedGroups).forEach(id => {
              if (!findEntityInTree(entities, id)) {
                newExpandedGroups.delete(id);
              }
            });
            
            return {
              ...state,
              selectedEntityIds: newSelectedIds,
              expandedGroups: newExpandedGroups
            };
          });
        });

        logger.log('[EntityBrowserStore] CRDT connection established');
        set({
          initialized: true,
          cleanupFn: () => {
            cleanupFn();
            unsubscribeFromEntityStore();
          },
          status: 'idle'
        });

      } catch (error) {
        logger.error('[EntityBrowserStore] Initialization failed:', error);
        set({ 
          status: 'error',
          error: error as Error 
        });
        throw error;
      }

      set(state => {
        logger.log('[EntityBrowserStore] Setting state:', {
          expandedGroups: Array.from(state.expandedGroups),
          selectedIds: Array.from(state.selectedEntityIds)
        });
        return state;
      });
    },

    cleanup: () => {
      const state = get();
      if (state.cleanupFn) {
        state.cleanupFn();
        set({ 
          initialized: false,
          cleanupFn: undefined
        });
      }
    },

    logEvent: (eventData) => {
      const event: EntityBrowserEvent = {
        ...eventData,
        id: uuidv4(),
        timestamp: Date.now()
      };

      set(state => ({
        events: [...state.events, event]
      }));
    }
  }))
  );
};

// Store instance registry
export const entityBrowserAppStores = new Map<string, ReturnType<typeof createEntityBrowserStore>>();

export const getEntityBrowserStore = (windowId: string, spaceId: string) => {
  const key = `${spaceId}:${windowId}`;
  if (!entityBrowserAppStores.has(key)) {
    entityBrowserAppStores.set(key, createEntityBrowserStore(windowId, spaceId));
  }
  return entityBrowserAppStores.get(key)!;
};

export const cleanupBrowserStore = (windowId: string, spaceId: string) => {
  const key = `${spaceId}:${windowId}`;
  const store = entityBrowserAppStores.get(key);
  if (store) {
    store.getState().cleanup();
    entityBrowserAppStores.delete(key);
  }
}; 