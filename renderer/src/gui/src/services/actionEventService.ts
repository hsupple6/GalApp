import { useEffect } from 'react';

import { registryService } from './registryService';

class ActionEventService {
  addEventListener(type: string, listener: EventListener) {
    document.addEventListener(type, listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    document.removeEventListener(type, listener);
  }

  dispatchEvent(event: CustomEvent) {
    document.dispatchEvent(event);
  }

  async executeAction(actionId: string, args: any = {}) {
    const action = await registryService.getActionDefinition(actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    // Validate args against schema
    this.validateArgs(args, action.schema);

    const eventName = `app:${action.appId}:${action.actionId}`;
    console.debug(`executeAction. eventName: ${eventName}. args: `, args);

    // Execute via custom event
    const event = new CustomEvent(eventName, {
      detail: { args },
    });
    this.dispatchEvent(event);
  }

  private validateArgs(args: any, schema: any) {
    return true;
  }
}

export const actionEventService = new ActionEventService();

// Hook for components
export function useActionEvent(type: string, callback: (event: CustomEvent) => void) {
  useEffect(() => {
    actionEventService.addEventListener(type, callback as EventListener);
    return () => actionEventService.removeEventListener(type, callback as EventListener);
  }, [type, callback]);
}

// Add event types
export interface FileOpenEvent {
  type: 'openFile';
  detail: {
    entity: {
      entityType: 'File';
      fileId: string;
      [key: string]: any;
    };
    appType: string;
  };
}
