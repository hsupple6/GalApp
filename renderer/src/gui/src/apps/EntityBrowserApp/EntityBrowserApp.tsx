import './EntityBrowserApp.scss';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';

import OpenFileAction from '../../components/Space/actions/OpenFileAction';
import {
  getAppTypeByEntity,
  getEntityDisplayIcon,
  getEntityDisplayName,
} from '../../components/Space/utils/windowUtils';
import { dispatchCustomEvent } from '../../services/actionService';
import { getEntityBrowserStore } from '../../stores/apps/entityBrowserAppStore';
import useEntityStore, { EntityStore } from '../../stores/entityStore';
import type { AppleNoteType, FileType } from '../../types';
import type { BaseEntityType } from '../../types/entities';
import { SpaceEntity } from '../../types/spaces';
import WindowWrapper from '../../WindowWrapper';
import EntityDetails from './components/EntityDetails';
import EntityRow from './components/EntityRow';

interface EntityBrowserProps {
  windowId: string;
  spaceId: string;
  title: string;
  onClose: () => void;
}

// const StackIcon = () => (
//   <div className="stack-icon">
//     <div className="card"></div>
//     <div className="card"></div>
//     <div className="card"></div>
//   </div>
// );

const isAppleNoteEntity = (entity: BaseEntityType): entity is BaseEntityType & AppleNoteType => {
  return entity.entityType === 'AppleNote';
};

const EntityBrowserApp = memo(({ windowId, spaceId, title, onClose }: EntityBrowserProps) => {
  // 1. Always get the store first
  const store = getEntityBrowserStore(windowId, spaceId);
  
  // 2. Get store state
  const {
    selectedEntityIds,
    expandedGroups,
    viewMode,
    sortBy,
    status,
    selectEntity,
    toggleGroup,
    setSortBy,
    initialize,
    cleanup
  } = store();

  // 3. Get entity store state and subscribe to Space entity changes
  const { 
    entities, 
    status: entityStoreStatus, 
    performDelete 
  } = useEntityStore(
    // Use a stable selector that doesn't create new objects
    (state: EntityStore) => state
  );
  
  // 4. Selected item state
  const [selectedItem, setSelectedItem] = useState<BaseEntityType | null>(null);

  // 5. Initialize effect
  useEffect(() => {
    const initStores = async () => {
      const entityStore = useEntityStore.getState();

      // Only initialize if not already initialized for this space
      if (!entityStore.initialized || entityStore.currentSpaceId !== spaceId) {
        await entityStore.initialize(spaceId); // Use correct spaceId
      }

      await initialize(windowId, spaceId);
    };

    initStores();
  }, [spaceId, windowId, initialize]);

  // 6. Selection effect
  useEffect(() => {
    if (selectedEntityIds.size === 0) {
      setSelectedItem(null);
      return;
    }

    const selectedId = Array.from(selectedEntityIds)[0];
    const findEntity = (entities: BaseEntityType[]): BaseEntityType | null => {
      for (const entity of entities) {
        if (entity._id === selectedId) return entity;
        if (entity.children) {
          const found = findEntity(entity.children);
          if (found) return found;
        }
      }
      return null;
    };

    const found = findEntity(entities);
    setSelectedItem(found);
  }, [selectedEntityIds, entities]);

  // Sort entities based on current sortBy setting
  const sortedEntities = useMemo(() => {
    const sortEntities = (entities: BaseEntityType[]): BaseEntityType[] => {
      // Filter out Space entities
      const filteredEntities = entities.filter(entity => entity.entityType !== 'Space');
      
      const sorted = [...filteredEntities].sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return (a.name || '').localeCompare(b.name || '');
          case 'date':
            const aDate = new Date(a.updated_at || a.created_at || 0);
            const bDate = new Date(b.updated_at || b.created_at || 0);
            return bDate.getTime() - aDate.getTime(); // Most recent first
          case 'type':
            return (a.entityType || '').localeCompare(b.entityType || '');
          default:
            return 0;
        }
      });

      // Recursively sort children if they exist, also filtering out Space entities
      return sorted.map(entity => ({
        ...entity,
        children: entity.children ? sortEntities(entity.children) : undefined
      }));
    };

    return sortEntities(entities);
  }, [entities, sortBy]);

  const handleSelect = useCallback((entity: BaseEntityType) => {
    if (entity._id) {
      selectEntity(entity._id);
    }
  }, [selectEntity]);

  const handleToggleGroup = useCallback((groupId: string) => {
    toggleGroup(groupId);
  }, [toggleGroup, expandedGroups]);

  const handleSortChange = useCallback(() => {
    const nextSort = sortBy === 'name' ? 'date' : sortBy === 'date' ? 'type' : 'name';
    setSortBy(nextSort);
  }, [sortBy, setSortBy]);

  const getSortIcon = useCallback(() => {
    switch (sortBy) {
      case 'name': return '🔤';
      case 'date': return '📅';
      case 'type': return '🏷️';
      default: return '🔤';
    }
  }, [sortBy]);

  const getSortLabel = useCallback(() => {
    switch (sortBy) {
      case 'name': return 'Name';
      case 'date': return 'Date';
      case 'type': return 'Type';
      default: return 'Name';
    }
  }, [sortBy]);

  // This memoization is fine since it's just for UI rendering
  const memoizedEntityTree = useMemo(() => (
    <EntityTree
      entities={sortedEntities}
      selectedIds={selectedEntityIds}
      expandedGroups={expandedGroups}
      viewMode={viewMode}
      onSelect={handleSelect}
      onToggleGroup={handleToggleGroup}
    />
  ), [sortedEntities, selectedEntityIds, expandedGroups, viewMode, handleSelect, handleToggleGroup]);

  if (status === 'loading' || entityStoreStatus === 'loading') {
    return <div className="loading">Loading...</div>;
  }

  return (
    <WindowWrapper title={title} onClose={onClose}>
      <div className="systemViewer">
        <div className={`gridContainer ${selectedItem ? 'withSidebar' : ''}`}>
          <div className="header">
            <span>Name</span>
            <button
              className="sortButton"
              onClick={handleSortChange}
              title={`Sort by ${getSortLabel()} (click to change)`}
            >
              {getSortIcon()} <span className="sortLabel">{getSortLabel()}</span>
            </button>
          </div>
          <div className="mainContent">
            {entities.length === 0 ? (
              <div className="no-entities">No entities found</div>
            ) : memoizedEntityTree}
          </div>
          {selectedItem && (
            <div className="sidebar">
              <div className="sidebarHeader">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Details</span>
                  <button
                    onClick={() => setSelectedItem(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      color: '#666',
                    }}
                  >
                    ›
                  </button>
                </div>
              </div>
              <EntityDetails entity={selectedItem} />
            </div>
          )}
        </div>
      </div>
    </WindowWrapper>
  );
});

interface EntityTreeProps {
  entities: BaseEntityType[];
  selectedIds: Set<string>;
  expandedGroups: Set<string>;
  viewMode: 'list' | 'grid';
  onSelect: (entity: BaseEntityType) => void;
  onToggleGroup: (groupId: string) => void;
}

const EntityTree: React.FC<EntityTreeProps> = ({ entities, selectedIds, expandedGroups, viewMode, onSelect, onToggleGroup }) => {
  return (
    <div className="entityTree">
      {entities.map((entity) => (
        <EntityRow
          key={entity._id}
          entity={entity}
          onSelect={onSelect}
          selectedIds={selectedIds}
          expandedGroups={expandedGroups}
          viewMode={viewMode}
          onToggleGroup={onToggleGroup}
        />
      ))}
    </div>
  );
};

export default EntityBrowserApp;
