export interface ActionDefinition {
  appId: string;
  requiredEntity: string;
  description: string;
  parameters: string[];
}

export interface ActionInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  optional?: boolean;
}

export interface ActionOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
} 