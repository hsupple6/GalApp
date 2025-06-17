import './ConnecttoBox.css';
import { useState, useEffect } from 'react';
import config, { getConnectionUrl, logConfig } from '../../config';
import { updateGalBoxIP } from '../../utils/envUpdater';
import FindIP from './FindIP';

function ConnecttoBox({ onAddGalaxy, onAddGalaxyIP }) {
  const [galaxy, setGalaxy] = useState('Andromeda'); // change to be auto whatever the boxs name is
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [availableNetworks, setAvailableNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [sending, setSending] = useState(false);

  const [isLoading, setLoading] = useState(false);
  const [sendTimeoutNotif, setSendTimeoutNotif] = useState(false);
  const [isHiding, setIsHiding] = useState(false);

  const [isConnected, setConnected] = useState(false);

  // New state for IP discovery
  const [discoveredIPs, setDiscoveredIPs] = useState([]);
  const [scanningIPs, setScanningIPs] = useState(false);
  const [selectedIP, setSelectedIP] = useState('');
  const [savedIP, setSavedIP] = useState(''); // Track which IP was saved to .env

  useEffect(() => {
    scanNetworks();
    // Log configuration on component mount
    logConfig();
  }, []);

  useEffect(() => {
    console.log('isLoading changed to:', isLoading);
  }, [isLoading]);

  useEffect(() => {
    console.log('sending changed to:', sending);
  }, [sending]);

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
      console.log('Auto-saving first discovered IP to .env:', firstIP);
      
      updateGalBoxIP(firstIP).then(success => {
        if (success) {
          console.log('Successfully saved IP to .env file');
          setSavedIP(firstIP); // Track that this IP was saved
          // Show a subtle notification to user
          setTimeout(() => {
            console.log(`GalBox IP ${firstIP} has been saved as default`);
          }, 1000);
        } else {
          console.warn('Failed to save IP to .env file');
        }
      });
      // Append to AppGalaxies if handler is provided
      if (typeof onAddGalaxyIP === 'function') {
        onAddGalaxyIP(firstIP);
      }
    }
  }, [discoveredIPs]);

  const handleNotif = async() => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    setIsHiding(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setSendTimeoutNotif(false);
    setIsHiding(false);
  }

  const scanNetworks = async () => {
    console.log('Starting network scan...');
    setScanning(true);
    try {
      // Try to get local WiFi networks using Electron API
      if (window.electronAPI && window.electronAPI.scanLocalNetworks) {
        console.log('Calling scanLocalNetworks...');
        const networks = await window.electronAPI.scanLocalNetworks();
        console.log('Local networks returned:', networks);
        console.log('Networks type:', typeof networks);
        console.log('Networks length:', networks ? networks.length : 'null');
        setAvailableNetworks(networks || []);
      } else {
        console.log('scanLocalNetworks API not available');
        // Fallback: try to get current WiFi info and show it
        if (window.electronAPI && window.electronAPI.getCurrentWiFi) {
          console.log('Trying getCurrentWiFi fallback...');
          const currentWifi = await window.electronAPI.getCurrentWiFi();
          console.log('Current WiFi:', currentWifi);
          if (currentWifi && currentWifi.ssid) {
            setAvailableNetworks([{
              ssid: currentWifi.ssid,
              security: 'Current Network',
              signal: 'Connected'
            }]);
          } else {
            setAvailableNetworks([]);
          }
        } else {
          console.log('No WiFi APIs available');
          setAvailableNetworks([]);
        } 
      }
    } catch (error) {
      console.error('Error scanning local networks:', error);
      setAvailableNetworks([]);
      setSendTimeoutNotif(true);
      handleNotif();
    } finally {
      console.log('Scan complete, setting scanning to false');
      setScanning(false);
    }
  };

  const handleNetworkSelect = (network) => {
    setSelectedNetwork(network);
    setSsid(network.ssid);
  };

  const handleIPSelect = (ip) => {
    setSelectedIP(ip);
  };

  // Manual save function for selected IP
  const handleSaveIP = async (ip) => {
    if (!ip) {
      console.warn('No IP to save');
      return;
    }
    
    console.log('Manually saving IP to .env:', ip);
    const success = await updateGalBoxIP(ip);
    
    if (success) {
      setSavedIP(ip);
      console.log(`IP ${ip} has been saved as default`);
    } else {
      console.error('Failed to save IP to .env file');
    }
  };

  const handleCreds = async() => {
    console.log('handleCreds called with:');
    console.log('- selectedNetwork:', selectedNetwork);
    console.log('- ssid:', ssid);
    console.log('- password:', password ? '***' : 'empty');
    console.log('- selectedIP:', selectedIP);
    
    // Validate required fields
    if (!ssid) {
      alert('Please enter an SSID (either select a network or enter manually)');
      return;
    }
    
    if (!password) {
      alert('Please enter a WiFi password');
      return;
    }
    
    setLoading(true);
    
    // Create a promise that waits 10 seconds
    const timeoutPromise = new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('Connection timeout after 10 seconds'));
      }, 1000);
    });
    
    // Use the SSID from state (either selected network or manually entered)
    const finalSSID = ssid;
    const credentials = `${finalSSID},${password}`;
    console.log('Sending credentials:', credentials);
    console.log('Final SSID being sent:', finalSSID);
    console.log('Password length:', password.length);
    
    // Use fixed IP address 10.42.0.1
    const targetIP = '192.168.100.1';
    const targetPort = 5420;
    
    try {
      // Race between the fetch and the timeout
      const response = await Promise.race([
        fetch(`http://${targetIP}:${targetPort}/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: credentials
        }),
        timeoutPromise
      ]);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        console.log('Credentials sent successfully!');
        setSendTimeoutNotif(true);
        handleNotif();
        setPassword('');
        
        // Navigate to success page with the fixed IP
        setTimeout(() => {
          if (onAddGalaxy) {
            onAddGalaxy(finalSSID, targetIP);
          }
        }, 2000);
      } else {
        console.log('Server returned success: false');
        setSendTimeoutNotif(true);
        handleNotif();
      }
    } catch (error) {
      console.error('Error sending credentials:', error);
      setSendTimeoutNotif(true);
      handleNotif();
    } finally {
      setLoading(false);
      setConnected(true);
    }
  }

  return (
    <div className="box-connect">
    {isConnected ? 
    (<>
        <FindIP/>
    </>) : <>
        {isLoading ? (
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
        ) : (
            <>

            {/* Available Networks */}
            <div className="networks-section">
                <div className="networks-header">
                <h3>Available Networks</h3>
                <button onClick={scanNetworks} className="scan-button" disabled={scanning}>
                    {scanning ? 'Scanning...' : '🔄 Scan'}
                </button>
                </div>
                
                {scanning ? (
                <div className="scanning-message">Scanning for networks...</div>
                ) : (
                <div className="networks-list">
                    {availableNetworks.length > 0 ? (
                    availableNetworks.map((network, index) => (
                        <div 
                        key={index} z
                        className={`network-item ${selectedNetwork?.ssid === network.ssid ? 'selected' : ''}`}
                        onClick={() => handleNetworkSelect(network)}
                        >
                        <div className="network-info">
                            <div className="network-ssid">{network.ssid}</div>
                            <div className="network-details">
                            <span className="network-security">{network.security}</span>
                            <span className="network-signal">Signal: {network.signal}</span>
                            </div>
                        </div>
                        <div className="network-select-indicator">
                            {selectedNetwork?.ssid === network.ssid ? '✓' : ''}
                        </div>
                        </div>
                    ))
                    ) : (
                    <div className="no-networks">No networks found</div>
                    )}
                </div>
                )}
            </div>

            <div className="connection-inputs">
                <div className="input-group">
                <label>Network SSID:</label>
                <input 
                    type="text" 
                    value={ssid}
                    onChange={(e) => setSsid(e.target.value)}
                    placeholder={selectedNetwork ? "Network selected from scan" : "Select a network above or enter SSID manually"}
                    readOnly={selectedNetwork !== null}
                    className={selectedNetwork ? "readonly-input" : ""}
                />
                {selectedNetwork && (
                    <div className="input-hint">
                    ✓ Network selected from scan - click "Clear Selection" to enter manually
                    </div>
                )}
                </div>
                <div className="input-group">
                <label>WiFi Password:</label>
                <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter WiFi password"
                />
                </div>
                <div className="button-group">
                {selectedNetwork && (
                    <button 
                    onClick={() => {
                        setSelectedNetwork(null);
                        setSsid('');
                    }}
                    className="clear-selection-button"
                    >
                    Clear Selection
                    </button>
                )}
                <button 
                    onClick={handleCreds} 
                    className="send-button"
                    disabled={!ssid || !password}
                >
                    Send Credentials
                </button>
                </div>
            </div>

            <button 
                className='box-connect-button' 
                onClick={handleCreds}
                disabled={!ssid || !password}
            >
                Connect
            </button>
            </>
        )}
      </>}
    </div>
  );
}

export default ConnecttoBox;
