import { AppDefinition } from '../../../types/apps';
import { ImageViewerAppDefinition } from '../../ImageViewerApp/definition';
import { NotesAppDefinition } from '../../NotesApp/definition';
import { PDFiumAppDefinition } from '../../PDFiumApp/definition';
import { WebDocumentAppDefinition } from '../../WebDocumentApp/definition';
import HealthSection from '../HealthSection';

const SYSTEM_APPS: AppDefinition[] = [
  PDFiumAppDefinition,
  NotesAppDefinition,
  WebDocumentAppDefinition,
  ImageViewerAppDefinition,
];

interface AppsTabProps {
  installedApps: AppDefinition[];
  onInstallApp: (app: AppDefinition) => void;
  onUninstallApp: (appId: string) => void;
  registryDebug: {
    registry: any;
    actions: any[];
    installedApps: any[];
  } | null;
  registryError: string | null;
}

const AppsTab: React.FC<AppsTabProps> = ({
  installedApps,
  onInstallApp,
  onUninstallApp,
  registryDebug,
  registryError
}) => {
  return (
    <div className="apps-container">
      <div className="apps-header">
        <h3>App Management</h3>
        <div className="header-controls">
          <div className="app-actions">
            <div className="action-buttons">
              <button className="action-button" disabled>
                <span className="icon">➕</span>
                Create App
              </button>
              <button className="action-button" disabled>
                <span className="icon">🔄</span>
                Update All
              </button>
              <button className="action-button" disabled>
                <span className="icon">🔍</span>
                Browse Store
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="apps-table">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Description</th>
              <th>Version</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...installedApps, ...SYSTEM_APPS.filter(app => 
              !installedApps.some(i => i.appId === app.appId)
            )].map((app) => (
              <tr key={app.appId}>
                <td>
                  <span className="app-icon">📱</span>
                </td>
                <td>{app.name}</td>
                <td>{app.description}</td>
                <td>
                  <span className="version-badge">v{app.version}</span>
                </td>
                <td>
                  <span className={`status-badge ${installedApps.some(i => i.appId === app.appId) ? 'active' : 'available'}`}>
                    {installedApps.some(i => i.appId === app.appId) ? 'Installed' : 'Available'}
                  </span>
                </td>
                <td>
                  {!SYSTEM_APPS.some((sysApp) => sysApp.appId === app.appId) && installedApps.some(i => i.appId === app.appId) ? (
                    <button 
                      className="remove-button" 
                      onClick={() => onUninstallApp(app.appId)}
                    >
                      Uninstall
                    </button>
                  ) : !installedApps.some(i => i.appId === app.appId) && (
                    <button
                      className="add-button"
                      onClick={() => onInstallApp(app)}
                    >
                      Install
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HealthSection registryDebug={registryDebug} registryError={registryError} />
    </div>
  );
};

export default AppsTab; 