import type { AppDefinition } from '../../types/apps';

export const DOCS_EVENTS = {
  CREATE_DOC: 'DOCS_CREATE',
  DELETE_DOC: 'DOCS_DELETE',
  UPDATE_DOC: 'DOCS_UPDATE',
  OPEN_DOC: 'DOCS_OPEN',
  TOGGLE_DARK_MODE: 'DOCS_TOGGLE_DARK_MODE',
} as const;

export const DocsAppDefinition: AppDefinition = {
  appId: 'docs',
  name: 'Docs',
  version: '1.0.0',
  description: 'Create and manage documents',
  events: {},
  entityTypes: ['Document'],
  component: 'DocsApp',
  requiresProps: false,
  requiresEntity: true,
  actions: {
    createDocument: {
      name: 'Create Document',
      description: 'Create a new document',
    },
    deleteDocument: {
      name: 'Delete Document',
      description: 'Delete an existing document',
    },
    editDocument: {
      name: 'Edit Document',
      description: 'Edit an existing document',
    }
  }
};