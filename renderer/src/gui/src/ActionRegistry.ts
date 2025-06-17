import { pdfiumAppActions } from './apps/PDFiumApp/actions';
import { webDocumentActions } from './apps/WebDocumentApp/actions';
import { ActionDefinition } from './types/registry';

class ActionRegistry {
  private actions: Map<string, ActionDefinition> = new Map();
  private actionHandlers: Map<string, Record<string, Function>> = new Map();

  constructor() {
    this.registerActions(pdfiumAppActions);
    this.registerActions(webDocumentActions);
  }

  registerActions(actions: ActionDefinition[]) {
    for (const action of actions) {
      this.actions.set(action.actionId, action);
    }
  }

  registerActionHandlers(entityId: string, handlers: Record<string, Function>) {
    this.actionHandlers.set(entityId, handlers);
  }

  executeAction(entityId: string, actionId: string, args: any[]) {
    const handlers = this.actionHandlers.get(entityId);
    if (!handlers) {
      console.error(`No handlers found for entity ID: ${entityId}`);
      return;
    }

    const handler = handlers[actionId];
    if (typeof handler !== 'function') {
      console.error(`Handler for action ${actionId} not found`);
      return;
    }

    try {
      handler(...args);
    } catch (error) {
      console.error(`Error executing action ${actionId}:`, error);
    }
  }

  getActionsByEntityType(entityType: string): ActionDefinition[] {
    return Array.from(this.actions.values()).filter(
      (action) => action.requiredEntity === entityType
    );
  }

  getAllActions(): ActionDefinition[] {
    return Array.from(this.actions.values());
  }
}

export const actionRegistry = new ActionRegistry();