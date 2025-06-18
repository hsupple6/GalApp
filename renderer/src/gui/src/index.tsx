// index.tsx
import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';

import App from './App';
import AppRouter from './AppRouter';
import reportWebVitals from './reportWebVitals';
import { unregisterActions } from './services/actionService';

unregisterActions();

// This component conditionally renders either the System or the AppRouter based on the URL path
const AppEntry = () => {
  const location = useLocation();

  // If the URL starts with /app or /system2, render standalone apps via AppRouter
  if (location.pathname.startsWith('/app') || location.pathname.startsWith('/system2')) {
    return <AppRouter />;
  }

  // Otherwise render the main App with new space-based routing
  return <App />;
};

// Component to handle token storage
const TokenHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  React.useEffect(() => {
    const storeToken = async () => {
      if (!isAuthenticated) {
        console.log('User is not authenticated, skipping token storage');
        return;
      }

      try {
        console.log('Attempting to get access token silently...');
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: process.env.REACT_APP_AUTH0_AUDIENCE || '',
            scope: 'openid profile email offline_access'
          }
        });
        console.log('Successfully got access token');
        localStorage.setItem('authToken', token);
      } catch (error) {
        console.error('Error getting token:', error);
        // Clear any existing token if there's an error
        localStorage.removeItem('authToken');
      }
    };

    storeToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  return <>{children}</>;
};

// Add simple login method as alternative
const loginWithCredentials = async (username: string, password: string) => {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('authToken', data.access_token);
      
      if (data.user) {
        // Handle setting user data
      }
    } else {
      throw new Error('Invalid credentials');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// const portalRoot = document.createElement('div');

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Auth0Provider
        domain={process.env.REACT_APP_AUTH0_DOMAIN || ''}
        clientId={process.env.REACT_APP_AUTH0_CLIENT_ID || ''}
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience: process.env.REACT_APP_AUTH0_AUDIENCE || '',
          scope: 'openid profile email offline_access',
        }}
        useRefreshTokens={true}
        cacheLocation="localstorage"
        onRedirectCallback={(appState) => {
          // Navigate to '/new' after successful authentication if no specific returnTo is provided
          window.history.replaceState(
            {},
            document.title,
            appState?.returnTo || '/new'
          );
        }}
      >
        <TokenHandler>
          <AppEntry />
        </TokenHandler>
      </Auth0Provider>
    </BrowserRouter>
  </React.StrictMode>,
);

reportWebVitals();
