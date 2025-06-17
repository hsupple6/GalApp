import { ActionDefinition } from '../../types/registry';

export const webDocumentActions: ActionDefinition[] = [
  {
    actionId: 'web_document_read',
    appId: 'webdocument',
    description: 'Read content from web document',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {}
    }
  },
  {
    actionId: 'web_document_write',
    appId: 'webdocument',
    description: 'Write content to web document',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {
        content: {
          type: 'string',
          description: 'Content to write',
          required: true
        }
      }
    }
  }
]; 