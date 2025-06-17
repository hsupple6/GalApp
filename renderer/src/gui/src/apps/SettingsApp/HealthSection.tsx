import { useState } from 'react';
import { API_BASE_URL } from '../../api/config';
import fetchService from '../../services/fetchService';

// import './HealthSection.scss';

interface HealthStatus {
  registry?: { status: string; message: string };
  apps?: { status: string; message: string };
}

interface HealthSectionProps {
  registryDebug: {
    registry: any;
    actions: any[];
    installedApps: any[];
  } | null;
  registryError: string | null;
}

const truncateEmbedding = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map((item) => truncateEmbedding(item));
  }

  if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'embedding' && Array.isArray(value)) {
        newObj[key] = `[${value.slice(0, 3).join(', ')}...]`;
      } else {
        newObj[key] = truncateEmbedding(value);
      }
    }
    return newObj;
  }

  return obj;
};

const HealthSection: React.FC<HealthSectionProps> = ({ registryDebug, registryError }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({});
  const [activeDebugTab, setActiveDebugTab] = useState<'registry' | 'actions' | 'apps'>('registry');

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const [registryData, appsData] = await Promise.all([
        fetchService(`${API_BASE_URL}/health/registry`),
        fetchService(`${API_BASE_URL}/health/apps`),
      ]);

      setHealthStatus({
        registry: {
          status: registryData.status,
          message: registryData.message,
        },
        apps: {
          status: appsData.status,
          message: appsData.message,
        },
      });
    } catch (error) {
      console.error('Error checking health:', error);
      setHealthStatus({
        registry: {
          status: 'error',
          message: 'Failed to check registry health',
        },
        apps: {
          status: 'error',
          message: 'Failed to check app health',
        },
      });
    } finally {
      setIsChecking(false);
    }
  };

  const repairRegistry = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health/repair`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      const data = await response.json();
      if (data.status === 'success') {
        await checkHealth();
      }
    } catch (error) {
      console.error('Error repairing registry:', error);
    }
  };

  const renderActionsList = (actions: any[]) => {
    return (
      <div className="actions-list">
        {actions.map((action, index) => (
          <div key={index} className="action-item">
            <div className="action-header">
              <span className="action-id">{action.actionId}</span>
              <span className="action-app">{action.appId}</span>
            </div>
            <div className="action-description">{action.description}</div>
            {action.schema && (
              <div className="action-schema">
                <h5>Arguments:</h5>
                <pre>{JSON.stringify(action.schema.args, null, 2)}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="health-section">
      <section className="app-registry-health">
        <h3>App Registry Health</h3>
        <button onClick={checkHealth} disabled={isChecking}>
          {isChecking ? 'Checking...' : 'Check Health'}
        </button>

        {healthStatus.registry && (
          <div className={`health-status ${healthStatus.registry.status}`}>{healthStatus.registry.message}</div>
        )}
      </section>

      <div className="debug-section">
        <h3>Action Registry Debug</h3>
        <div className="debug-tabs">
          <button
            className={activeDebugTab === 'registry' ? 'active' : ''}
            onClick={() => setActiveDebugTab('registry')}
          >
            Registry
          </button>
          <button className={activeDebugTab === 'actions' ? 'active' : ''} onClick={() => setActiveDebugTab('actions')}>
            Actions
          </button>
          <button className={activeDebugTab === 'apps' ? 'active' : ''} onClick={() => setActiveDebugTab('apps')}>
            Installed Apps
          </button>
        </div>

        {registryError ? (
          <div className="error-message">Failed to load registry: {registryError}</div>
        ) : (
          <div className="debug-content">
            {activeDebugTab === 'actions' && registryDebug?.actions ? (
              renderActionsList(registryDebug.actions)
            ) : (
              <pre className="debug-output">
                {registryDebug &&
                  JSON.stringify(
                    truncateEmbedding(
                      activeDebugTab === 'registry'
                        ? registryDebug.registry
                        : activeDebugTab === 'actions'
                          ? registryDebug.actions
                          : registryDebug.installedApps,
                    ),
                    null,
                    2,
                  )}
              </pre>
            )}
          </div>
        )}
      </div>

      <div className="health-status">
        <h3>Apps Status</h3>
        {healthStatus.apps && <div className={`status ${healthStatus.apps.status}`}>{healthStatus.apps.message}</div>}
      </div>

      <div className="actions">
        <button onClick={repairRegistry} disabled={isChecking || !healthStatus.registry}>
          Repair Registry
        </button>
      </div>
    </div>
  );
};

export default HealthSection;
