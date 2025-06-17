import './TabGroup.scss';

import React, { memo } from 'react';

import useSpaceStore from '../../stores/spaceStore';
import type { WindowEntity } from '../../types/windows';

interface TabGroupProps {
    windowIds: string[];
    activeId?: string;
    onActivate?: (windowId: string) => void;
    onCloseTab?: (windowId: string) => void;
}

const TabGroup = memo(({ windowIds, activeId, onActivate, onCloseTab }: TabGroupProps) => {
    const windows = useSpaceStore(state => state.windows);
    
    return (
        <div className="tab-group">
            {windowIds.map(windowId => {
                const window = windows[windowId] as WindowEntity;
                if (!window || window.type !== 'window') return null;
                
                const title = window.title || window.appType || 'Untitled';
                
                return (
                    <div
                        key={windowId}
                        className={`tab ${activeId === windowId ? 'active' : ''}`}
                        onClick={() => onActivate?.(windowId)}
                    >
                        <span className="tab-title">{title}</span>
                        <button 
                            className="tab-close"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCloseTab?.(windowId);
                            }}
                        >
                            ×
                        </button>
                    </div>
                );
            })}
        </div>
    );
});

export default TabGroup; 