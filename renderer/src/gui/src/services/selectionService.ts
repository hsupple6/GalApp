import { EventEmitter } from 'events';

import type { SpaceSelection } from '../types/selection';
import type { AnyWindowEntity } from '../types/windows';

export class SelectionService {
  private eventBus: EventEmitter;
  private currentSelection: SpaceSelection | null = null;
  private cleanup?: () => void;

  constructor() {
    this.eventBus = new EventEmitter();
  }

  initialize(spaceId: string) {
    // Clean up existing listener first
    if (this.cleanup) {
      // console.log('🔕 SelectionService: Cleaning up existing listener');
      this.cleanup();
    }

    // console.log('👂 SelectionService: Adding selectionChange listener');
    // Set up new listener
    this.cleanup = this.onSelectionChange((selection: SpaceSelection | null) => {
      // ... existing code ...
    });
  }

  dispose() {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = undefined;
    }
  }

  public setSelection(selection: SpaceSelection | null) {
    // console.log('🔔 SelectionService.setSelection:', selection);
    this.currentSelection = selection;
    // console.log('📢 Emitting selectionChange event');
    this.eventBus.emit('selectionChange', selection);
  }

  public getCurrentSelection() {
    return this.currentSelection;
  }

  public onSelectionChange(callback: (selection: SpaceSelection | null) => void) {
    // console.log('👂 SelectionService: Adding selectionChange listener');
    this.eventBus.on('selectionChange', callback);
    return () => {
      // console.log('🔕 SelectionService: Removing selectionChange listener');
      this.eventBus.off('selectionChange', callback);
    };
  }

  // Helper to create standard DOM selection handler
  public createDOMSelectionHandler(window: AnyWindowEntity, type: string) {
    return () => {
      const selection = document.getSelection();
      if (!selection || !selection.toString().trim()) {
        return;
      }

      this.setSelection({
        text: selection.toString(),
        source: {
          window,
          type,
        }
      });
    };
  }
}

export const selectionService = new SelectionService(); 