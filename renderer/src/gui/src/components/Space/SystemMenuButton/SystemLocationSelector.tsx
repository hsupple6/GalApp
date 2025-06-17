import './SystemLocationSelector.scss';

import React, { useEffect,useRef, useState } from 'react';

import { Chevron } from './Chevron';

export type SystemLocation = 
  | 'Macbook Pro'
  | 'Cloud'
  | 'Gal Box 1';

interface SystemLocationSelectorProps {
  currentLocation: SystemLocation;
  onLocationChange: (location: SystemLocation) => void;
}

const AVAILABLE_LOCATIONS: Array<{
  id: SystemLocation;
  name: string;
  icon: string;
}> = [
  { id: 'Macbook Pro', name: 'This Macbook Pro', icon: '💻' },
  { id: 'Gal Box 1', name: 'Gal Box 1', icon: '⬛️' },
  { id: 'Cloud', name: 'Cloud', icon: '⬜️' }
];

export const SystemLocationSelector: React.FC<SystemLocationSelectorProps> = ({
  currentLocation,
  onLocationChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const currentLocationData = AVAILABLE_LOCATIONS.find(loc => loc.id === currentLocation);

  return (
    <div className={`system-location-selector ${isExpanded ? 'expanded' : ''}`}>
      <div 
        className="current-location menu-item"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="location-icon">
          {currentLocationData?.icon}
          <span className="pulse-indicator"></span>
        </span>
        GalOS currently served from {currentLocationData?.name}
        <Chevron isOpen={isExpanded} />
      </div>
      
      {isExpanded && (
        <div className="available-locations">
          {AVAILABLE_LOCATIONS.map(location => (
            <button
              key={location.id}
              className={`location-option ${currentLocation === location.id ? 'active' : ''}`}
              onClick={() => {
                onLocationChange(location.id);
                setIsExpanded(false);
              }}
            >
              <div className={`location-icon ${location.id === 'Gal Box 1' ? 'gal-box' : ''}`}>
                {location.icon}
              </div>
              {location.name}
              {currentLocation === location.id && <span className="check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}; 