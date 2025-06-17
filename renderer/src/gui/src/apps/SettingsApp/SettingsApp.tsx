import './SettingsApp.scss';

import { useEffect, useState } from 'react';

import { appRegistry } from '../../services/appRegistryService';
import { IntegrationService } from '../../services/integration/IntegrationService';
import { registryService } from '../../services/registryService';
import { AppDefinition } from '../../types/apps';
import { Integration, IntegrationType } from '../../types/Integration';
import { ImageViewerAppDefinition } from '../ImageViewerApp/definition';
import { NotesAppDefinition } from '../NotesApp/definition';
import { PDFiumAppDefinition } from '../PDFiumApp/definition';
import { WebDocumentAppDefinition } from '../WebDocumentApp/definition';
import HealthSection from './HealthSection';
import IntegrationsTab from './components/IntegrationsTab';
import AppsTab from './components/AppsTab';
import ModelsTab from './components/ModelsTab';
import AccountTab from './components/AccountTab';
import { API_BASE_URL } from '../../api/config';
import fetchService from '../../services/fetchService';

const SYSTEM_APPS: AppDefinition[] = [
  PDFiumAppDefinition,
  NotesAppDefinition,
  WebDocumentAppDefinition,
  ImageViewerAppDefinition,
  // ... add other system apps
];

interface SettingsAppProps {
  title: string;
  onClose: () => void;
}

const AVAILABLE_INTEGRATIONS = [
  {
    type: 'Gmail' as IntegrationType,
    icon: '📧',
    name: 'Gmail',
    description: 'Connect your Gmail account',
  },
  {
    type: 'AppleNote' as IntegrationType,
    icon: '📝',
    name: 'Apple Notes',
    description: 'Sync your Apple Notes',
  },
  {
    type: 'Notion' as IntegrationType,
    icon: '📘',
    name: 'Notion',
    description: 'Import your Notion workspace',
  },
];

function truncateEmbedding(obj: any): any {
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
}

const SettingsApp: React.FC<SettingsAppProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'integrations' | 'account' | 'apps' | 'models'>('integrations');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [installedApps, setInstalledApps] = useState<AppDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    registry?: { status: string; message: string };
    apps?: { status: string; message: string };
  }>({});
  const [registry, setRegistry] = useState<any>(null);
  const [registryDebug, setRegistryDebug] = useState<{
    registry: any;
    actions: any[];
    installedApps: any[];
  } | null>(null);
  const [activeDebugTab, setActiveDebugTab] = useState<'registry' | 'actions' | 'apps'>('registry');
  const [registryError, setRegistryError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const loadRegistry = async () => {
      setRegistry(registryService.getRegistryState());
    };
    loadRegistry();
  }, []);

  useEffect(() => {
    const loadRegistryDebug = async () => {
      try {
        const debugInfo = await registryService.getDebugInfo();
        setRegistryDebug(debugInfo);
        setRegistryError(null);
      } catch (error) {
        console.error('Failed to load registry debug info:', error);
        setRegistryError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    loadRegistryDebug();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [integrationsData, appsData] = await Promise.all([
        IntegrationService.getIntegrations(),
        appRegistry.getInstalledApps(),
      ]);
      setIntegrations(integrationsData);
      setInstalledApps(appsData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddIntegration = async (integrationType: IntegrationType) => {
    try {
      await IntegrationService.createIntegration({
        integrationEntities: [integrationType],
        name: integrationType,
        metadata: {},
      });
      await loadData();
    } catch (err) {
      setError('Failed to add integration');
      console.error(err);
    }
  };

  const handleRemoveIntegration = async (integrationId: string) => {
    try {
      await IntegrationService.removeIntegration(integrationId);
      await loadData();
    } catch (err) {
      setError('Failed to remove integration');
      console.error(err);
    }
  };

  const handleInstallApp = async (app: AppDefinition) => {
    try {
      await appRegistry.installApp(app);
      await loadData();
    } catch (err) {
      setError('Failed to install app');
      console.error(err);
    }
  };

  const handleUninstallApp = async (appId: string) => {
    try {
      await appRegistry.uninstallApp(appId);
      await loadData();
    } catch (err) {
      setError('Failed to uninstall app');
      console.error(err);
    }
  };

  const handleUseModel = async (modelId: string) => {
    // TODO: Implement model switching functionality
    console.log('Switching to model:', modelId);
  };

  return (
    <div className="settings-app">
      <div className="settings-app__header">
        <h3>Settings</h3>
      </div>

      <div className="settings-app__tabs">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`tab ${activeTab === 'integrations' ? 'active' : ''}`}
        >
          Integrations
        </button>
        <button onClick={() => setActiveTab('apps')} className={`tab ${activeTab === 'apps' ? 'active' : ''}`}>
          Apps
        </button>
        <button onClick={() => setActiveTab('models')} className={`tab ${activeTab === 'models' ? 'active' : ''}`}>
          Models
        </button>
        <button onClick={() => setActiveTab('account')} className={`tab ${activeTab === 'account' ? 'active' : ''}`}>
          Account
        </button>
      </div>

      <div className="settings-app__content">
        {activeTab === 'integrations' && (
          <IntegrationsTab
            loading={loading}
            error={error}
            integrations={integrations}
            onAddIntegration={handleAddIntegration}
            onRemoveIntegration={handleRemoveIntegration}
            onRetry={loadData}
          />
        )}

        {activeTab === 'apps' && (
          <AppsTab
            installedApps={installedApps}
            onInstallApp={handleInstallApp}
            onUninstallApp={handleUninstallApp}
            registryDebug={registryDebug}
            registryError={registryError}
          />
        )}

        {activeTab === 'models' && (
          <ModelsTab onUseModel={handleUseModel} />
        )}

        {activeTab === 'account' && <AccountTab />}
      </div>
    </div>
  );
};

export default SettingsApp;
