import { AppDefinition } from '../../types/apps';

export const SETTINGS_EVENTS = {
} as const;

export const SettingsAppDefinition: AppDefinition = {
  appId: 'settings',
  name: 'Settings',
  icon: '⚙️',
  version: '1.0.0',
  description: 'Manage your system and account settings',
  supportedFileTypes: [],
  events: SETTINGS_EVENTS,
  entityTypes: [],
  component: 'SettingsApp',
  requiresProps: false,
  requiresEntity: false,
  actions: {},
};
