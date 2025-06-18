import './AppBody.css';
import { useState, useEffect } from 'react';
import config from '../config';

import AppConnections from './src/AppConnections';
import AppGalaxies from './src/AppGalaxies';
import ConnecttoBox from './src/ConnecttoBox';

function AppBody() {
  const [computerName, setComputerName] = useState('');
  const [currentView, setCurrentView] = useState('main');
  const [sendTimeoutNotif, setSendTimeoutNotif] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [found, setFound] = useState(true); // Set this shit to be false after bruh
  const [foundGalaxyIP, setFoundGalaxyIP] = useState(null);
  const [galosServerReady, setGalosServerReady] = useState(false);
  const [galaxies, setGalaxies] = useState([]);

  useEffect(() => {
    // Listen for computer name from main process
    if (window.electronAPI) {
      console.log('electronAPI available');
      
      // Listen for computer name event
      window.electronAPI.onComputerName((event, name) => {
        console.log('Received computer name:', name);
        setComputerName(name);
      });

      // Also try to get it directly
      window.electronAPI.getComputerName().then(name => {
        console.log('Direct computer name:', name);
        setComputerName(name);
      }).catch(err => {
        console.error('Error getting computer name:', err);
      });

      // Fetch galaxies from electron-store
      window.electronAPI.getGalaxies().then(galaxies => {
        if (typeof galaxies === 'string') {
          try {
            galaxies = JSON.parse(galaxies);
          } catch {
            galaxies = [];
          }
        }
        setGalaxies(Array.isArray(galaxies) ? galaxies : []);
      });
    } else {
      console.log('electronAPI not available');
    }
  }, []);

  // Function to send GalBox IP to galOS GUI server
  const sendGalBoxIPToGalOS = async () => {
    try {
      // Get the GalBox IP from config
      const galboxIP = process.env.GALBOX_IP;
      if (galboxIP) {
        console.log('Sending GalBox IP to galOS GUI:', galboxIP);
        const response = await fetch('http://localhost:3000/api/set-galbox-ip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ip: galboxIP }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('GalBox IP sent to galOS GUI:', result);
        } else {
          console.error('Failed to send GalBox IP to galOS GUI');
        }
      } else {
        console.log('No GalBox IP found in config');
      }
    } catch (error) {
      console.error('Error sending GalBox IP to galOS GUI:', error);
    }
  };

  // Function to check if galOS GUI server is ready
  const checkGalOSServerReady = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/galbox-ip');
      if (response.ok) {
        setGalosServerReady(true);
        return true;
      }
    } catch (error) {
      console.log('galOS GUI server not ready yet:', error.message);
    }
    return false;
  };

  // Check galOS server readiness when galOS GUI view is loaded
  useEffect(() => {
    if (currentView === 'galos-gui') {
      setGalosServerReady(false);
      
      // Try to check server readiness every 500ms for up to 10 seconds
      let attempts = 0;
      const maxAttempts = 20;
      
      const checkInterval = setInterval(async () => {
        attempts++;
        const isReady = await checkGalOSServerReady();
        
        if (isReady || attempts >= maxAttempts) {
          clearInterval(checkInterval);
          if (isReady) {
            // Send GalBox IP after server is ready
            setTimeout(() => {
              sendGalBoxIPToGalOS();
            }, 500);
          }
        }
      }, 500);
      
      return () => clearInterval(checkInterval);
    }
  }, [currentView]);

  const handleAddGalaxy = async(ssid, foundIP = null) => {
    if (foundIP) {
      // GalBox was found during connection, navigate to success page
      setCurrentView('galaxy-success');
      // Store the found IP for use in the success page
      setFoundGalaxyIP(foundIP);
    } else {
      // Normal flow - navigate to add galaxy page
      setCurrentView('add-galaxy');
      await new Promise(resolve => setTimeout(resolve, 10000));
      if (currentView !== 'main' && !found){
        setSendTimeoutNotif(true);
        handleBackToMain();
        handleNotif();
      }
    }
  };

  const handleBackToMain = () => {
    setCurrentView('main');
  };

  const handleNotif = async() => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    setIsHiding(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setSendTimeoutNotif(false);
    setIsHiding(false);
  }

  // galOS GUI View
  if (currentView === 'galos-gui') {

    return (

        <div className="galos-container">

            <iframe 
              src="http://localhost:3000" 
              title="galOS GUI"
              className="galos-iframe"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              style={{ 
                width: '100%', 
                height: '100%', 
                border: 'none',
                position: 'relative',
                zIndex: 1
              }}
            />


        </div>
    );
  }

  if (currentView === 'connecting') {
    return (
      <>
        <div className='loading-display'>
          <span className='gradient-text-small-galaxy'>
            Please Wait While We Connect . . .
          </span>
        </div>
        <div className='loading-wrapper'>
            <div className='loading-bar'></div>
        </div>
      </>
    );
  }

  // Add Galaxy View
  if (currentView === 'add-galaxy') {
    <div className="app-header">
        <div className="app-header-title">
          <span className="gradient-text">G a l O S</span>
        </div>
      </div>
    return (
      <div className="app-body">
        <ConnecttoBox />
        <button className='loading-back-button'onClick={handleBackToMain}>Back</button> 
      </div>
    );
  }

  // Galaxy Success View
  if (currentView === 'galaxy-success') {
    
    return (
      <div className="app-body">
        <div className="success-container">
          <div className="success-icon">✅</div>
          <h2 className="success-title">Galaxy Connected Successfully!</h2>
          <div className="success-details">
            <p>GalBox found at: <strong>{foundGalaxyIP}</strong></p>
            <p>Your device is now connected to the GalBox network.</p>
          </div>
          <button className="success-button" onClick={handleBackToMain}>
            Return to Main Menu
          </button>
        </div>
      </div>
    );
  }

  // Main View
  return (
    <div className="app-body">
      <div className='app-galaxies'>
        <span className='gradient-text-galaxy'>Galaxies</span>
      </div>
      <div className='app-connections'>
        <span className='gradient-text-connections'>Connections</span>
      </div>
      {computerName && (
        <div className="computer-name">
          <span className="gradient-text-small">{computerName}</span>
        </div>
      )}
      <div className="app-body-content">
        <AppGalaxies onAddGalaxy={handleAddGalaxy} />
        <AppConnections setCurrentView={setCurrentView}/>
      </div>
    </div>
  );
}

export default AppBody;
