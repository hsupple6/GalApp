import './ModeSelectorMenu.scss';

import React, { useEffect, useRef, useState } from 'react';

import { ChatMode } from '../types';
import { ThreadEntity } from 'types/chat';

interface ModeSelectorMenuProps {
  currentMode: ChatMode;
  onChange: (mode: ChatMode) => void;
  getDescription?: (mode: ChatMode) => string;
  threads: Record<string, ThreadEntity>;
}

export const ModeSelectorMenu: React.FC<ModeSelectorMenuProps> = ({
  currentMode,
  onChange,
  getDescription,
  threads
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modes: ChatMode[] = ['create', 'chat', 'editor', 'exp1'];

  // Get thread count for current mode
  const getThreadCount = (mode: ChatMode) => {
    return Object.values(threads).length;
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside both button and dropdown
      if (
        buttonRef.current && 
        dropdownRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleModeChange = (newMode: ChatMode) => {
    onChange(newMode);
    setIsOpen(false);
  };

  return (
    <div className="mode-selector-menu">
      <button 
        ref={buttonRef}
        type="button" 
        className="action-button mode-button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title={getDescription?.(currentMode)}
      >
        {currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}
      </button>
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="mode-dropdown"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mode-section-header">Modes</div>
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`mode-option ${currentMode === mode ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleModeChange(mode);
              }}
              title={getDescription?.(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
              {getThreadCount(mode) > 0 && (
                <span className="thread-count">{getThreadCount(mode)}</span>
              )}
              {currentMode === mode && <span className="check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}; 