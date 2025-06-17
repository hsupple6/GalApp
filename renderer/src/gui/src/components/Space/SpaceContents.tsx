import './SpaceContents.scss';

import React from 'react';

import type { AnyWindowEntity } from '../../types/windows';
import { getWindowTitle } from './utils/windowUtils';

interface SpaceContentsProps {
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  entities: Record<string, AnyWindowEntity>;
  selectedIds: string[];
  handleWindowClick: (windowId: string, event: React.MouseEvent) => void;
}

const SpaceContents: React.FC<SpaceContentsProps> = ({
  isVisible,
  setIsVisible,
  entities,
  selectedIds,
  handleWindowClick,
}) => {
  return (
    <>
      <div className="contents-wrapper">
        <button className="contents-button" onClick={() => setIsVisible(!isVisible)}>
          ☰
        </button>
      </div>

      {isVisible && (
        <div className="contents-panel">
          <h3 className="contents-panel-title">Contents</h3>
          <ul className="contents-list">
            {Object.values(entities).map((entity) => {
              if (entity.type === 'window') {
                const title = entity.tabs 
                  ? `Window Group (${entity.tabs.length} tabs)` 
                  : getWindowTitle(entity);

                return (
                  <li
                    key={entity.id}
                    className={`contents-list-item ${selectedIds.includes(entity.id) ? 'selected' : ''}`}
                    onClick={(e) => handleWindowClick(entity.id, e)}
                  >
                    <span className="contents-list-item-title">{title}</span>
                  </li>
                );
              }
              return null;
            })}
          </ul>
        </div>
      )}
    </>
  );
};

export default SpaceContents;
