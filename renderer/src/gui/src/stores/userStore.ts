import { create } from 'zustand';
import fetchService from '../services/fetchService';
import { logger } from '../utils/logger';

interface UserUsage {
  query_count: number;
  last_reset: string;
  limit: number;
  remaining_queries: number;
  auth0_id?: string;
  deploymentType?: string;
}

interface UserState {
  auth0Id: string | null;
  usage: UserUsage | null;
  deploymentType: string;
  setAuth0Id: (id: string) => void;
  setUsage: (usage: UserUsage) => void;
  setDeploymentType: (type: string) => void;
  fetchUsage: () => Promise<void>;
  
  // Debug helpers
  debugStore: () => void;
  getDebugInfo: () => {
    auth0Id: string | null;
    deploymentType: string;
    usage: UserUsage | null;
    hasToken: boolean;
    tokenExpiry: string | null;
  };
}

logger.log('[userStore] Creating store...');

const useUserStore = create<UserState>((set, get) => ({
  auth0Id: null,
  usage: null,
  deploymentType: '',

  setAuth0Id: (id: string) => {
    logger.log('[userStore] Setting auth0Id:', id);
    set({ auth0Id: id });
    // Fetch usage when auth0Id is set
    get().fetchUsage();
  },

  setUsage: (usage: UserUsage) => {
    logger.log('[userStore] Setting usage:', usage);
    set({ usage });
    
    // If deploymentType is included in the usage response, update it
    if (usage.deploymentType) {
      set({ deploymentType: usage.deploymentType });
      logger.log('[userStore] Updated deploymentType from usage:', usage.deploymentType);
    }
  },
  
  setDeploymentType: (type: string) => {
    logger.log('[userStore] Setting deployment type:', type);
    set({ deploymentType: type });
  },

  fetchUsage: async () => {
    logger.log('[userStore] Fetching usage...');
    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';
      const url = `${API_BASE_URL}/api/user/usage`;
      logger.log('[userStore] Request URL:', url);
      
      // Get the auth token from localStorage
      const token = localStorage.getItem('authToken');
      if (!token) {
        logger.error('[userStore] No auth token found');
        return;
      }
      
      logger.log('[userStore] Found auth token');
      
      // Use fetchService instead of raw fetch to maintain consistency
      try {
        const usage = await fetchService(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        logger.log('[userStore] Parsed usage data:', usage);
        set({ usage });
        
        // Update deployment type if available
        if (usage.deploymentType) {
          set({ deploymentType: usage.deploymentType });
          logger.log('[userStore] Updated deploymentType from API:', usage.deploymentType);
        }
        
        // If auth0_id is in the response but auth0Id in store is null, update it
        if (usage.auth0_id && !get().auth0Id) {
          set({ auth0Id: usage.auth0_id });
          logger.log('[userStore] Updated auth0Id from API response:', usage.auth0_id);
        }
      } catch (error) {
        logger.error('[userStore] Error fetching or parsing usage data:', error);
        throw error;
      }
    } catch (error) {
      logger.error('[userStore] Error fetching user usage:', error);
      if (error instanceof Error) {
        logger.error('[userStore] Error details:', error.message);
      }
    }
  },
  
  // Debug helper function to log the current state
  debugStore: () => {
    const { auth0Id, usage, deploymentType } = get();
    const token = localStorage.getItem('authToken');
    
    logger.group('🔍 UserStore Debug Info');
    logger.log('auth0Id:', auth0Id);
    logger.log('deploymentType:', deploymentType);
    logger.log('usage:', usage);
    logger.log('hasToken:', !!token);
    
    if (token) {
      try {
        // Try to parse the token to get the expiry time
        const payload = JSON.parse(atob(token.split('.')[1]));
        logger.log('token.sub:', payload.sub);
        logger.log('token.exp:', new Date(payload.exp * 1000).toLocaleString());
        logger.log('token expiry in:', (payload.exp * 1000 - Date.now()) / 1000 / 60, 'minutes');
      } catch (error) {
        logger.error('Error parsing token:', error);
      }
    }
    
    logger.groupEnd();
  },
  
  // Return debug info for UI display
  getDebugInfo: () => {
    const { auth0Id, usage, deploymentType } = get();
    const token = localStorage.getItem('authToken');
    let tokenExpiry = null;
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        tokenExpiry = new Date(payload.exp * 1000).toLocaleString();
      } catch {
        tokenExpiry = 'Error parsing token';
      }
    }
    
    return {
      auth0Id,
      deploymentType,
      usage,
      hasToken: !!token,
      tokenExpiry
    };
  }
}));

export default useUserStore; 