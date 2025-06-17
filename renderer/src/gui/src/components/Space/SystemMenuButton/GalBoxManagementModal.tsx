import React, { useState, useEffect } from 'react';
import './GalSetupModal.scss'; // Reuse existing styles
import useGalBoxStore from '../../../components/GalSetupModal/store/galboxStore';
import { useGalBoxServer } from '../../../hooks/useGalBoxServer';

interface GalBoxManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GalBoxManagementModal: React.FC<GalBoxManagementModalProps> = ({ isOpen, onClose }) => {
  // Get GalBox information from stores and hooks
  const { activeGalBox, serverStatus: storeServerStatus } = useGalBoxStore();
  const { serverStatus, detectServer, runModel } = useGalBoxServer();
  
  // Local state for input fields
  const [ngrokUrlInput, setNgrokUrlInput] = useState(
    localStorage.getItem('galBoxNgrokUrl') || ''
  );
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Choose the best status - use either serverStatus
  const isOnline = serverStatus.online || storeServerStatus.online;
  
  // When modal opens, refresh connection status
  useEffect(() => {
    if (isOpen) {
      detectServer();
    }
  }, [isOpen, detectServer]);
  
  // Handle saving the Ngrok URL
  const handleSaveNgrokUrl = () => {
    try {
      // Basic validation for URL format
      if (ngrokUrlInput && !ngrokUrlInput.startsWith('http')) {
        throw new Error('URL must start with http:// or https://');
      }
      
      // Save to localStorage
      localStorage.setItem('galBoxNgrokUrl', ngrokUrlInput);
      
      // Show success message
      setTestResult({
        success: true,
        message: 'Ngrok URL saved successfully!'
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => setTestResult(null), 3000);
    } catch (error) {
      setTestResult({
        success: false,
        message: `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };
  
  // Test the connection to the GalBox
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    
    try {
      // First try to detect the server
      const serverDetected = await detectServer();
      
      if (serverDetected) {
        // Try to run a simple model test
        try {
          const response = await runModel('llama2', 'Say hello in one short sentence', {
            max_tokens: 20
          });
          
          setTestResult({
            success: true,
            message: `Connection successful! Model response: ${response.response || 'No response'}`
          });
        } catch (modelError) {
          setTestResult({
            success: false,
            message: `Server is online but model test failed: ${modelError instanceof Error ? modelError.message : 'Unknown error'}`
          });
        }
      } else {
        setTestResult({
          success: false,
          message: 'Could not connect to GalBox server. Please check your connection settings.'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error testing connection: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay">
      <div className="gal-setup-modal">
        <div className="modal-header">
          <h1>Manage GalBox</h1>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="section">
            <h2>Connection Status</h2>
            <div className={`status-box ${isOnline ? 'status-success' : 'status-error'}`}>
              <div className="status-indicator">
                <div className={`status-dot ${isOnline ? 'online' : 'offline'}`}></div>
                <div className="status-text">
                  <h3>{isOnline ? 'Connected' : 'Disconnected'}</h3>
                  {isOnline && (
                    <p>
                      {serverStatus.connectionType === 'direct' 
                        ? 'Direct Connection' 
                        : serverStatus.connectionType === 'network'
                          ? 'Network Connection'
                          : 'Unknown Connection'
                      }
                      {serverStatus.ollamaVersion && ` • Ollama ${serverStatus.ollamaVersion}`}
                    </p>
                  )}
                </div>
              </div>
              
              <button 
                className="action-button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            
            {testResult && (
              <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                {testResult.message}
              </div>
            )}
          </div>
          
          <div className="section">
            <h2>Local Connection</h2>
            <div className="info-grid">
              <div className="info-label">IP Address:</div>
              <div className="info-value">{activeGalBox?.ipAddress || 'Not configured'}</div>
              
              <div className="info-label">Server Port:</div>
              <div className="info-value">{serverStatus.port || 3001}</div>
              
              <div className="info-label">Last Checked:</div>
              <div className="info-value">{serverStatus.lastChecked.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="section">
            <h2>Remote Access (Ngrok)</h2>
            <p className="description">
              Configure a Ngrok URL to access your GalBox from anywhere, even outside your home network.
            </p>
            
            <div className="input-group">
              <label htmlFor="ngrokUrl">Ngrok URL</label>
              <div className="url-input-container">
                <input
                  id="ngrokUrl"
                  type="text"
                  value={ngrokUrlInput}
                  onChange={(e) => setNgrokUrlInput(e.target.value)}
                  placeholder="https://your-galbox.ngrok.io"
                  className="text-input"
                />
                <button 
                  className="action-button" 
                  onClick={handleSaveNgrokUrl}
                >
                  Save
                </button>
              </div>
              <div className="input-hint">
                Learn how to set up Ngrok tunneling on your GalBox for remote access.
              </div>
            </div>
          </div>
          
          <div className="section">
            <h2>Connection Help</h2>
            <div className="help-box">
              <h3>Cannot connect to your GalBox?</h3>
              <ul className="help-list">
                <li>Make sure your GalBox is powered on and connected to your network</li>
                <li>For remote access, ensure the Ngrok tunnel is running on your GalBox</li>
                <li>Verify that port 3001 is not blocked by any firewall</li>
                <li>Check that the GalBox server service is running</li>
              </ul>
              
              <button 
                className="secondary-button"
                onClick={() => window.electron?.ipcRenderer.send('show-galbox-server-instructions', {})}
              >
                View Server Setup Instructions
              </button>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default GalBoxManagementModal; 