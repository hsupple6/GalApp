// TOP LEVEL COMPONENT **************** //
// ************************************ //
import React, { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { AppRegistry } from './AppRegistry'; // Registry for available apps
import ChatApp from './apps/ChatApp/ChatApp';
import ConsoleApp from './apps/ConsoleApp';
import EntityBrowser from './apps/EntityBrowserApp/EntityBrowserApp';
import LoginPage from './pages/LoginPage';

const System = () => {
  const [bootComplete, setBootComplete] = useState(false);
  const [openApps, setOpenApps] = useState<string[]>([]); // Manage open apps by ID
  const [checkingAuth, setCheckingAuth] = useState(true); // Add a loading state for checking authentication
  const [authToken, setAuthToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // On component mount, check for the auth token and determine if boot is complete
  useEffect(() => {
    console.debug('System.tsx - useEffect - authToken');
    const token = localStorage.getItem('authToken');
    if (token) {
      setAuthToken(token);
      setBootComplete(true); // Skip boot if authenticated
    }
    setCheckingAuth(false); // Stop the loading state once the check is done
  }, []); // Dependency array ensures this runs only once when the component mounts

  // Check if the current path is for standalone apps (i.e., path starts with '/app')
  const isStandaloneApp = location.pathname.startsWith('/app');
  // If the user is accessing standalone apps, don't render the system (GUI)
  if (isStandaloneApp) {
    return null;
  }

  // Open app by app ID
  const openApp = (appId: string) => {
    if (!openApps.includes(appId)) {
      setOpenApps([...openApps, appId]); // Add the app ID to open apps

      // Only navigate if the app is not already in the URL
      if (window.location.pathname !== `/${appId}`) {
        navigate(`/${appId}`);
      }
    }
  };

  // Close app by app ID
  const closeApp = (appId: string) => {
    setOpenApps(openApps.filter((id) => id !== appId)); // Remove app ID from open apps

    // Only navigate to root if this was the last app open
    if (openApps.length === 1) {
      navigate('/');
    }
  };

  // Function to handle logout
  const handleLogout = () => {
    localStorage.removeItem('authToken'); // Remove token from local storage
    setAuthToken(null); // Clear auth token from state

    navigate('/');
    // window.location.reload(); // Reload the page (you can also redirect to a login page)
  };

  if (checkingAuth) {
    return <div className="loading">Loading...</div>; // You can replace this with a spinner or custom component
  }

  return (
    <>
      {!bootComplete ? (
        <LoginPage />
      ) : (
        <div className={`desktop ${openApps.length > 0 ? 'blurred' : ''}`}>
          {openApps.length === 0 && (
            <button onClick={handleLogout} className="logoutButton">
              Log Out
            </button>
          )}
          <div className="appButtons">
            {/* Buttons for launching apps */}
            <button onClick={() => openApp('chat')}>Chat</button>
            <button onClick={() => openApp('system')}>System Viewer</button>
            <button onClick={() => openApp('console')}>Console</button>
          </div>

          {openApps.length > 0 && (
            <div className="group">
              {/* Dynamically render open apps */}
              {openApps.map((appId) => {
                // Get the app component from the registry
                const app = AppRegistry[appId];
                if (app && app.component) {
                  const { component: AppComponent, title } = app;
                  return <AppComponent key={appId} onClose={() => closeApp(appId)} title={title} />;
                }
                return null;
              })}
            </div>
          )}
          {/* URL-based routing within the System */}
          <Routes>
            {/* <Route path="/" element={<System />} /> */}
            <Route path="/system/chat" element={<ChatApp onClose={() => {}} title="Chat" />} />
            {/*<Route*/}
            {/*    path="/system/pdf"*/}
            {/*    element={<PDFApp onClose={() => {}} title="Pdf" />}*/}
            {/*/>*/}
            <Route
              path="/system/viewer"
              element={
                <EntityBrowser windowId="system-viewer" spaceId="system" onClose={() => {}} title="Entity Browser" />
              }
            />
            <Route path="/system/console" element={<ConsoleApp onClose={() => {}} title="Console" />} />
            {/* <Route path="*" element={<ChatApp onClose={() => {}} title="Chat" />} /> Default to Chat */}
          </Routes>
        </div>
      )}
    </>
  );
};

export default System;
