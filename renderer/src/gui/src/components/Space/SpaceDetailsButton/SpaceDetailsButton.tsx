import './SpaceDetailsButton.scss';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useSpaceStore } from '../../../stores/spaceStore';

const SpaceDetailsButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { updateSpaceName, setBackgroundColor, activeSpace } = useSpaceStore();
  const spaceName = useSpaceStore(state => state.activeSpace?.name || 'Untitled Space');
  const [editedName, setEditedName] = useState(spaceName);

  useEffect(() => {
    if (!isSubmitting) {
      setEditedName(spaceName);
    }
  }, [spaceName, isSubmitting]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedName(e.target.value);
  };

  const handleBackgroundColorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBackgroundColor(e.target.value);
  };

  const handleNameSubmit = async () => {
    if (editedName !== spaceName && !isSubmitting) {
      try {
        setIsSubmitting(true);
        await updateSpaceName(editedName);
        setIsOpen(false);
      } catch (error) {
        console.error('Failed to update space name:', error);
        setEditedName(spaceName);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button 
        className={`space-details-button ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {spaceName}
      </button>
      {isOpen && (
        <div className="space-details-dropdown">
          <div className="menu-item full-width">
            <label>Name:</label>
            <input 
              type="text" 
              value={editedName}
              onChange={handleNameChange}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNameSubmit();
                }
              }}
            />
          </div>
          <div className="menu-separator" />
          <div className="menu-item">
            <label>Background:</label>
            <select onChange={handleBackgroundColorChange} value={activeSpace?.settings?.bgColor || '#ffffff00'}>
              <option value="#ffffff00">Default</option>
              <option value="#000000">Black</option>
              <option value="#ffffff">White</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpaceDetailsButton; 