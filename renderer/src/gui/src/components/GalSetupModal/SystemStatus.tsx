import React from 'react';
import './SystemStatus.scss';

interface SystemStatusProps {
  deviceId: string;
  name?: string;
  ollamaInstalled?: boolean;
  modelCreated?: boolean;
  computeUsage?: number;
  status?: string;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
  deviceId,
  name,
  ollamaInstalled,
  modelCreated,
  computeUsage = 0,
  status = 'Connected'
}) => {
  return (
    <div className="system-status">
      <div className="main-content">
        <div className="device-image" />
        
        <div className="system-info">
          <div className="info-row">
            <div className="detail-group">
              <div className="label">NAME</div>
              <div className="value">
                {name || "Not set"}
              </div>
            </div>
            
            <div className="detail-group">
              <div className="label">SERIAL</div>
              <div className="value">
                {deviceId}
              </div>
            </div>

            <div className="detail-group">
              <div className="label">OLLAMA</div>
              <div className="value">
                {ollamaInstalled ? "Installed" : "Not installed"}
              </div>
            </div>
          </div>

          <div className="info-row">
            <div className="detail-group">
              <div className="label">MODEL</div>
              <div className="value">
                {modelCreated ? "Custom" : "Default"}
              </div>
            </div>

            <div className="detail-group">
              <div className="label">INTELLIGENCE</div>
              <div className="value intelligence">
                <div className="model-count">
                  <span className="count">{ollamaInstalled ? "1" : "0"}</span>
                  <span className="type">local models</span>
                </div>
                <div className="model-count">
                  <span className="count">{modelCreated ? "1" : "0"}</span>
                  <span className="type">custom models</span>
                </div>
              </div>
            </div>

            <div className="detail-group">
              <div className="label">STATUS</div>
              <div className="value">{status}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="status-bar">
        <div className="device-status">
          <div className="status-indicator" />
          <span className="device-id">{deviceId}</span>
          <span className="status-text">{status}</span>
        </div>
        <div className="compute-usage">
          <div className="usage-bar">
            <div 
              className="usage-fill" 
              style={{ width: `${computeUsage}%` }} 
            />
          </div>
          <span className="usage-text">{Math.round(computeUsage)}% CPU</span>
        </div>
      </div>
    </div>
  );
}; 