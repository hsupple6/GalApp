import type { AppDefinition } from '../../types/apps';

export const GALIDE_EVENTS = {
  CREATE_PROJECT: 'GALIDE_CREATE_PROJECT',
  DELETE_PROJECT: 'GALIDE_DELETE_PROJECT',
  UPDATE_PROJECT: 'GALIDE_UPDATE_PROJECT',
  OPEN_FILE: 'GALIDE_OPEN_FILE',
  OPEN_UI_VIEW: 'GALIDE_OPEN_UI_VIEW',
  TOGGLE_SIDEBAR: 'GALIDE_TOGGLE_SIDEBAR',
} as const;

export const GalideAppDefinition: AppDefinition = {
  appId: 'galide',
  name: 'Galide',
  version: '1.0.0',
  description: 'Advanced code editor and IDE with interactive UI capabilities',
  icon: 'code',
  events: {},
  entityTypes: ['GalideProject', 'GalideFile', 'GalideUIView'],
  component: 'GalideApp',
  requiresProps: false,
  requiresEntity: true,
  supportedFileTypes: ['*'],
  actions: {
    createProject: {
      name: 'Create Project',
      description: 'Create a new Galide project',
    },
    openFile: {
      name: 'Open File',
      description: 'Open a file in the editor',
    },
    openUIView: {
      name: 'Open UI View',
      description: 'Open an interactive UI view',
    },
    createUIView: {
      name: 'Create UI View',
      description: 'Create a new interactive UI view',
    },
    saveFile: {
      name: 'Save File',
      description: 'Save the current file',
    },
    runCode: {
      name: 'Run Code',
      description: 'Execute the current file or selected code',
    }
  }
}; 