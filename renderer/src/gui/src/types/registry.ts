export interface ActionRegistryEntity {
  entityType: 'Registry';
  userId: string;
  created_at: string;
  updated_at: string;
  skeleton: {
    id: string;
    name: string;
    version: string;
    description: string;
    actions: Record<string, ActionMetadata>;
  };
}

// Lightweight metadata stored in MongoDB
export interface ActionMetadata {
  actionId: string;
  appId: string;
  userId?: string;
  description: string;
  category: 'system' | 'app';
  lastUpdated: string;
}

// Full action definition stored in Elasticsearch
export interface ActionDefinition extends ActionMetadata {
  requiredEntity?: string;
  schema: {
    args: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
  };
  permissions?: string[];
  embedding?: number[];
}