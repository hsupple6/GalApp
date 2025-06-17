import { AppDefinition } from '../../types/apps';
import { ActionDefinition } from '../../types/registry';

export const ENTITY_BROWSER_EVENTS = {
  FILE_OPEN: 'app:system:OPEN_FILE',
  FILE_OPEN_FROM_BROWSER: 'app:file:openFromBrowser',
  FILE_DELETE: 'app:file:delete',
  GET_FILE_LIST: 'app:system:GET_FILE_LIST',
  SHOW_FILE_LIST: 'app:system:SHOW_FILE_LIST',
  NOTE_OPEN: 'app:note:open',
  NOTE_DELETE: 'app:note:delete',
  WEB_OPEN: 'app:web:open',
  WEB_DELETE: 'app:web:delete',
  SPACE_OPEN: 'app:space:open',
  SPACE_DELETE: 'app:space:delete',
} as const;

const actions: Record<string, ActionDefinition> = {
  openFile: {
    actionId: 'openFile',
    appId: 'entityBrowser',
    description: 'Open a file in the appropriate viewer',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {
        fileId: {
          type: 'string',
          description: 'ID of the file to open',
          required: true,
        },
        appType: {
          type: 'string',
          description: 'Type of app to open the file with',
          required: true,
        },
      },
    },
    embedding: new Array(384).fill(0),
  },
  deleteEntity: {
    actionId: 'deleteEntity',
    appId: 'entityBrowser',
    description: 'Delete an entity',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {
        entityId: {
          type: 'string',
          description: 'ID of the entity to delete',
          required: true,
        },
      },
    },
    embedding: new Array(384).fill(0),
  },
};

export const EntityBrowserAppDefinition: AppDefinition = {
  appId: 'entityBrowser',
  name: 'Entity Browser',
  version: '1.0.0',
  description: 'Browse and manage all entities in the system',
  events: ENTITY_BROWSER_EVENTS,
  entityTypes: ['File', 'Note', 'WebDocument', 'Space'],
  component: 'EntityBrowserApp',
  requiresProps: false,
  requiresEntity: true, 
  actions: {
    openFile: {
      name: 'Open File',
      description: 'Open a file in the appropriate viewer',
    },
    deleteEntity: {
      name: 'Delete Entity',
      description: 'Delete an entity',
    },
  },
};
