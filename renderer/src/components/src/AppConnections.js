import './AppConnections.css';
import { useState, useEffect } from 'react';
import {
  AUTH0_CONFIG,
  getAllUsers,
  getActiveUser,
  switchUser,
  removeUser,
  saveUserToken,
  parseToken,
  createAuth0LoginUrl,
  exchangeCodeForToken,
  getTokenForUser,
  debugTokens
} from './tokenUtils';
import { updateGalBoxIP } from '../../utils/envUpdater';

function AppConnections({ setCurrentView, currentView }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [selectedIP, setSelectedIP] = useState(null);
  const [galaxies, setGalaxies] = useState([]);
  const [galboxIP, setGalboxIP] = useState(null);

  // Load existing users on component mount
  useEffect(() => {
    loadUsers();
    loadActiveUser();
    loadGalaxies();
  }, []);

  const loadUsers = () => {
    try {
      const userList = getAllUsers();
      setUsers(userList);
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Failed to load saved users');
    }
  };

  const loadActiveUser = () => {
    const user = getActiveUser();
    setActiveUser(user);
  };

  const loadGalaxies = () => {
    window.electronAPI.getGalaxies().then(galaxies => {
      if (typeof galaxies === 'string') {
        try {
          galaxies = JSON.parse(galaxies);
        } catch {
          galaxies = [];
        }
      }
      setGalaxies(Array.isArray(galaxies) ? galaxies : []);
      if (Array.isArray(galaxies) && galaxies.length > 0) {
        setGalboxIP(galaxies[0].ip);
      }
    });
  };

  const handleNewConnection = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Create Auth0 login URL
      const authUrl = createAuth0LoginUrl();
      
      // Open Auth0 login in a popup
      const popup = window.open(
        authUrl,
        'auth0-login',
        'width=400,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for the popup to close and check for token
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          handleAuth0Callback();
        }
      }, 1000);

    } catch (error) {
      console.error('Error starting Auth0 login:', error);
      setError('Failed to start authentication');
      setIsLoading(false);
    }
  };

  const handleAuth0Callback = async () => {
    try {
      // Check if we have a token in localStorage (set by Auth0 callback)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code) {
        // Exchange code for token
        const tokenData = await exchangeCodeForToken(code);
        
        if (tokenData) {
          // Parse token to get user info
          const userInfo = parseToken(tokenData.access_token);
          
          // Save user token
          const success = saveUserToken(userInfo.sub, tokenData.access_token, userInfo);
          
          if (success) {
            // Reload users list
            loadUsers();
            loadActiveUser();
            
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            setError('Failed to save user token');
          }
        }
      }
    } catch (error) {
      console.error('Error handling Auth0 callback:', error);
      setError('Failed to complete authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchUser = (userId) => {
    const success = switchUser(userId);
    if (success) {
      loadActiveUser();
    } else {
      setError('Failed to switch user');
    }
  };

  const handleRemoveUser = (userId) => {
    const success = removeUser(userId);
    if (success) {
      loadUsers();
      loadActiveUser();
    } else {
      setError('Failed to remove user');
    }
  };

  const handleCopyToken = () => {
    if (activeUser) {
      const token = getTokenForUser(activeUser.id);
      if (token) {
        navigator.clipboard.writeText(token);
        alert('Token copied to clipboard!');
      }
    }
  };

  const handleDebugTokens = () => {
    debugTokens();
  };

  const handleOpenGalOS = async (ip, galID) => {
    if (setCurrentView) setCurrentView('connecting');
    setSelectedIP(ip);
    console.log('handleOpenGalOS called with:', ip);

    const response = await window.electronAPI.pingip(ip);
    let isGalBox = false;
    new Promise(resolve => setTimeout(resolve, 5000));

    if (response) {
      try {
        const json = typeof response === 'string' ? JSON.parse(response) : response;
        isGalBox = json.device === 'GalBox';
      } catch (e) {
        isGalBox = false;
      }
    }

    if (isGalBox) {
      setCurrentView('galos-gui');
      return;
    } else {
      const discovered = await window.electronAPI.discoverGalboxIPs();
      if (discovered) {
        const found = discovered.find(item => item.galID === galID);
        if (found) {
          await window.electronAPI.updateGalBoxIP(ip, found.ip);
          await window.electronAPI.updateEnvFile('REACT_APP_GALBOX_IP', found.ip);
          if (setCurrentView) setCurrentView('galos-gui');
        } else {
          alert('Galbox not found on network!');
        }
      } else {
        alert('Galbox not found on network!');
      }
    }
  };

  return (
    <div className="app-connections-body">
      {galaxies.length === 0 ? (
        <div>No galaxies found.</div>
      ) : (
        <ul>
          {galaxies.map((galaxy, idx) =>
            galaxy.ip && galaxy.galID ? (
              <li key={idx} className="connections-container-border" style={{ width: '100%' }}>
                <div className="galaxy-connection-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span>IP: {galaxy.ip} | galID: {galaxy.galID}</span>
                  <button 
                    className="join-galos-button"
                    onClick={async () => await handleOpenGalOS(galaxy.ip, galaxy.galID)}
                  >
                    🖥️ Open galOS GUI
                  </button>
                </div>
              </li>
            ) : null
          )}
        </ul>
      )}
    </div>
  );
}

export default AppConnections;
