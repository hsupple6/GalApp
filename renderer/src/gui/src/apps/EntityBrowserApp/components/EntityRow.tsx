import React, { useCallback, useMemo, useState } from 'react';

import OpenFileAction from '../../../components/Space/actions/OpenFileAction';
import { IOpenFileAction } from '../../../components/Space/actions/OpenFileAction';
import { getAppTypeByEntity, getEntityDisplayIcon, getEntityDisplayName, getWindowSizeAndPosition } from '../../../components/Space/utils/windowUtils';
import { dispatchCustomEvent } from '../../../services/actionService';
import useEntityStore from '../../../stores/entityStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import { BaseEntityType } from '../../../types/entities';
import { SpaceEntity } from '../../../types/spaces';

interface EntityRowProps {
  parentPath?: string;
  entity: BaseEntityType;
  onSelect: (entity: BaseEntityType) => void;
  selectedIds: Set<string>;
  expandedGroups: Set<string>;
  viewMode: 'list' | 'grid';
  onToggleGroup: (groupId: string) => void;
}

const EntityRow = ({ parentPath, entity, onSelect, selectedIds, expandedGroups, viewMode, onToggleGroup }: EntityRowProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { performDelete } = useEntityStore();
  const addWindow = useSpaceStore(state => state.addWindow);

  const hasChildren = useMemo(
    () =>
      (entity.entityType === 'Group' && Array.isArray(entity.children) && entity.children.length > 0) ||
      (entity.entityType === 'Space' && Object.keys((entity as SpaceEntity).skeleton?.windows || {}).length > 0),
    [entity],
  );

  const displayIcon = useMemo(() => getEntityDisplayIcon(entity), [entity]);
  const displayName = useMemo(() => getEntityDisplayName(entity), [entity]);

  const filePath = useMemo(() => `${parentPath}/${getEntityDisplayName(entity)}`, [entity, parentPath]);

  const handleDoubleClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation?.();

      if (entity.entityType === 'File') {
        const fileName = (entity.skeleton as any)?.fileName || entity.name;
        let appId = 'webdocument';

        if (fileName.toLowerCase().endsWith('.pdf')) {
          appId = 'pdfium';
        } else if (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          appId = 'imageviewer';
        }

        const windowId = `window-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { size, position } = getWindowSizeAndPosition();

        addWindow({
          id: windowId,
          type: 'window' as const,
          position,
          size,
          appType: appId,
          title: fileName,
          entity
        });
      }
    },
    [entity, addWindow],
  );

  const handleSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[EntityRow] Selecting entity:', {
      id: entity._id,
      name: entity.name,
      type: entity.entityType,
      isChild: !!parentPath
    });
    onSelect(entity);
  }, [entity, onSelect]);

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${entity.name}"?`)) {
      try {
        await performDelete(entity._id);
      } catch (err) {
        console.error('Failed to delete entity:', err);
        alert('Failed to delete entity. Please try again.');
      }
    }
  }, [entity, performDelete]);

  const renderChildren = useCallback(() => {
    if (!expandedGroups.has(entity._id)) return null;

    if (entity.entityType === 'Space') {
      const space = entity as SpaceEntity;
      return (
        <div className="childRows spaceWindows">
          {Object.values(space.skeleton.windows).map((window) => (
            <div key={window.id} className="windowPreview">
              <span>{window.type === 'window' ? window.title || 'Untitled' : 'Group'}</span>
              <span className="windowType">{window.type}</span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="childRows">
        {entity.children?.map((child) => (
          <EntityRow
            key={child._id}
            parentPath={filePath}
            entity={child}
            onSelect={onSelect}
            selectedIds={selectedIds}
            expandedGroups={expandedGroups}
            viewMode={viewMode}
            onToggleGroup={onToggleGroup}
          />
        ))}
      </div>
    );
  }, [entity, expandedGroups, onSelect, selectedIds, viewMode, onToggleGroup, filePath]);

  const isExpanded = expandedGroups.has(entity._id);

  return (
    <>
      <div
        className={`row ${selectedIds.has(entity._id) ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleSelect}
        onDoubleClick={handleDoubleClick}
      >
        <div className={`rowContent ${hasChildren ? '' : 'noChildren'}`}>
          {hasChildren && (
            <span
              className="expandCaret"
              onClick={(e) => {
                e.stopPropagation();
                onToggleGroup(entity._id);
              }}
            >
              {isExpanded ? '▾' : '▸'}
            </span>
          )}
          <span className={`entityName ${entity.isSystemGroup ? 'systemGroup' : ''}`}>
            {displayIcon} {displayName}
          </span>
        </div>
        <div className="rowDetails">
          {isHovered && !entity.isSystemGroup && (
            <button
              className="deleteButton"
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {isExpanded && renderChildren()}
    </>
  );
};

export default EntityRow; 