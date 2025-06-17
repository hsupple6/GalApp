import React, { useState, useEffect, useRef } from 'react';
import useGalBoxStore from '../GalSetupModal/store/galboxStore';
import { useGalBoxServer } from '../../hooks/useGalBoxServer';

// Import feature flag from the hook (we'll keep it in sync)
const GALBOX_FEATURES_ENABLED = false;

const GalBoxStatusIndicator: React.FC = () => {
  // Use both the GalBox store and our direct server detection
  const { activeGalBox } = useGalBoxStore();
  const { serverStatus, runModel, detectServer } = useGalBoxServer();
  const [showDetails, setShowDetails] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  
  // Choose the best status - use serverStatus directly
  const isOnline = serverStatus.online;

  // Get indicator color based on feature status and connection
  const getIndicatorColor = () => {
    if (!GALBOX_FEATURES_ENABLED) return '#888888'; // Gray when disabled
    return isOnline ? '#00c853' : '#9e9e9e';
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        setShowDetails(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  return (
    <span 
      className="galbox-status-indicator"
      style={{ 
        display: 'inline-block',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: getIndicatorColor(),
        marginLeft: '8px',
        marginRight: '8px',
        verticalAlign: 'middle',
        cursor: 'pointer',
        position: 'relative'
      }}
      onClick={(e) => {
        e.stopPropagation();
        setShowDetails(!showDetails);
      }}
      title={!GALBOX_FEATURES_ENABLED 
        ? "GalBox features are currently disabled" 
        : isOnline 
          ? `GalBox is online: ${serverStatus.ollamaVersion || ''}` 
          : "GalBox is offline"
      }
    >
      {showDetails && (
        <div 
          ref={detailsRef}
          style={{
            position: 'absolute',
            top: '15px',
            left: '-10px',
            width: '280px',
            backgroundColor: '#2a2a2a',
            color: '#ffffff',
            padding: '12px',
            borderRadius: '6px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            zIndex: 1000,
            fontSize: '12px',
            textAlign: 'left'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            GalBox Connection Status
          </div>
          
          {!GALBOX_FEATURES_ENABLED && (
            <div>
              <div style={{ 
                marginBottom: '8px', 
                padding: '4px 8px', 
                backgroundColor: '#454545', 
                borderRadius: '4px',
                fontWeight: 'bold',
                color: '#DDD'
              }}>
                ⚠️ GalBox Features Disabled
              </div>
              
              <p style={{ margin: '4px 0', fontSize: '12px' }}>
                GalBox connection features are currently disabled in this build.
              </p>
              
              <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '8px 0' }} />
            </div>
          )}
          
          {GALBOX_FEATURES_ENABLED && serverStatus.online && (
            <>
              <div style={{ 
                marginBottom: '8px', 
                padding: '4px 8px', 
                backgroundColor: '#00512c', 
                borderRadius: '4px',
                fontWeight: 'bold' 
              }}>
                ✅ Server Connection
              </div>
              
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#aaa' }}>Server Address:</span> {serverStatus.address}:{serverStatus.port}
              </div>
              
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#aaa' }}>Connection Type:</span> {serverStatus.connectionType}
              </div>
              
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#aaa' }}>Ollama Version:</span> {serverStatus.ollamaVersion || 'Unknown'}
              </div>
              
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#aaa' }}>Last Checked:</span> {serverStatus.lastChecked.toLocaleTimeString()}
              </div>
              
              <button 
                style={{
                  width: '100%',
                  padding: '6px',
                  marginTop: '8px',
                  backgroundColor: '#006699',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer'
                }}
                onClick={async () => {
                  try {
                    const response = await runModel('llama2', 'Say hello and introduce yourself as GalBox in one sentence');
                    console.log('Model response:', response);
                    alert(`Model response: ${response.response}`);
                  } catch (error: unknown) {
                    console.error('Error running model:', error);
                    alert(`Error: ${error instanceof Error ? error.message : 'Failed to run model'}`);
                  }
                }}
              >
                Test Model
              </button>
            </>
          )}
          
          {GALBOX_FEATURES_ENABLED && !isOnline && (
            <div>
              <h4 style={{ marginTop: '12px', marginBottom: '4px' }}>
                ❌ GalBox Offline
              </h4>
              
              <p style={{ margin: '4px 0' }}>
                No connection to GalBox detected.
              </p>
              
              {activeGalBox && (
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ color: '#aaa' }}>Last Known IP:</span> {activeGalBox.ipAddress}
                </div>
              )}
              
              <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '8px 0' }} />
              
              <p style={{ fontSize: '11px', color: '#ccc' }}>
                Please check your GalBox is:<br />
                - Powered on<br />
                - Connected to your network<br />
                - Running the GalBox server
              </p>
              
              <button 
                style={{
                  width: '100%',
                  padding: '4px',
                  marginTop: '8px',
                  backgroundColor: '#444',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
                onClick={() => {
                  window.electron?.ipcRenderer.send('show-galbox-server-instructions', {});
                }}
              >
                Show Setup Instructions
              </button>
            </div>
          )}
          
          {/* Check connection button */}
          {GALBOX_FEATURES_ENABLED && (
            <button 
              style={{
                width: '100%',
                padding: '6px',
                marginTop: '8px',
                backgroundColor: '#444',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer'
              }}
              onClick={() => {
                detectServer();
              }}
            >
              Check Connection
            </button>
          )}
          
          {/* Add button to open GalBox Management modal */}
          <button 
            style={{
              width: '100%',
              padding: '6px',
              marginTop: '12px',
              backgroundColor: '#333',
              border: '1px solid #555',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer'
            }}
            onClick={() => {
              setShowDetails(false);
              // Dispatch custom event to open the management modal
              window.dispatchEvent(new CustomEvent('open-galbox-management'));
            }}
          >
            Manage GalBox Settings
          </button>
        </div>
      )}
    </span>
  );
};

export default GalBoxStatusIndicator; 