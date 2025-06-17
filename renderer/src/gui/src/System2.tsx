import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import Space from './components/Space/Space';
import LoginPage from './pages/LoginPage';
import { spaceCRDTService } from './services/crdt/spaceCRDTService';
import useEntityStore from './stores/entityStore';
import useSpaceStore from './stores/spaceStore';
import useUserStore from './stores/userStore';

const LOCAL_STORAGE_SPACE_ID_KEY = 'spaceId';

const System2 = () => {
  const [bootComplete, setBootComplete] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { spaceId } = useParams();
  const setAuth0Id = useUserStore(state => state.setAuth0Id);

  const { initialize, fetchEntities } = useEntityStore();
  const { getSpaceStatus, initialize: initializeSpace } = useSpaceStore();

  useEffect(() => {
    const init = async () => {
      if (!spaceId) {
        // Create new space if on root path
        try {
          // const newSpace = await spaceService.createSpace('New Space');
          // navigate(`/spaces/${newSpace.id}`, { replace: true });
        } catch (error) {
          console.error('Failed to create space:', error);
        }
        return;
      }

      const currentStatus = await getSpaceStatus();
      if (currentStatus === 'idle') {
        try {
          await initializeSpace(spaceId);
          await initialize(spaceId);
          await fetchEntities();
        } catch (error) {
          console.error('Failed to initialize:', error);
          navigate('/home');
        }
      }
    };

    init();

    return () => {
      if (spaceId) {
        useEntityStore.getState().cleanup();
        spaceCRDTService.disconnectAll();
      }
    };
  }, [spaceId]);

  // Auth check on mount
  useEffect(() => {
    console.log('[System2] Checking auth...');
    const token = localStorage.getItem('authToken');
    if (token) {
      console.log('[System2] Found auth token');
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('[System2] Extracted auth0Id:', payload.sub);
        setAuth0Id(payload.sub);
      } catch (error) {
        console.error('[System2] Error parsing auth token:', error);
      }
      setAuthToken(token);
      setBootComplete(true);
    } else {
      console.log('[System2] No auth token found');
    }
    setCheckingAuth(false);
  }, [setAuth0Id]);

  // Skip rendering for standalone apps
  const isStandaloneApp = location.pathname.startsWith('/app');
  if (isStandaloneApp) return null;

  if (checkingAuth) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      {!bootComplete ? (
        <LoginPage />
      ) : (
        <div className="desktop">
          {spaceId ? <Space id={spaceId} /> : null}
        </div>
      )}
    </>
  );
};

export default System2;
