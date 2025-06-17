import { Integration, IntegrationType } from '../../../types/Integration';

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

interface IntegrationsTabProps {
  loading: boolean;
  error: string | null;
  integrations: Integration[];
  onAddIntegration: (type: IntegrationType) => void;
  onRemoveIntegration: (id: string) => void;
  onRetry: () => void;
}

const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
  loading,
  error,
  integrations,
  onAddIntegration,
  onRemoveIntegration,
  onRetry,
}) => {
  if (loading) {
    return <div className="loading">Loading integrations...</div>;
  }

  if (error) {
    return (
      <div className="error">
        {error}
        <button onClick={onRetry} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="integrations-container">
      <div className="integrations-header">
        <h3>Integration Management</h3>
        <div className="header-controls">
          <div className="integration-actions">
            <div className="action-buttons">
              <button className="action-button" disabled>
                <span className="icon">➕</span>
                Add Custom Integration
              </button>
              <button className="action-button" disabled>
                <span className="icon">🔄</span>
                Sync All
              </button>
              <button className="action-button" disabled>
                <span className="icon">🔍</span>
                Browse Directory
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="integrations-table">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Added Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[
              ...integrations.map(integration => ({
                type: integration.skeleton.integrationEntities[0],
                _id: integration._id,
                isConnected: integration.skeleton.isConnected,
                created_at: integration.created_at,
                isInstalled: true
              })),
              ...AVAILABLE_INTEGRATIONS
                .filter(ai => !integrations.some(i => 
                  i.skeleton.integrationEntities.includes(ai.type)
                ))
                .map(ai => ({
                  type: ai.type,
                  _id: null,
                  isConnected: false,
                  created_at: null,
                  isInstalled: false
                }))
            ].map((integration) => {
              const integrationInfo = AVAILABLE_INTEGRATIONS.find(
                ai => ai.type === integration.type
              );
              return (
                <tr key={integration.type}>
                  <td>
                    <span className="integration-icon">
                      {integrationInfo?.icon || '🔌'}
                    </span>
                  </td>
                  <td>{integrationInfo?.name}</td>
                  <td>{integrationInfo?.description}</td>
                  <td>
                    {integration.isInstalled ? (
                      <span className={`status-badge ${integration.isConnected ? 'active' : 'disconnected'}`}>
                        {integration.isConnected ? 'Connected' : 'Not Connected'}
                      </span>
                    ) : (
                      <span className="status-badge available">Available</span>
                    )}
                  </td>
                  <td>
                    {integration.created_at && (
                      <span className="date">
                        {new Date(integration.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  <td>
                    {integration.isInstalled ? (
                      <button 
                        className="remove-button" 
                        onClick={() => onRemoveIntegration(integration._id!)}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        className="add-button"
                        onClick={() => onAddIntegration(integration.type)}
                      >
                        Add
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IntegrationsTab; 