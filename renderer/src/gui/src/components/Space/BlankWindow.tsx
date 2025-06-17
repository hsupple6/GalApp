import React, { useEffect, useRef, useState } from 'react';

import { getAllApps } from '../../services/actionService';
import { entityService } from '../../services/entityService';
import type { BaseEntityType } from '../../types/entities';

interface Action {
  id: string;
  icon: string;
  label: string;
  description?: string;
  action: () => void;
}

interface BlankWindowProps {
  onSelect: (selection: any) => void;
}

const BlankWindow: React.FC<BlankWindowProps> = ({ onSelect }) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [entities, setEntities] = useState<BaseEntityType[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Auto-focus the search input
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Initialize quick actions
  useEffect(() => {
    const quickActions: Action[] = [
      {
        id: 'new-note',
        icon: '📝',
        label: 'New Note',
        description: 'Create a new note',
        action: () => onSelect({ type: 'note' })
      },
      {
        id: 'new-browser',
        icon: '🌐',
        label: 'New Browser',
        description: 'Open a web browser',
        action: () => onSelect({ type: 'browser' })
      },
      {
        id: 'entity-browser',
        icon: '🗂️',
        label: 'Entity Browser',
        description: 'Browse all entities',
        action: () => onSelect({ type: 'entity-browser' })
      }
    ];
    setActions(quickActions);
  }, [onSelect]);

  // Search entities when term changes
  useEffect(() => {
    const searchEntities = async () => {
      if (searchTerm.length < 2) {
        setEntities([]);
        return;
      }

      // Fetch all entities and filter locally
      const results = await entityService.fetchEntities();
      const filtered = results.filter(entity => 
        // Check if entity has the properties we need
        entity.name &&
        entity.type &&
        // Then do the actual search
        (entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         entity.type.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setEntities(filtered);
    };

    const timeoutId = setTimeout(searchEntities, 200);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = actions.length + entities.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex < actions.length) {
          actions[selectedIndex].action();
        } else {
          const entity = entities[selectedIndex - actions.length];
          onSelect({ type: 'entity', entity });
        }
        break;
    }
  };

  console.log('Rendering BlankWindow');

  return (
    <div className="blank-window" onKeyDown={handleKeyDown}>
      <h2>Blank Window</h2>
      <button onClick={() => onSelect({ type: 'example' })}>Select Example</button>

      <input
        ref={searchInputRef}
        type="text"
        className="search-input"
        placeholder="Search or create..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="results-container">
        {/* Quick Actions */}
        {(!searchTerm || searchTerm.length < 2) && (
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            {actions.map((action, index) => (
              <div
                key={action.id}
                className={`action-item ${selectedIndex === index ? 'selected' : ''}`}
                onClick={action.action}
              >
                <span className="action-icon">{action.icon}</span>
                <div className="action-details">
                  <div className="action-label">{action.label}</div>
                  {action.description && (
                    <div className="action-description">{action.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Results */}
        {entities.length > 0 && (
          <div className="search-results">
            <h3>Results</h3>
            {entities.map((entity, index) => (
              <div
                key={entity.id}
                className={`result-item ${
                  selectedIndex === index + actions.length ? 'selected' : ''
                }`}
                onClick={() => onSelect({ type: 'entity', entity })}
              >
                <span className="entity-icon">
                  {entity.type === 'note' ? '📝' : '📄'}
                </span>
                <div className="entity-details">
                  <div className="entity-name">{entity.name}</div>
                  <div className="entity-type">{entity.type}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlankWindow; 