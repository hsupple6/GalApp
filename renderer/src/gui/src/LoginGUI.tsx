// import './LoginGUI.scss';

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { API_BASE_URL } from './api/config';
import { ReactComponent as Logo } from './assets/logoBootUp.svg';
import useUserStore from './stores/userStore';
import './LoginGUI.scss';
import { logger } from './utils/logger';

const bootMessages = [
  'Welcome...',
  '✅ Initializing models...',
  '✅ Loading entity system...',
  '✅ Connecting to external data...',
  '✅ Verifying system integrity...',
  '✅ Boot complete. Entering GalOS...',
];

const LoginGUI = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false); // Track authentication state
  const [bootStarted, setBootStarted] = useState(false);
  const [currentMessage, setCurrentMessage] = useState(0);
  const [usernameOrEmail, setUsername] = useState(''); // User input
  const [password, setPassword] = useState(''); // User input
  const [error, setError] = useState(''); // Error message display
  const setAuth0Id = useUserStore(state => state.setAuth0Id);

  useEffect(() => {
    logger.log('[LoginGUI] Checking for existing token...');
    const token = localStorage.getItem('authToken');
    if (token) {
      logger.log('[LoginGUI] Found existing token');
      // If a token exists, extract auth0Id and set it
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        logger.log('[LoginGUI] Extracted auth0Id:', payload.sub);
        setAuth0Id(payload.sub);
        
        // Instead of relying on side effect in setAuth0Id, call fetchUsage explicitly
        setTimeout(() => {
          try {
            logger.log('[LoginGUI] Explicitly fetching user usage');
            useUserStore.getState().fetchUsage().catch(err => {
              logger.error('[LoginGUI] Error fetching usage (non-blocking):', err);
              // Don't block authentication on usage fetch failures
            });
          } catch (error) {
            logger.error('[LoginGUI] Error during explicit usage fetch:', error);
          }
        }, 1000); // Delay fetch to avoid race conditions
      } catch (error) {
        logger.error('[LoginGUI] Error parsing auth token:', error);
      }
      setIsAuthenticated(true);
      setBootStarted(true);
    } else {
      logger.log('[LoginGUI] No existing token found');
    }
  }, [setAuth0Id]);

  // Simulate the boot process with timed intervals
  useEffect(() => {
    if (bootStarted) {
      logger.log('[LoginGUI] Boot process started');
      const interval = setInterval(() => {
        if (currentMessage < bootMessages.length - 1) {
          setCurrentMessage(currentMessage + 1);
        } else {
          clearInterval(interval);
          setTimeout(() => {
            navigate(`/new`, { replace: true });
          }, 500); // Delay before entering the desktop
        }
      }, 1000); // 1 second between each message

      return () => clearInterval(interval);
    }
  }, [bootStarted, currentMessage, navigate]);

  // Start the boot process after authentication
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.log('[LoginGUI] Attempting login...');
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        // Call the backend, not Auth0 directly
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: usernameOrEmail,
          password: password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        logger.log('[LoginGUI] Login successful, saving token');
        // IMPT: Save the token
        localStorage.setItem('authToken', data.access_token);
        
        // Extract and set auth0Id from token
        try {
          const payload = JSON.parse(atob(data.access_token.split('.')[1]));
          logger.log('[LoginGUI] Extracted auth0Id from new token:', payload.sub);
          setAuth0Id(payload.sub);
        } catch (error) {
          logger.error('[LoginGUI] Error parsing new auth token:', error);
        }
        
        setIsAuthenticated(true); // Mark as authenticated
        setTimeout(() => setBootStarted(true), 1000); // Start boot after login
      } else {
        const errorData = await response.json();
        logger.error('[LoginGUI] Login failed:', errorData);
        setError(errorData.error_description || 'Invalid login credentials');
      }
    } catch (err) {
      logger.error('[LoginGUI] Login error:', err);
      if (err instanceof Error) {
        logger.error(err.message); // Log the error message
        setError(`An error occurred: ${err.message}`); // Show the error message to the user
      } else {
        logger.error('Unexpected error:', err); // Handle other unexpected errors
        setError('An unexpected error occurred.');
      }
    }
  };

  return (
    <div className="bootScreen">
      <div className="heroPicture">
        <div className="bio">
          <div className="nameBirth">
            <div className="name">Anna Fisher</div>
            <div className="birth">b. 1949</div>
          </div>
          American chemist, emergency physician, and NASA astronaut.
        </div>
      </div>
      <div className="bootArea">
        <Link to="/">
          <div className="bootLogo">
            <Logo className="symbol" />
            <h1 className="wordmark">GalOS</h1>
          </div>
        </Link>

        {!isAuthenticated && (
          <div className="authentication">
            <form onSubmit={handleLogin}>
              <input
                type="text"
                placeholder="Username"
                value={usernameOrEmail}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <p className="error">{error}</p>}
              <button type="submit">Log In</button>
            </form>
          </div>
        )}
        {bootStarted && (
          <div className="bootProgress">
            <div className="bootLoader">
              <div
                className="progressBar"
                style={{ width: `${(currentMessage / (bootMessages.length - 1)) * 100}%` }}
              />
            </div>
            <div className="bootMessages">
              {bootMessages.slice(0, currentMessage + 1).map((message, index) => (
                <p key={index}>{message}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginGUI;
