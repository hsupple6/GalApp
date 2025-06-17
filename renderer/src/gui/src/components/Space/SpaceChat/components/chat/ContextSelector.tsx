import React, { useCallback, useEffect, useRef, useState } from 'react';
import useSpaceStore from '../../../../../stores/spaceStore';
import { useContextStore } from '../../store/contextStore';
import useEntityStore from '../../../../../stores/entityStore';
import { getEntityDisplayIcon, getEntityDisplayName } from '../../../utils/windowUtils';
import './ContextSelector.scss';

interface ContextSelectorProps {
  onSelectEntity: (windowId: string) => void;
}

// Entity types that are supported in context
const SUPPORTED_ENTITY_TYPES = ['File', 'WebDocument', 'Note', 'Group', 'Space', 'Doc'];

export const ContextSelector: React.FC<ContextSelectorProps> = ({ onSelectEntity }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { windows } = useSpaceStore();
  const { addWindowToContext } = useContextStore();
  const { entities, initialize, currentSpaceId } = useEntityStore();

  // Initialize entity store if needed
  useEffect(() => {
    const ensureEntitiesLoaded = async () => {
      const spaceId = currentSpaceId || useSpaceStore.getState().activeSpace?.id;

      if (spaceId && (!entities.length || currentSpaceId !== spaceId)) {
        console.log('[ContextSelector] Initializing entity store for space:', spaceId);
        await initialize(spaceId);
      }
    };

    if (isOpen) {
      ensureEntitiesLoaded();
    }
  }, [isOpen, initialize, entities.length, currentSpaceId]);

  // Combine windows and entities for search
  const allItems = React.useMemo(() => {
    // Process windows

    const windowItems = Object.values(windows || {}).map((window) => ({
      id: window.id,
      name:
        (window as any)?.applicationState?.docs?.currentDocName ||
        (window as any).name ||
        (window as any).title ||
        window.id,
      type: (window as any).appType || (window as any).type || 'window',
      entityType: 'Window',
      isWindow: true,
    }));

    // Process other entities, filtering out any that are already represented as windows
    // and only including supported entity types
    const windowIds = new Set(windowItems.map((w) => w.id));
    const entityItems = entities
      .filter((entity) => !windowIds.has(entity.id) && SUPPORTED_ENTITY_TYPES.includes(entity.entityType))
      .map((entity) => ({
        id: entity.id,
        name: getEntityDisplayName(entity),
        type: entity.type,
        entityType: entity.entityType,
        isWindow: false,
        entity,
      }));

    return [...windowItems, ...entityItems];
  }, [windows, entities]);

  // Filter items based on search term
  const filteredItems = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return allItems;
    }

    const searchTermLower = searchTerm.toLowerCase();
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(searchTermLower) ||
        item.type.toLowerCase().includes(searchTermLower) ||
        item.entityType.toLowerCase().includes(searchTermLower),
    );
  }, [allItems, searchTerm]);

  // Group filtered items by entity type for better organization
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, typeof filteredItems> = {};

    // First add windows at the top
    const windowItems = filteredItems.filter((item) => item.isWindow);
    if (windowItems.length > 0) {
      groups['Windows'] = windowItems;
    }

    // Then group other entities by type
    filteredItems.forEach((item) => {
      if (!item.isWindow) {
        const groupName = item.entityType + 's'; // Pluralize
        if (!groups[groupName]) {
          groups[groupName] = [];
        }
        groups[groupName].push(item);
      }
    });

    return groups;
  }, [filteredItems]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Position dropdown function
  const positionDropdown = useCallback(() => {
    if (!isOpen || !buttonRef.current || !dropdownRef.current) return;

    // Focus the input
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Get the absolute position of the button in the viewport
    const buttonRect = buttonRef.current.getBoundingClientRect();

    // Fixed horizontal position: right side
    // Position it 10px from the right edge
    dropdownRef.current.style.right = '10px';
    dropdownRef.current.style.left = 'auto';

    // Position the BOTTOM of the dropdown 10px above the button
    dropdownRef.current.style.bottom = `${window.innerHeight - buttonRect.top + 10}px`;
    dropdownRef.current.style.top = 'auto';

    // Set a reasonable max height to prevent it from being too tall
    const maxAllowedHeight = buttonRect.top - 20; // Leave some space at the top of the screen
    dropdownRef.current.style.maxHeight = `${Math.min(400, maxAllowedHeight)}px`;
  }, [isOpen]);

  // Focus the search input and position the dropdown when it opens
  useEffect(() => {
    if (!isOpen) return;

    // Position after a short delay to ensure the dropdown is rendered
    const timer = setTimeout(() => {
      positionDropdown();
    }, 0);

    // Also reposition on resize
    window.addEventListener('resize', positionDropdown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', positionDropdown);
    };
  }, [isOpen, positionDropdown]);

  const handleItemSelect = (item: any) => {
    onSelectEntity(item.id);

    // Add to context if the method exists and it's a window
    if (typeof addWindowToContext === 'function' && item.isWindow) {
      addWindowToContext(item.id);
    }

    setIsOpen(false);
    setSearchTerm('');
  };

  // Get entity icon based on type
  const getItemIcon = (item: any) => {
    if (item.isWindow) {
      return '🪟';
    }
    return item.entity ? getEntityDisplayIcon(item.entity) : '📄';
  };

  return (
    <div className="context-selector">
      <button ref={buttonRef} className="context-add" onClick={() => setIsOpen(!isOpen)} title="Add to context">
        +
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="context-dropdown"
          style={{
            // Position above the button
            bottom: buttonRef.current
              ? `${window.innerHeight - buttonRef.current.getBoundingClientRect().top + 10}px`
              : 'auto',
            top: 'auto',
            right: '10px',
            left: 'auto',
          }}
        >
          <div className="context-dropdown-header">
            <input
              ref={inputRef}
              type="text"
              className="context-search-input"
              placeholder="Search entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="context-dropdown-content">
            {Object.keys(groupedItems).length > 0 ? (
              Object.entries(groupedItems).map(([groupName, items]) => (
                <div key={groupName} className="context-entity-group">
                  <div className="context-entity-group-header">{groupName}</div>
                  {items.map((item) => (
                    <button key={item.id} className="context-entity" onClick={() => handleItemSelect(item)}>
                      <span className="entity-name">
                        <span className="entity-icon">{getItemIcon(item)}</span>
                        {item.name}
                      </span>
                      <span className="entity-type">{item.entityType}</span>
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div className="context-dropdown-empty">No items match your search</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
