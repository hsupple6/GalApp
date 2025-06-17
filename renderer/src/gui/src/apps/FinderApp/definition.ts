import { AppDefinition } from '../../types/apps';

export const FinderAppDefinition: AppDefinition = {
  appId: 'finder',
  name: 'Finder',
  version: '1.0.0',
  description: 'File browser for accessing system files',
  supportedFileTypes: ['*'],
  events: {},
  entityTypes: [],
  component: 'FinderApp',
  requiresProps: false,
  requiresEntity: false,
  actions: {
    open: {
      name: 'Open',
      description: 'Open the Finder app',
    },
  },
}; 