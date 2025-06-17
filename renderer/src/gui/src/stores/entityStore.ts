import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

import { entityCRDTService, EntityUpdate } from '../services/crdt/entityCRDTService';
import { spaceCRDTService, SpaceUpdate } from '../services/crdt/spaceCRDTService';
import { entityService } from '../services/entityService';
import { fileService } from '../services/FileService';
import { BaseEntityType } from '../types';
import { AnyWindowEntity } from '../types/windows';

interface EntityEvent {
  id: string;
  timestamp: number;
  userId: string;
  action: 'create' | 'update' | 'delete';
  entityId: string;
  data?: BaseEntityType;
  previousData?: BaseEntityType;
}

export interface EntityState {
  entities: BaseEntityType[];
  authToken: string | null;
  status: 'idle' | 'loading' | 'error';
  error?: Error;
  events: EntityEvent[];
  undoStack: EntityEvent[];
  redoStack: EntityEvent[];
  initialized: boolean;
  currentSpaceId?: string;
}

export interface EntityStore extends EntityState {
  setAuthToken: (token: string | null) => void;
  addEntity: (entity: BaseEntityType, parentId?: string) => void;
  deleteEntity: (id: string) => void;
  initialize: (spaceId: string) => Promise<void>;
  performDelete: (id: string) => Promise<void>;
  updateEntity: (entity: BaseEntityType) => void;
  setEntities: (entities: BaseEntityType[]) => void;
  fetchEntities: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  logEvent: (event: Omit<EntityEvent, 'id' | 'timestamp'>) => void;
  cleanup: () => void;
  cleanupFn?: () => void;
  removeEntity: (entityId: string) => void;
  onSpaceUpdate: (spaceId: string, update: SpaceUpdate) => void;
}

interface SystemGroup extends BaseEntityType {
  isSystemGroup: true;
  children: BaseEntityType[];
  skeleton: {
    '@type': 'Group';
    childEntities: string[];
  };
}

// Add this to help debug
let _debugSpaceCRDTCleanup: (() => void) | null = null;

