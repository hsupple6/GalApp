import { EventEmitter } from 'events';

import type { BaseEntityType } from '../types/entities';
import type { AnyWindowEntity } from '../types/windows';
import { actionEventService } from './actionEventService';
import { registryService } from './registryService';
import { API_BASE_URL } from '../api/config';

export interface EntityMetadata {
  type: string;
  capabilities: string[];
  actions: string[];
  relationships?: {
    [key: string]: string[];
  };
  schema?: Record<string, any>;
}

export interface AIAction {
  type: string;
  args: Record<string, any>;
  description?: string;
}

export interface AIEvent {
  type: string;
  entity?: BaseEntityType;
  window?: AnyWindowEntity;
  data?: any;
  timestamp: number;
  context?: {
    selection?: string;
    activeWindow?: string;
    relatedEntities?: string[];
  };
}

interface QueryContext {
  activeWindow?: AnyWindowEntity;
  selectedWindows: AnyWindowEntity[];
  selection?: string;
}

export class AIService {
  private eventBus: EventEmitter;
  private entityRegistry: Map<string, EntityMetadata>;
  private contextHistory: AIEvent[] = [];
  private maxHistoryLength = 100;

  constructor() {
    this.eventBus = new EventEmitter();
    this.entityRegistry = new Map();
  }

  public registerEntity(type: string, metadata: EntityMetadata) {
    this.entityRegistry.set(type, metadata);
  }

  public async executeAction(action: AIAction): Promise<void> {
    return actionEventService.executeAction(action.type, action.args);
  }

  public async processUserQuery(query: string, context: QueryContext): Promise<AIAction[]> {
    const response = await fetch(`${API_BASE_URL}/ai/process-create-mode-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('authToken')}`,
      },
      body: JSON.stringify({
        query,
        context: {
          activeWindow: context.activeWindow,
          selectedWindows: context.selectedWindows,
          selection: context.selection,
          availableActions: registryService.getRegistryState().actions,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to process query');
    }

    const plan = await response.json();
    return plan.actions;
  }

  public recordEvent(event: AIEvent) {
    this.contextHistory.push(event);
    if (this.contextHistory.length > this.maxHistoryLength) {
      this.contextHistory.shift();
    }
    this.eventBus.emit('aiEvent', event);
  }

  public getContextForEntity(entityId: string): AIEvent[] {
    return this.contextHistory.filter(
      (event) =>
        event.entity?._id === entityId ||
        event.window?.id === entityId ||
        event.context?.relatedEntities?.includes(entityId),
    );
  }
}

export const aiService = new AIService();
