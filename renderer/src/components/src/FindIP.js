import './FindIP.css';
import { useState, useEffect } from 'react';
import config, { logConfig } from '../../config';
import { updateGalBoxIP } from '../../utils/envUpdater';

function FindIP({ onIPFound, onIPSelected }) {
  const [discoveredIPs, setDiscoveredIPs] = useState([]);
  const [scanningIPs, setScanningIPs] = useState(false);
  const [selectedIP, setSelectedIP] = useState('');
  const [galaxyID, setGalaxyID] = useState('');
  const [savedIP, setSavedIP] = useState(''); // Track which IP was saved to .env

  useEffect(() => {
    // Log configuration on component mount
    logConfig();
  }, []);

  // Debug discoveredIPs state changes
  useEffect(() => {
    console.log('discoveredIPs state changed to:', discoveredIPs);
  }, [discoveredIPs]);

  // Debug selectedIP state changes
  useEffect(() => {
    console.log('selectedIP state changed to:', selectedIP);
  }, [selectedIP]);

  // Auto-save first discovered IP to .env file
  useEffect(() => {
    if (discoveredIPs.length > 0) {
      const firstIP = discoveredIPs[0];
      if (!firstIP || !firstIP.ip) return;
      console.log('Auto-saving first discovered IP to .env:', firstIP);
      window.electronAPI.addGalaxy(firstIP.ip, firstIP.galID);
      updateGalBoxIP(firstIP.ip).then(success => {
        if (success) {
          console.log('Successfully saved IP to .env file');
          setSavedIP(firstIP.ip); // Track that this IP was saved
          // Notify parent component
          if (onIPFound) {
            onIPFound(firstIP.ip);
          }
          // Show a subtle notification to user
          setTimeout(() => {
            console.log(`GalBox IP ${firstIP.ip} has been saved as default`);
          }, 1000);
        } else {
          console.warn('Failed to save IP to .env file');
        }
      });
    }
  }, [discoveredIPs, onIPFound]);

  // Function to discover GalBox IPs
  const discoverGalboxIPs = async () => {
    console.log('Starting GalBox IP discovery...');
    setScanningIPs(true);
    setDiscoveredIPs([]);
    setSelectedIP('');
    setGalaxyID('');
    
    try {
      if (window.electronAPI && window.electronAPI.discoverGalboxIPs) {
        console.log('Calling discoverGalboxIPs...');
        const ips = await window.electronAPI.discoverGalboxIPs();
        console.log('Discovered IPs returned from main process:', ips);
        console.log('Type of ips:', typeof ips);
        console.log('Length of ips:', ips ? ips.length : 'null');
        
        if (Array.isArray(ips)) {
          setDiscoveredIPs(ips);
          console.log('Set discoveredIPs state to:', ips);
          
          if (ips.length > 0) {
            setSelectedIP(ips[0].ip); // Auto-select first found IP
            setGalaxyID(ips[0].galID);
            console.log('Auto-selected IP:', ips[0].ip);
            // Notify parent component
            if (onIPSelected) {
              onIPSelected(ips[0].ip);
            }
          }
        } else {
          console.log('ips is not an array:', ips);
          setDiscoveredIPs([]);
        }
      } else {
        console.log('discoverGalboxIPs API not available');
        setDiscoveredIPs([]);
      }
    } catch (error) {
      console.error('Error discovering GalBox IPs:', error);
      setDiscoveredIPs([]);
    } finally {
      setScanningIPs(false);
      console.log('IP discovery completed, scanningIPs set to false');
    }
  };

  const handleIPSelect = (ip) => {
    setSelectedIP(ip);
    if (onIPSelected) {
      onIPSelected(ip);
    }
  };

  // Manual save function for selected IP
  const handleSaveIP = async (ip, galID) => {
    if (!ip) {
      console.warn('No IP to save');
      return;
    }
    console.log('Manually saving IP to .env:', ip, galID);
    await window.electronAPI.addGalaxy(ip, galID);
    const success = await updateGalBoxIP(ip);
    if (success) {
      setSavedIP(ip);
      console.log(`IP ${ip} has been saved as default`);
    } else {
      console.error('Failed to save IP to .env file');
    }
  };

  return (
    <div className="find-ip-container">
      <div className="ip-discovery-section">
            <div className="ip-discovery-header">
              <h3>GalBox Discovery</h3>
              <button onClick={discoverGalboxIPs} className="discover-button" disabled={scanningIPs}>
                {scanningIPs ? 'Scanning...' : '🔍 Discover GalBox'}
              </button>
            </div>
            
            {scanningIPs ? (
              <div className="scanning-message">Scanning for GalBox devices...</div>
            ) : (
              <div className="ip-list">
                {discoveredIPs.length > 0 ? (
                  discoveredIPs.map((item, index) => (
                    <div 
                      key={index} 
                      className={`ip-item ${selectedIP === item.ip ? 'selected' : ''}`}
                      onClick={() => handleIPSelect(item.ip)}
                    >
                      <div className="ip-info">
                        <div className="ip-address">{item.ip}</div>
                        <div className="ip-status">
                          GalBox Found
                          <span className="galid-info"> | galID: {item.galID}</span>
                          {savedIP === item.ip && (
                            <span className="saved-indicator"> 💾 Saved as default</span>
                          )}
                        </div>
                      </div>
                      <div className="ip-actions">
                        <div className="ip-select-indicator">
                          {selectedIP === item.ip ? '✓' : ''}
                        </div>
                        <button 
                          className="save-ip-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveIP(item.ip, item.galID);
                          }}
                          title="Save as default IP"
                        >
                          💾
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-ips">No GalBox devices found</div>
                )}
              </div>
            )}
          </div>

    </div>
  );
}

export default FindIP;
