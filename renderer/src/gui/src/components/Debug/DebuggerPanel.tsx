import './DebuggerPanel.scss';

import React, { useEffect, useState } from 'react';

import { crdtServiceWS } from '../../services/crdt/crdtServiceWS';
import { useAppRegistryStore } from '../../stores/appRegistryStore';
import useEntityStore from '../../stores/entityStore';
import type { SpaceStore } from '../../stores/spaceStore';
import useSpaceStore from '../../stores/spaceStore';
import useUserStore from '../../stores/userStore';
import { API_BASE_URL } from '../../api/config';

interface DBInfo {
  connectionType: 'local' | 'atlas' | 'unknown';
  databases: string[];
  collections: Record<string, number>;
}

interface DebugInfo {
  docs: Array<{ 
    key: string, 
    clientId: number, 
    totalClients: number
  }>;
  providers: Array<{ 
    roomName: string, 
    connected: boolean, 
    remotePeers: number
  }>;
  dbInfo?: DBInfo;
  states?: any[];
}

type DeploymentType = 'local' | 'production' | 'development' | 'staging' | 'unknown';

// Interface for userStore debug info
interface UserStoreDebugInfo {
  auth0Id: string | null;
  deploymentType: string;
  usage: any | null;
  hasToken: boolean;
  tokenExpiry: string | null;
}

// Interface for tracking Zustand store states
interface ZustandStoreStates {
  spaceStore: any;
  entityStore: any;
  userStore: any;
  appRegistryStore: any;
  // Add other stores as needed
}

