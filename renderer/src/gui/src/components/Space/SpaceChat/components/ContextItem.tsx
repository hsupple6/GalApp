import React from 'react';

import { AnyWindowEntity } from '../../../../types/windows';
import { getWindowContext } from '../utils/windowContext';

interface ContextItemProps {
  entity: AnyWindowEntity;
  onRemove: () => void;
}

export const ContextItem: React.FC<ContextItemProps> = ({ entity, onRemove }) => {
  const context = getWindowContext(entity);
  
  if (!context) return null;
  
  return (
    <div className="context-item">
      <span className="context-item-title">
        {context.type} - {
          'content' in context ? context.name :
          'url' in context ? context.title :
          context.title
        }
      </span>
      {'content' in context && (
        <div className="context-content">
          {context.content.slice(0, 50)}...
        </div>
      )}
      {'url' in context && (
        <div className="context-url">
          {context.url}
        </div>
      )}
      <button className="context-item-remove" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}; 