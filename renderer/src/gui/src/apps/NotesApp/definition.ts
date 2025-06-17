import type { AppDefinition } from '../../types/apps';

export const NOTES_EVENTS = {
  CREATE_NOTE: 'NOTES_CREATE',
  DELETE_NOTE: 'NOTES_DELETE',
  UPDATE_NOTE: 'NOTES_UPDATE',
  OPEN_NOTE: 'NOTES_OPEN',
  TOGGLE_DARK_MODE: 'NOTES_TOGGLE_DARK_MODE',
} as const;

export const NotesAppDefinition: AppDefinition = {
  appId: 'notes',
  name: 'Notes',
  version: '1.0.0',
  description: 'Create and manage notes',
  events: {},
  entityTypes: ['Note'],
  component: 'NotesApp',
  requiresProps: false,
  requiresEntity: true,
  actions: {
    createNote: {
      name: 'Create Note',
      description: 'Create a new note',
    },
    deleteNote: {
      name: 'Delete Note',
      description: 'Delete an existing note',
    },
    editNote: {
      name: 'Edit Note',
      description: 'Edit an existing note',
    }
  }
};