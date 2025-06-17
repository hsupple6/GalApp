// types/apps.ts
import { BaseEntityType } from './entities';
import { ActionMetadata } from './registry';

interface AppSkeleton {
  id: string;
  name: string;
  version: string;
  description: string;
  events: Record<string, string>;
  supportedFileTypes?: string[];
}

// Base interface for all actions
export interface BaseAction {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

// App-specific action definition
export interface AppAction extends BaseAction {
  actionId: string;
  appId: string;
  category?: string;
  lastUpdated?: string;
}

export interface AppDefinition {
  appId: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  events: Record<string, any>;
  entityTypes: string[];
  component: string;
  requiresProps: boolean;
  requiresEntity: boolean;
  actions: Record<string, BaseAction>;
  supportedFileTypes?: string[];
}

// Add MongoDB types
export interface MongoDocument {
  _id: string;
  entityType: string;
  created_at: string;
  updated_at: string;
}

// Update StoredAppDefinition to extend MongoDocument
export interface StoredAppDefinition extends MongoDocument {
  entityType: 'App';
  skeleton: AppDefinition;
}

// Helper function to convert BaseAction to ActionMetadata
export function convertToActionMetadata(action: BaseAction, appId: string): ActionMetadata {
  return {
    ...action,
    actionId: `${appId}.${action.name}`,
    appId,
    category: 'app',
    lastUpdated: new Date().toISOString()
  };
}
