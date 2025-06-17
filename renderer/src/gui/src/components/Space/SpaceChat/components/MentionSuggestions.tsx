import './MentionSuggestions.scss';

import React from 'react';

import { AnyWindowEntity } from '../../../../types/windows';
import { getMentionDisplayName } from '../../utils/windowUtils';

interface MentionSuggestionsProps {
  suggestions: AnyWindowEntity[];
  onSelect: (entity: AnyWindowEntity) => void;
  style?: React.CSSProperties;
}

interface WithTitle {
  title: string;
}

interface WithName {
  name: string;
}

export const MentionSuggestions: React.FC<MentionSuggestionsProps> = ({ suggestions, onSelect, style }) => {

  if (suggestions.length === 0) return null;

  const getDisplayName = (entity: AnyWindowEntity): string => {

    // Type guard for entities with title
    if ('title' in entity && typeof (entity as WithTitle).title === 'string') {
      return (entity as WithTitle).title || 'Untitled';
    }
    // Type guard for entities with name
    if ('name' in entity && typeof (entity as WithName).name === 'string') {
      return (entity as WithName).name;
    }
    return entity.id;
  };

  return (
    <div className="mention-suggestions" style={style}>
      {suggestions.map((entity) => (
        <div
          key={entity.id}
          className="mention-suggestion-item"
          onClick={() => onSelect(entity)}
        >
          <span className="mention-entity-name">{getMentionDisplayName(entity)}</span>
          <span className="mention-entity-type">{entity.type}</span>
        </div>
      ))}
    </div>
  );
}; 