const useEntityStore = create<EntityStore>((set, get) => ({
  entities: [],
  authToken: localStorage.getItem('authToken'),
  status: 'idle',
  events: [],
  undoStack: [],
  redoStack: [],
  initialized: false,
  currentSpaceId: undefined,

  initialize: async (spaceId: string) => {
    const currentState = get();

    // Don't reinitialize if already initialized for this space
    if (currentState.initialized && currentState.currentSpaceId === spaceId) {
      return;
    }

    // Clean up previous if needed
    if (currentState.cleanupFn) {
      currentState.cleanupFn();
    }

    set({ status: 'loading' });
    try {
      console.log('[EntityStore] Fetching entities:', spaceId);
      const fetchedEntities = await entityService.getEntities(spaceId);

      const entities = fetchedEntities.map(
        (e) =>
          ({
            ...e,
            created_at: e.created_at || new Date().toISOString(),
            updated_at: e.updated_at || new Date().toISOString(),
            type: e.type || e.entityType,
            entityType: e.entityType || e.type,
          }) as BaseEntityType,
      );

      // Set up CRDT observer
      const cleanupCRDT = entityCRDTService.observeEntities((update: EntityUpdate) => {
        set((state) => {
          const newEntities = [...state.entities];
          let hasChanges = false;

          if (update.type === 'add' || update.type === 'update') {
            if (update.entity) {
              const existingEntity = newEntities.find((e) => e._id === update.id);

              const id = update.entity._id || uuidv4();
              const entityWithRequiredFields: BaseEntityType = {
                ...update.entity,
                _id: id,
                id,
                created_at: update.entity.created_at || new Date().toISOString(),
                updated_at: update.entity.updated_at || new Date().toISOString(),
                type: update.entity.type || update.entity.entityType,
                entityType: update.entity.entityType || update.entity.type,
                name: update.entity.entityType === 'File' 
                  ? (update.entity.skeleton?.fileName || update.entity.name || 'UntitledENITTYSTORE')
                  : (update.entity.name || 'UntitledENITTYSTORE'),
                skeleton: {
                  '@type': update.entity.entityType,
                  ...(existingEntity?.entityType === 'Space' ? existingEntity.skeleton : {}),
                  ...update.entity.skeleton,
                },
              };
              hasChanges = true;
              const index = newEntities.findIndex((e) => e._id === update.id);
              if (index >= 0) {
                newEntities[index] = entityWithRequiredFields;
              } else {
                newEntities.push(entityWithRequiredFields);
              }
            }
          }

          if (hasChanges) {
            return {
              entities: buildEntityHierarchy(newEntities),
              status: 'idle',
            };
          }
          return state;
        });
      });

      // Add Space CRDT observer
      let cleanupSpaceCRDT: (() => void) | null = null;
      if (spaceId !== 'default') {
        cleanupSpaceCRDT = spaceCRDTService.onSpaceUpdate(spaceId, (update) => {
          if (update.windows) {
            set((state) => {
              const spaceEntity = state.entities.find((e) => e.entityType === 'Space' && e._id === spaceId);

              if (isEqual(spaceEntity?.skeleton?.windows, update.windows)) {
                return state;
              }

              const newEntities = state.entities.map((entity) => {
                if (entity.entityType === 'Space' && entity._id === spaceId) {
                  return {
                    ...entity,
                    skeleton: {
                      ...entity.skeleton,
                      windows: update.windows,
                    },
                  };
                }
                return entity;
              });

              return { entities: newEntities };
            });
          }
        });
      }

      _debugSpaceCRDTCleanup = cleanupSpaceCRDT;

      set({
        entities: buildEntityHierarchy(entities),
        status: 'idle',
        cleanupFn: () => {
          cleanupCRDT();
          if (cleanupSpaceCRDT) {
            cleanupSpaceCRDT();
          }
          _debugSpaceCRDTCleanup = null;
        },
        currentSpaceId: spaceId,
        initialized: true,
      });
    } catch (error) {
      set({
        status: 'error',
        error: error as Error,
        initialized: false,
        cleanupFn: undefined,
      });
      throw error;
    }
  },

  addEntity: (entity: BaseEntityType, parentId?: string) => {
    entityCRDTService.updateEntity(entity._id, entity);

    set((state) => {
      const newEntities = [...state.entities, entity];
      return {
        entities: buildEntityHierarchy(newEntities),
      };
    });
  },

  deleteEntity: (id) => {
    const entityToDelete = get().entities.find((e) => e._id === id);

    // Log the event first
    get().logEvent({
      userId: 'current-user', // TODO: Get actual user ID
      action: 'delete',
      entityId: id,
      previousData: entityToDelete,
    });

    // Delete from CRDT
    entityCRDTService.deleteEntity(id);

    // Update local state
    set((state) => {
      // Create new array without the deleted entity
      const filteredEntities = state.entities.filter((e) => e._id !== id);

      // Also remove the entity from any group's children
      const updatedEntities = filteredEntities.map((entity) => {
        if (entity.children) {
          return {
            ...entity,
            children: entity.children.filter((child) => child._id !== id),
          };
        }
        return entity;
      });

      return { entities: updatedEntities };
    });
  },

  updateEntity: (entity) => {
    const previousEntity = get().entities.find((e) => e._id === entity._id);

    // Log the event first
    get().logEvent({
      userId: 'current-user', // TODO: Get actual user ID
      action: 'update',
      entityId: entity._id,
      data: entity,
      previousData: previousEntity,
    });

    // Update CRDT
    entityCRDTService.updateEntity(entity._id, entity);

    // Update local state
    set((state) => ({
      entities: state.entities.map((e) => (e._id === entity._id ? entity : e)),
    }));
  },

  removeEntity: (entityId: string) => {
    set((state) => {
      // Helper to remove entity from tree
      const removeFromTree = (entities: BaseEntityType[]): BaseEntityType[] => {
        return entities.filter((e) => {
          if (e._id === entityId) return false;
          if (e.children) {
            e.children = removeFromTree(e.children);
          }
          return true;
        });
      };

      return {
        entities: removeFromTree(state.entities),
      };
    });
  },

  cleanup: () => {
    const state = get();
    if (state.cleanupFn) {
      state.cleanupFn();
      set({
        initialized: false,
        cleanupFn: undefined,
      });
    }
  },

  setAuthToken: (token: string | null) => {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
    set({ authToken: token });
  },

  setEntities: (entities: BaseEntityType[]) => {
    set({ entities: buildEntityHierarchy(entities) });
  },

  fetchEntities: async () => {
    set({ status: 'loading' });

    try {
      const spaceId = get().currentSpaceId;
      if (!spaceId) {
        throw new Error('No space ID set');
      }

      const fetchedEntities = await fileService.getList(spaceId);

      // Update CRDT
      fetchedEntities.forEach((entity) => {
        entityCRDTService.updateEntity(entity._id, entity);
      });

      // Update local state
      set({
        entities: buildEntityHierarchy(fetchedEntities),
        status: 'idle',
      });
    } catch (error) {
      set({ status: 'error', error: error as Error });
      throw error;
    }
  },

  performDelete: async (id: string) => {
    try {
      // Immediately update local state for responsive UI
      get().deleteEntity(id);

      // Then try backend and CRDT updates in parallel
      try {
        const [backendResult] = await Promise.all([entityService.deleteEntity(id), entityCRDTService.deleteEntity(id)]);

        if (!backendResult) {
          // Entity might already be deleted
        }
      } catch (error) {
        // Fetch fresh entities to restore state
        await get().fetchEntities();
        throw error;
      }
    } catch (error) {
      throw error;
    }
  },

  logEvent: (eventData) => {
    const event: EntityEvent = {
      ...eventData,
      id: uuidv4(),
      timestamp: Date.now(),
    };

    set((state) => ({
      events: [...state.events, event],
      undoStack: [...state.undoStack, event],
      redoStack: [], // Clear redo stack when new event occurs
    }));
  },

  undo: () => {
    const state = get();
    const lastEvent = state.undoStack[state.undoStack.length - 1];

    if (!lastEvent) return;

    // Remove from undo stack and add to redo stack
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, lastEvent],
    }));

    // Reverse the action
    switch (lastEvent.action) {
      case 'create':
        get().deleteEntity(lastEvent.entityId);
        break;
      case 'update':
        if (lastEvent.previousData) {
          get().updateEntity(lastEvent.previousData);
        }
        break;
      case 'delete':
        if (lastEvent.previousData) {
          get().addEntity(lastEvent.previousData);
        }
        break;
    }
  },

  redo: () => {
    const state = get();
    const lastRedoEvent = state.redoStack[state.redoStack.length - 1];

    if (!lastRedoEvent) return;

    // Remove from redo stack and add to undo stack
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, lastRedoEvent],
    }));

    // Replay the action
    switch (lastRedoEvent.action) {
      case 'create':
        if (lastRedoEvent.data) {
          get().addEntity(lastRedoEvent.data);
        }
        break;
      case 'update':
        if (lastRedoEvent.data) {
          get().updateEntity(lastRedoEvent.data);
        }
        break;
      case 'delete':
        get().deleteEntity(lastRedoEvent.entityId);
        break;
    }
  },

  // Debounce the space update handler
  onSpaceUpdate: debounce((spaceId: string, update: SpaceUpdate) => {
    if (update.windows) {
      set((state) => {
        const newEntities = state.entities.map((entity) => {
          if (entity.entityType === 'Space' && entity._id === spaceId) {
            return {
              ...entity,
              skeleton: {
                ...entity.skeleton,
                windows: update.windows,
              },
            };
          }
          return entity;
        });

        return { entities: buildEntityHierarchy(newEntities) };
      });
    }
  }, 100),
}));

const buildEntityHierarchy = (entities: BaseEntityType[]): BaseEntityType[] => {
  const entityMap = new Map(entities.map((e) => [e._id, { ...e, children: [] as BaseEntityType[] }]));
  const rootEntities: BaseEntityType[] = [];

  entities.forEach((entity) => {
    const processedEntity = entityMap.get(entity._id)!;

    if (entity.entityType === 'Group') {
      const childIds = entity.skeleton?.childEntities || [];
      processedEntity.children = childIds
        .map((id: string) => entityMap.get(id))
        .filter((e: BaseEntityType | undefined): e is BaseEntityType => !!e);
    }

    if (!entity.skeleton?.groupIds?.length) {
      rootEntities.push(processedEntity);
    }
  });

  return rootEntities;
};

export const getEntityStore = () => {
  const entityStore = useEntityStore.getState();
  return entityStore;
}

export default useEntityStore;
