import './SystemMenuButton.scss';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

import { useSpaceStore } from '../../../stores/spaceStore';
import useGalBoxStore from '../../../components/GalSetupModal/store/galboxStore';
import { useGalBoxServer } from '../../../hooks/useGalBoxServer';
import BuyGalacticaModal from './BuyGalacticaModal';
import { SystemLocation, SystemLocationSelector } from './SystemLocationSelector';
import GalSetupModal from './GalSetupModal';
import GalBoxManagementModal from './GalBoxManagementModal';
import { spaceService } from '../../../services/spaceService';
import { userService, UserProfile } from '../../../services/userService';
import type { UISpace } from '../../../types/spaces';

const SystemMenuButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isGalSetupOpen, setIsGalSetupOpen] = useState(false);
  const [isGalBoxManagementOpen, setIsGalBoxManagementOpen] = useState(false);
  const [recentSpaces, setRecentSpaces] = useState<UISpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const spacesLoadingRef = useRef(false);
  const navigate = useNavigate();
  const { spaceId: currentSpaceId } = useParams();
  const { logout, user } = useAuth0();
  const [currentLocation, setCurrentLocation] = useState<SystemLocation>('Macbook Pro');
  const toggleDebugger = useSpaceStore(state => state.toggleDebugger);
  const showDebugger = useSpaceStore(state => state.showDebugger);
  
  // Get GalBox information to determine if it's already configured
  const { activeGalBox } = useGalBoxStore();
  const { serverStatus, pauseConnection, setPauseConnection } = useGalBoxServer();
  
  // Feature flag to disable GalBox features
  const GALBOX_FEATURES_ENABLED = false;
  
  // Check if GalBox is configured either with local connection or Ngrok URL
  const isGalBoxConfigured = GALBOX_FEATURES_ENABLED && !!(
    activeGalBox?.ipAddress || 
    localStorage.getItem('galBoxNgrokUrl')
  );
  
  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }, [logout]);

  const handleCreateSpace = useCallback(() => {
    // No longer create space directly - just navigate to /new
    setIsOpen(false);
    navigate('/new');
  }, [navigate]);

  // Listen for custom event to open GalBox management modal
  useEffect(() => {
    const handleOpenManagement = () => {
      setIsGalBoxManagementOpen(true);
    };
    
    window.addEventListener('open-galbox-management', handleOpenManagement);
    return () => {
      window.removeEventListener('open-galbox-management', handleOpenManagement);
    };
  }, []);

  // Fetch user profile when component mounts
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const profile = await userService.getUserProfile();
        setUserProfile(profile);
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

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

  // Add a new useEffect for debugging menu state
  useEffect(() => {
    if (isOpen) {
      console.log('[SystemMenuButton] Menu opened, rendering items with isGalBoxConfigured:', isGalBoxConfigured);
    }
  }, [isOpen, isGalBoxConfigured]);

  // Fetch recent spaces when menu opens
  const fetchRecentSpaces = useCallback(async () => {
    if (spacesLoadingRef.current) return;
    
    spacesLoadingRef.current = true;
    setSpacesLoading(true);
    try {
      const fetchedSpaces = await spaceService.fetchRecentSpaces();
      setRecentSpaces(fetchedSpaces.slice(0, 5)); // Limit to 5 spaces
    } catch (error) {
      console.error('Failed to fetch recent spaces:', error);
      setRecentSpaces([]);
    } finally {
      spacesLoadingRef.current = false;
      setSpacesLoading(false);
    }
  }, []);

  // Fetch spaces when menu opens
  useEffect(() => {
    if (isOpen) {
      fetchRecentSpaces();
    }
  }, [isOpen, fetchRecentSpaces]);

  const handleSpaceClick = useCallback((spaceId: string) => {
    setIsOpen(false);
    navigate(`/spaces/${spaceId}`);
  }, [navigate]);

  return (
    <div ref={menuRef} className="menu-button-container">
      <button 
        className={`menu-button ${isOpen ? 'active' : ''}`} 
        onClick={() => {
          setIsOpen(!isOpen);
        }}
      >
        ⚫️
      </button>
      {isOpen && (
        <div className="menu-dropdown">
          {/* User Profile Section */}
          {user && (
            <>
              <div className="user-profile-section">
                <img 
                  src={user.picture} 
                  alt="Profile" 
                  className="user-avatar"
                />
                <div className="user-info">
                  <div className="user-name">
                    {userProfile?.skeleton.name || user.name || user.email}
                  </div>
                  <div className="user-email">{user.email}</div>
                </div>
              </div>
              <div className="menu-separator" />
            </>
          )}
          
          <SystemLocationSelector currentLocation={currentLocation} onLocationChange={setCurrentLocation} />
          
          {/* Recent Spaces Section */}
          {recentSpaces.length > 0 && (
            <>
              <div className="menu-separator" />
              <div className="menu-section-header">Recent Spaces</div>
              {recentSpaces.map(space => (
                <div 
                  key={space.id}
                  className={`menu-item space-item ${space.id === currentSpaceId ? 'active' : ''}`} 
                  onClick={() => handleSpaceClick(space.id)}
                >
                  {space.name}
                </div>
              ))}
            </>
          )}
          
          <div className="menu-separator" />
          <div className="menu-item" onClick={handleCreateSpace}>
            Create New Space
          </div>
          <div
            className="menu-item"
            onClick={() => {
              setIsBuyModalOpen(true);
              setIsOpen(false);
            }}
          >
            Purchase Galactica I
          </div>
          
          {isGalBoxConfigured ? (
            // Show "Manage GalBox" if already configured
            <div 
              className="menu-item highlight" 
              onClick={() => {
                setIsGalBoxManagementOpen(true);
                setIsOpen(false);
              }}
            >
              Manage GalBox 🛠️
            </div>
          ) : (
            // Show "Set Up GalBox" if not yet configured
            <div 
              className="menu-item highlight" 
              onClick={() => {
                setIsGalSetupOpen(true);
                setIsOpen(false);
              }}
            >
              Set Up Gal Box ✨
            </div>
          )}
          
          <div className="menu-separator" />
          <div className="menu-item" onClick={() => navigate('/home')}>
            Go Home
          </div>
          <div
            className="menu-item"
            onClick={() => {
              toggleDebugger();
              setIsOpen(false);
            }}
          >
            {showDebugger ? 'Hide' : 'Show'} Debug Panel
          </div>
          <div 
            className="menu-item" 
            onClick={() => {
              setPauseConnection(!pauseConnection);
              setIsOpen(false);
            }}
          >
            {pauseConnection ? 'Resume' : 'Pause'} GalBox Connection
          </div>
          <div className="menu-separator" />
          <div className="menu-item" onClick={handleLogout}>
            Log Out
          </div>
        </div>
      )}
      <BuyGalacticaModal
        isOpen={isBuyModalOpen}
        onClose={() => setIsBuyModalOpen(false)}
      />
      <GalSetupModal
        isOpen={isGalSetupOpen}
        onClose={() => setIsGalSetupOpen(false)}
      />
      <GalBoxManagementModal
        isOpen={isGalBoxManagementOpen}
        onClose={() => setIsGalBoxManagementOpen(false)}
      />
    </div>
  );
};

export default SystemMenuButton;
