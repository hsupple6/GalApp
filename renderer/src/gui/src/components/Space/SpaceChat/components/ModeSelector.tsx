import './ModeSelector.scss';

import React, { useEffect, useRef, useState } from 'react';

import { ChatMode } from '../types';
import { ThreadEntity } from 'types/chat';

interface ModeSelectorProps {
  currentMode: ChatMode;
  onChange: (mode: ChatMode) => void;
  getDescription?: (mode: ChatMode) => string;
  threads: Record<string, ThreadEntity>;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onChange,
  getDescription,
  threads
}) => {
  const [useDropdown, setUseDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const modes: ChatMode[] = ['create', 'chat', 'editor', 'exp1'];

  // Get thread count for current mode
  const getThreadCount = (mode: ChatMode) => {
    return Object.values(threads).length;
  };

  useEffect(() => {
    const checkWidth = () => {
      if (containerRef.current) {
        setUseDropdown(containerRef.current.offsetWidth < 100);
      }
    };

    checkWidth();
    const resizeObserver = new ResizeObserver(checkWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className={`mode-selector ${useDropdown ? 'narrow' : ''}`} ref={containerRef}>
      {useDropdown ? (
        <select 
          value={currentMode} 
          onChange={(e) => onChange(e.target.value as ChatMode)}
          title={getDescription?.(currentMode)}
        >
          {modes.map(mode => (
            <option 
              key={mode} 
              value={mode}
              title={getDescription?.(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
              {getThreadCount(mode) > 0 && ` (${getThreadCount(mode)})`}
            </option>
          ))}
        </select>
      ) : (
        <div className="mode-tabs">
          {modes.map((mode) => (
            <button
              key={mode}
              className={`mode-button ${currentMode === mode ? 'active' : ''}`}
              onClick={() => onChange(mode)}
              title={getDescription?.(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
              {/* {getThreadCount(mode) > 0 && (
                <span className="thread-count">{getThreadCount(mode)}</span>
              )} */}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}; 