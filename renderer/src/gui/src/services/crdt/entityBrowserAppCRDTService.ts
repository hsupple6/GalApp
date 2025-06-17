import { entityBrowserAppStores } from '../../stores/apps/entityBrowserAppStore';
import { CRDTService, crdtService } from './crdtService';
import { logger } from '../../utils/logger';

interface EntityBrowserUpdate {
  selectedEntityIds?: Set<string>;
  expandedGroups?: Set<string>;
  viewMode?: 'list' | 'grid';
  sortBy?: 'name' | 'date' | 'type';
}

export class EntityBrowserCRDTService {
  constructor(private crdt: CRDTService) {}

  private getKey(windowId: string, spaceId: string) {
    return `entity-browser:${spaceId}:${windowId}`;
  }

  observeBrowser(
    windowId: string, 
    spaceId: string, 
    onUpdate: (update: EntityBrowserUpdate) => void
  ) {
    const key = this.getKey(windowId, spaceId);
    logger.log('[EntityBrowserCRDT] Setting up observer:', {
      windowId,
      spaceId,
      key
    });
    
    return this.crdt.connect<EntityBrowserUpdate>(key, (update) => {
      logger.log('[EntityBrowserCRDT] Received update:', {
        key,
        update: update.data
      });
      if (update.data) {
        onUpdate(update.data);
      }
    });
  }

  updateSelection(windowId: string, spaceId: string, entityId: string) {
    const key = this.getKey(windowId, spaceId);
    logger.log('[EntityBrowserCRDT] Updating selection:', {
      key,
      entityId,
      timestamp: Date.now()
    });
    
    this.crdt.update(key, {
      selectedEntityIds: Array.from(new Set([entityId]))
    });
  }

  updateExpandedGroups(windowId: string, spaceId: string, groupId: string, isExpanded: boolean) {
    const key = this.getKey(windowId, spaceId);
    logger.log('[EntityBrowserCRDT] Updating expanded groups:', {
      key,
      groupId,
      isExpanded,
      timestamp: Date.now()
    });
    
    // Get current expanded groups and update
    const store = entityBrowserAppStores.get(`${spaceId}:${windowId}`);
    const currentExpanded = store?.getState().expandedGroups || new Set();
    
    // Create new Set with updated state
    const newExpanded = new Set(currentExpanded);
    if (isExpanded) {
      newExpanded.add(groupId);
    } else {
      newExpanded.delete(groupId);
    }
    
    // Send full expanded groups state
    this.crdt.update(key, {
      expandedGroups: Array.from(newExpanded)  // Convert to array for serialization
    });
  }

  updateViewMode(windowId: string, spaceId: string, mode: 'list' | 'grid') {
    const key = this.getKey(windowId, spaceId);
    logger.log('[EntityBrowserCRDT] Updating view mode:', {
      key,
      mode,
      timestamp: Date.now()
    });
    
    this.crdt.update(key, {
      viewMode: mode
    });
  }

  updateSortBy(windowId: string, spaceId: string, sort: 'name' | 'date' | 'type') {
    const key = this.getKey(windowId, spaceId);
    logger.log('[EntityBrowserCRDT] Updating sort:', {
      key,
      sort,
      timestamp: Date.now()
    });
    
    this.crdt.update(key, {
      sortBy: sort
    });
  }

  private convertUpdate(update: any): EntityBrowserUpdate {
    logger.log('[EntityBrowserCRDT] Converting update:', {
      before: update,
      selectedIdsType: update.selectedEntityIds ? Array.isArray(update.selectedEntityIds) ? 'array' : 'other' : 'undefined',
      expandedGroupsType: update.expandedGroups ? Array.isArray(update.expandedGroups) ? 'array' : 'other' : 'undefined'
    });

    const converted = {
      ...update,
      selectedEntityIds: update.selectedEntityIds ? new Set(update.selectedEntityIds) : undefined,
      expandedGroups: update.expandedGroups ? new Set(update.expandedGroups) : undefined,
    };

    logger.log('[EntityBrowserCRDT] Converted update:', converted);
    return converted;
  }
}

export const entityBrowserCRDTService = new EntityBrowserCRDTService(crdtService); 