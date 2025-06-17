import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { DebuggerPanel } from '../components/Debug/DebuggerPanel';
import Space from '../components/Space/Space';
import { spaceCRDTService } from '../services/crdt/spaceCRDTService';
import useEntityStore from '../stores/entityStore';
import useSpaceStore from '../stores/spaceStore';
import { useAppRegistryStore } from '../stores/appRegistryStore';
import { appRegistry } from '../services/appRegistryService';
import { isLocalhost } from '../utils/locationUtils';
import { useAuth0 } from '@auth0/auth0-react';

// Add this helper function to track which spaces are open in which tabs
const getSpaceTabId = (spaceId: string) => {
  const existingId = sessionStorage.getItem(`SPACE_TAB_ID_${spaceId}`);
  if (existingId) return existingId;
  
  const newId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  sessionStorage.setItem(`SPACE_TAB_ID_${spaceId}`, newId);
  return newId;
};

const SpaceWrapperPage = () => {
  // const { showDebugger } = useSpaceStore();

  const { getAccessTokenSilently, logout } = useAuth0();

  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { initializeApps } = useAppRegistryStore();
  const { getSpaceStatus, initialize, showDebugger } = useSpaceStore();

  const cleanupDoneRef = useRef(false);
  const spaceInitializedRef = useRef(false);

  useEffect(() => {

    const init = async () => {
      try {
        // First check if we have a token in localStorage
        const existingToken = localStorage.getItem('authToken');
        if (!existingToken) {
          const token = await getAccessTokenSilently({
            authorizationParams: {
              audience: process.env.REACT_APP_AUTH0_AUDIENCE || '',
              scope: 'openid profile email offline_access'
            }
          });
          localStorage.setItem('authToken', token);
        }

        await appRegistry.initializeSystemApps();

        await initializeApps();
      } catch (error) {
        localStorage.removeItem('authToken');
        logout({
          logoutParams: {
            returnTo: window.location.origin,
          },
        });
      }
    };

    init();

    return () => {
      console.log('[App] Component unmounted');
    };
  }, [getAccessTokenSilently, initializeApps, logout]);

  useEffect(() => {

    if (!spaceId) {
      console.warn('[SpaceWrapper] No spaceId provided, skipping initialization');
      return;
    }

    // Generate or get a unique ID for this tab's instance of this space
    const tabSpaceId = getSpaceTabId(spaceId);

    // Track the current spaceId in a closure to ensure cleanup matches the space we're initializing
    const currentSpaceId = spaceId;
    
    // Reset cleanup flag when space ID changes
    cleanupDoneRef.current = false;
    
    const init = async () => {
      // Prevent duplicate initialization
      if (spaceInitializedRef.current) {
        return;
      }
      
      spaceInitializedRef.current = true;
      
      // Set up a timeout to clear the initialization flag if it takes too long
      const initTimeout = setTimeout(() => {
        spaceInitializedRef.current = false;
      }, 15000); // 15 seconds timeout
      
      try {
        const currentStatus = await getSpaceStatus();
        
        if (currentStatus === 'idle') {
          try {
            // Try to initialize with the ID from the URL
            await initialize(spaceId!);
            // Initialization successful, clear the timeout
            clearTimeout(initTimeout);
            
            // Register this tab as viewing this space
            window.addEventListener('beforeunload', () => {
              // This helps with cleanup when the tab is closed
              localStorage.setItem(`SPACE_CLOSING_${spaceId}_${tabSpaceId}`, 'true');
            });
          } catch (error) {
            // If space doesn't exist or initialization fails for any reason,
            // just redirect to create a fresh space
            console.error('[SpaceWrapper] Failed to initialize space:', error);
            spaceInitializedRef.current = false; // Reset for future attempts
            clearTimeout(initTimeout);
            navigate('/new');
          }
        } else {
          // We're already in a non-idle state, clear the timeout
          clearTimeout(initTimeout);
        }
      } catch (error) {
        console.error('[SpaceWrapper] Error checking space status:', error);
        clearTimeout(initTimeout);
        spaceInitializedRef.current = false;
        navigate('/new');
      }
    };

    init();

    return () => {
      // Only clean up once per mount/unmount cycle and only for the current space
      if (!cleanupDoneRef.current && currentSpaceId === spaceId) {
        console.log(`[SpaceWrapper] Cleaning up for space: ${currentSpaceId} in tab ${tabSpaceId}`);
        
        try {
          // Use a specific disconnection instead of disconnecting all
          // This is safer for multi-tab scenarios
          localStorage.setItem(`SPACE_CLOSING_${spaceId}_${tabSpaceId}`, 'true');
          
          setTimeout(() => {
            try {
              // Only clean up entity store (which is tab-specific)
              useEntityStore.getState().cleanup();
              
              // Disconnect just this tab's connection to the space
              // instead of disconnecting all connections
              spaceCRDTService.disconnectSpace(spaceId, tabSpaceId);
              
              // Clean up our tracking
              localStorage.removeItem(`SPACE_CLOSING_${spaceId}_${tabSpaceId}`);
              
              console.log(`[SpaceWrapper] Cleanup complete for space: ${currentSpaceId} in tab ${tabSpaceId}`);
            } catch (e) {
              console.warn('[SpaceWrapper] Error during final cleanup:', e);
            }
          }, 0);
        } catch (err) {
          console.warn('[SpaceWrapper] Error during cleanup:', err);
        }
        
        spaceInitializedRef.current = false;
        cleanupDoneRef.current = true;
      } else {
        console.log('[SpaceWrapper] Skipping cleanup (already done or different space)');
      }
    };
  }, [getSpaceStatus, initialize, navigate, spaceId]);

  return spaceId ? (
    <>
      <Space id={spaceId} />
      {showDebugger && <DebuggerPanel />}
    </>
  ) : null;
};

export default SpaceWrapperPage;
