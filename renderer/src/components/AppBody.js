import './AppBody.css';
import { useState, useEffect } from 'react';

import AppConnections from './src/AppConnections';
import AppGalaxies from './src/AppGalaxies';
import ConnecttoBox from './src/ConnecttoBox';

function AppBody() {
  const [computerName, setComputerName] = useState('');
  const [currentView, setCurrentView] = useState('main');
  const [sendTimeoutNotif, setSendTimeoutNotif] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [found, setFound] = useState(true); // Set this shit to be false after bruh

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
    } else {
      console.log('electronAPI not available');
    }
  }, []);

  const handleAddGalaxy = async() => {
    setCurrentView('add-galaxy');
    await new Promise(resolve => setTimeout(resolve, 10000));
    if (currentView !== 'main' && !found){
      setSendTimeoutNotif(true);
      handleBackToMain();
      handleNotif();
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

  // Add Galaxy View
  if (currentView === 'add-galaxy') {
    return (
      <div className="app-body">
        { found ? (
          <>
        <ConnecttoBox />
        </>) 
        : 
        (<> <div className='loading-display'>
          <span className='gradient-text-small-galaxy'>
          Please Wait While We Connect . . .
          </span>
        </div>
        <div className='loading-wrapper'>
          <div className='loading-bar'></div>
        </div>
        </>)}
        <button className='loading-back-button'onClick={handleBackToMain}>Back</button> 
        
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
        <AppConnections />
      </div>
      {sendTimeoutNotif ? 
      (<>
        <div className={`timeout-notif ${isHiding ? 'hiding' : ''}`}>
          <span className='gradient-text-notif'>
            Connection Timed Out! Ensure GalBox is On!
          </span>
        </div>
      </>) : 
      ""}
    </div>
  );
}

export default AppBody;