export const DebuggerPanel: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    docs: [],
    providers: [],
    states: []
  });

  const [deploymentType, setDeploymentType] = useState<DeploymentType>('unknown');
  const [dbConnectionInfo, setDbConnectionInfo] = useState<DBInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userStoreDebugInfo, setUserStoreDebugInfo] = useState<UserStoreDebugInfo | null>(null);
  const [zustandStores, setZustandStores] = useState<ZustandStoreStates>({
    spaceStore: {},
    entityStore: {},
    userStore: {},
    appRegistryStore: {}
  });

  // Get references to all store states
  const spaceId = useSpaceStore((state: SpaceStore) => state.activeSpace?.id);
  const apps = useAppRegistryStore(state => state.apps);
  const entities = useEntityStore(state => state.entities);
  const userStore = useUserStore();
  const { deploymentType: userDeploymentType, auth0Id, usage, debugStore, getDebugInfo } = userStore;

  // Helper to safely stringify objects with circular references
  const safeStringify = (obj: any, label = 'Object') => {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      }, 2);
    } catch (error) {
      return `Error stringifying ${label}: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  // Force the debugStore function to run once on mount
  useEffect(() => {
    // Log user store debug info to console
    debugStore();
    
    // Update the debug info every second
    const updateUserStoreDebug = () => {
      setUserStoreDebugInfo(getDebugInfo());
    };
    
    updateUserStoreDebug();
    const interval = setInterval(updateUserStoreDebug, 1000);
    
    return () => clearInterval(interval);
  }, [debugStore, getDebugInfo]);

  useEffect(() => {
    // Check if user is authenticated via localStorage token
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsAuthenticated(true);
      
      // Try to parse the token to get auth0Id if it's not already set
      if (!auth0Id) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.sub) {
            // If auth0Id is not set in userStore but exists in token,
            // manually trigger the setAuth0Id function
            userStore.setAuth0Id(payload.sub);
          }
        } catch (error) {
          console.error('[DebuggerPanel] Error parsing token:', error);
        }
      }
    }
    
    // Use the deploymentType from userStore if available, otherwise fall back to URL detection
    if (userDeploymentType) {
      setDeploymentType(userDeploymentType as DeploymentType);
    }

    // Fetch DB info if in development mode
    if (process.env.NODE_ENV === 'development') {
      const fetchDBInfo = async () => {
        try {
          const token = localStorage.getItem('authToken');
          if (!token) {
            console.log('No auth token found, skipping DB info fetch');
            return;
          }
          
          const response = await fetch(`${API_BASE_URL}/debug/db-info`, {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const dbInfo = await response.json();
            setDbConnectionInfo(dbInfo);
          } else {
            console.error('Failed to fetch DB info:', response.status, response.statusText);
            const text = await response.text();
            console.error('Response:', text);
          }
        } catch (error) {
          console.error('Failed to fetch DB info:', error);
        }
      };
      
      fetchDBInfo();
    }
  }, [userDeploymentType, auth0Id, userStore]);

  useEffect(() => {
    const updateInfo = async () => {
      const info: DebugInfo = {
        docs: Array.from(crdtServiceWS.getActiveDocs()).map(([key, doc]) => ({
          key,
          clientId: doc.clientID,
          totalClients: doc.store.clients.size
        })),
        providers: Array.from(crdtServiceWS.getActiveProviders()).map(([key, provider]) => ({
          roomName: provider.roomname,
          connected: provider.wsconnected,
          remotePeers: provider.awareness.getStates().size
        })),
        dbInfo: dbConnectionInfo || undefined
      };
      setDebugInfo(info);
    };

    // Update every second
    const interval = setInterval(updateInfo, 1000);
    updateInfo();

    return () => clearInterval(interval);
  }, [dbConnectionInfo]);

  // New effect to update Zustand store states
  useEffect(() => {
    const updateStoreStates = () => {
      // Get a snapshot of each store's current state
      const spaceStoreState = useSpaceStore.getState();
      const entityStoreState = useEntityStore.getState();
      const userStoreState = useUserStore.getState();
      const appRegistryStoreState = useAppRegistryStore.getState();
      
      setZustandStores({
        spaceStore: { ...spaceStoreState },
        entityStore: { ...entityStoreState },
        userStore: { ...userStoreState },
        appRegistryStore: { ...appRegistryStoreState }
      });
    };
    
    updateStoreStates();
    const interval = setInterval(updateStoreStates, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Helper function to manually refresh the userStore
  const handleRefreshUserStore = () => {
    console.log('Manually refreshing userStore...');
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userStore.setAuth0Id(payload.sub);
        userStore.fetchUsage();
      } catch (error) {
        console.error('Error parsing token during manual refresh:', error);
      }
    }
    debugStore();
  };

  return (
    <div className="yjs-debugger">
      <div className={`debug-header`}>
        === Debugger Panel [{deploymentType}] =========
      </div>
      
      <div className="debug-section">
        <strong>UserStore Debug: </strong>
        <button 
          onClick={handleRefreshUserStore} 
          style={{ 
            marginLeft: '5px', 
            background: 'rgba(59, 130, 246, 0.3)', 
            border: 'none', 
            padding: '2px 5px', 
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Refresh
        </button>
        <table className="debug-table">
          <tbody>
            <tr>
              <td>Auth Token:</td>
              <td className={isAuthenticated ? 'active' : 'muted'}>
                {isAuthenticated ? 'Present' : 'Missing'}
              </td>
            </tr>
            <tr>
              <td>Token Expiry:</td>
              <td className={userStoreDebugInfo?.tokenExpiry ? 'active' : 'muted'}>
                {userStoreDebugInfo?.tokenExpiry || 'Unknown'}
              </td>
            </tr>
            <tr>
              <td>auth0Id in UserStore:</td>
              <td className={userStoreDebugInfo?.auth0Id ? 'active' : 'muted'}>
                {userStoreDebugInfo?.auth0Id || 'Not set'}
              </td>
            </tr>
            <tr>
              <td>deploymentType in UserStore:</td>
              <td className={`deployment-indicator ${userStoreDebugInfo?.deploymentType || 'unknown'}`}>
                {userStoreDebugInfo?.deploymentType || 'Not set'}
              </td>
            </tr>
            <tr>
              <td>Usage Data:</td>
              <td className={userStoreDebugInfo?.usage ? 'active' : 'muted'}>
                {userStoreDebugInfo?.usage ? 'Loaded' : 'Not loaded'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="debug-section">
        <strong>Environment:</strong>
        <table className="debug-table">
          <tbody>
            <tr>
              <td>Deployment Type:</td>
              <td className={`deployment-indicator ${deploymentType}`}>{deploymentType}</td>
            </tr>
            <tr>
              <td>Auth0 ID:</td>
              <td className={auth0Id ? 'active' : 'muted'}>
                {auth0Id || (isAuthenticated ? 'Authenticated (ID not loaded)' : 'Not authenticated')}
              </td>
            </tr>
            <tr>
              <td>Environment:</td>
              <td>{process.env.NODE_ENV}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="debug-section">
        <strong>Entities:</strong> {Object.keys(entities).length} total
      </div>
      
      <div className="debug-section">
        <strong>User Usage:</strong>
        <table className="debug-table">
          <thead>
            <tr>
              <th>Queries Used</th>
              <th>Remaining</th>
              <th>Limit</th>
              <th>Last Reset</th>
            </tr>
          </thead>
          <tbody>
            {usage && (
              <tr>
                <td>{usage.query_count}</td>
                <td className={usage.remaining_queries > 0 ? 'active' : 'muted'}>
                  {usage.remaining_queries}
                </td>
                <td>{usage.limit}</td>
                <td className="muted">
                  {new Date(usage.last_reset).toLocaleDateString()}
                </td>
              </tr>
            )}
            {!usage && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: 'center' }}>No usage data available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {debugInfo.dbInfo && (
        <div className="debug-section">
          <strong>Database:</strong>
          <table className="debug-table">
            <tbody>
              <tr>
                <td>Connection Type:</td>
                <td className={debugInfo.dbInfo.connectionType === 'local' ? 'muted' : 'active'}>
                  {debugInfo.dbInfo.connectionType}
                </td>
              </tr>
              <tr>
                <td>Databases:</td>
                <td>{debugInfo.dbInfo.databases.join(', ')}</td>
              </tr>
            </tbody>
          </table>
          
          {Object.keys(debugInfo.dbInfo.collections).length > 0 && (
            <>
              <strong className="sub-header">Collections:</strong>
              <table className="debug-table">
                <thead>
                  <tr>
                    <th>Collection</th>
                    <th className="right">Documents</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(debugInfo.dbInfo.collections).map(([collection, count]) => (
                    <tr key={collection}>
                      <td>{collection}</td>
                      <td className="right">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
      
      <div className="debug-section">
        <strong>Installed Apps:</strong>
        <table className="debug-table">
          <thead>
            <tr>
              <th>App</th>
              <th>ID</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(apps).map(([appId, app]) => (
              <tr key={appId}>
                <td>{app.skeleton.icon} {app.skeleton.name}</td>
                <td className="muted">{appId}</td>
                <td>
                  <span className={`flag ${app.skeleton.requiresProps ? 'active' : ''}`}>⚡</span>
                  <span className={`flag ${app.skeleton.requiresEntity ? 'active' : ''}`}>📄</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="debug-section">
        <strong>Active Yjs Docs:</strong>
        <table className="debug-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Client ID</th>
              <th className="right">Clients</th>
            </tr>
          </thead>
          <tbody>
            {debugInfo.docs.map(doc => (
              <tr key={doc.key}>
                <td>{doc.key}</td>
                <td className="muted">{doc.clientId}</td>
                <td className="right">{doc.totalClients}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="debug-section">
        <strong>Active Yjs Providers:</strong>
        <table className="debug-table">
          <thead>
            <tr>
              <th>Room</th>
              <th className="center">Status</th>
              <th className="right">Peers</th>
            </tr>
          </thead>
          <tbody>
            {debugInfo.providers.map(provider => (
              <tr key={provider.roomName}>
                <td>{provider.roomName}</td>
                <td className="center">{provider.connected ? '🟢' : '🔴'}</td>
                <td className={`right ${provider.remotePeers > 0 ? 'active-peers' : 'muted'}`}>
                  {provider.remotePeers}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="debug-section">
        <strong>Active Zustand Stores:</strong>
        
        {/* Space Store */}
        <div className="zustand-store-section">
          <h4 style={{ marginBottom: '5px', marginTop: '10px' }}>Space Store</h4>
          <pre className="space-data">
            {safeStringify(zustandStores.spaceStore, 'Space Store')}
          </pre>
        </div>
        
        {/* Entity Store */}
        <div className="zustand-store-section">
          <h4 style={{ marginBottom: '5px', marginTop: '10px' }}>Entity Store</h4>
          <pre className="space-data">
            {safeStringify(zustandStores.entityStore, 'Entity Store')}
          </pre>
        </div>
        
        {/* User Store */}
        <div className="zustand-store-section">
          <h4 style={{ marginBottom: '5px', marginTop: '10px' }}>User Store</h4>
          <pre className="space-data">
            {safeStringify(zustandStores.userStore, 'User Store')}
          </pre>
        </div>
        
        {/* App Registry Store */}
        <div className="zustand-store-section">
          <h4 style={{ marginBottom: '5px', marginTop: '10px' }}>App Registry Store</h4>
          <pre className="space-data">
            {safeStringify(zustandStores.appRegistryStore, 'App Registry Store')}
          </pre>
        </div>
      </div>
    </div>
  );
}; 