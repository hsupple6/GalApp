import { useState } from 'react';

interface ModelUsage {
  appName: string;
  function: string;
}

interface Model {
  id: string;
  name: string;
  type: 'Language' | 'Embedding' | 'Summarization' | 'QA' | 'NER';
  provider: string;
  description: string;
  icon: string;
  status: 'active' | 'available';
  usages: ModelUsage[];
  location: 'cloud' | 'local';
  pricing: {
    type: 'free' | 'token-based' | 'subscription';
    details: string;
  };
}

const MODELS: Model[] = [
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    type: 'Language',
    provider: 'OpenAI',
    description: 'Used for generating final responses in chat interactions',
    icon: '🤖',
    status: 'active',
    location: 'cloud',
    pricing: {
      type: 'token-based',
      details: '$0.002/1K tokens'
    },
    usages: [
      { appName: 'Chat', function: 'Generate responses' },
      { appName: 'Notes', function: 'Assist with writing' },
      { appName: 'Search', function: 'Query understanding' }
    ]
  },
  {
    id: 'all-MiniLM-L6-v2',
    name: 'all-MiniLM-L6-v2',
    type: 'Embedding',
    provider: 'SentenceTransformer',
    description: 'Used for semantic text embeddings',
    icon: '🧬',
    status: 'active',
    location: 'local',
    pricing: {
      type: 'free',
      details: 'Open source'
    },
    usages: [
      { appName: 'Search', function: 'Semantic search' },
      { appName: 'Notes', function: 'Similar content finding' },
      { appName: 'PDFium', function: 'Document similarity' }
    ]
  },
  {
    id: 'bart-large-cnn',
    name: 'facebook/bart-large-cnn',
    type: 'Summarization',
    provider: 'Facebook',
    description: 'Used for text summarization',
    icon: '📝',
    status: 'active',
    location: 'local',
    pricing: {
      type: 'free',
      details: 'Open source'
    },
    usages: [
      { appName: 'PDFium', function: 'Document summarization' },
      { appName: 'Notes', function: 'Content summarization' }
    ]
  },
  {
    id: 'all-mpnet-base-v2',
    name: 'sentence-transformers/all-mpnet-base-v2',
    type: 'Embedding',
    provider: 'SentenceTransformer',
    description: 'Alternative embedding model with higher accuracy',
    icon: '🧠',
    status: 'available',
    location: 'local',
    pricing: {
      type: 'free',
      details: 'Open source'
    },
    usages: []
  },
  {
    id: 'roberta-base-squad2',
    name: 'deepset/roberta-base-squad2',
    type: 'QA',
    provider: 'Hugging Face',
    description: 'Question-answering model for precise information extraction',
    icon: '❓',
    status: 'available',
    location: 'local',
    pricing: {
      type: 'free',
      details: 'Open source'
    },
    usages: []
  },
  {
    id: 'bert-ner',
    name: 'dbmdz/bert-large-cased-finetuned-conll03-english',
    type: 'NER',
    provider: 'Hugging Face',
    description: 'Named Entity Recognition for identifying key information',
    icon: '👥',
    status: 'available',
    location: 'local',
    pricing: {
      type: 'free',
      details: 'Open source'
    },
    usages: []
  }
];

interface ModelsTabProps {
  onUseModel?: (modelId: string) => void;
}

const ModelsTab: React.FC<ModelsTabProps> = ({ onUseModel }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  const renderModelDetails = (model: Model) => (
    <div className="model-details-popup">
      <div className="model-details-header">
        <span className="model-icon">{model.icon}</span>
        <h3>{model.name}</h3>
        <button className="close-button" onClick={() => setSelectedModel(null)}>×</button>
      </div>
      <div className="model-details-content">
        <div className="model-info-section">
          <h4>Model Information</h4>
          <div className="info-grid">
            <div className="info-item">
              <label>Type:</label>
              <span>{model.type}</span>
            </div>
            <div className="info-item">
              <label>Provider:</label>
              <span>{model.provider}</span>
            </div>
            <div className="info-item">
              <label>Status:</label>
              <span className={`status ${model.status}`}>
                {model.status === 'active' ? 'Active' : 'Available'}
              </span>
            </div>
            <div className="info-item">
              <label>Location:</label>
              <span className={`location ${model.location}`}>
                {model.location === 'cloud' ? '☁️ Cloud' : '💻 Local'}
              </span>
            </div>
            <div className="info-item">
              <label>Pricing:</label>
              <span className={`pricing ${model.pricing.type}`}>
                {model.pricing.details}
              </span>
            </div>
          </div>
          <p className="description">{model.description}</p>
        </div>
        
        <div className="model-usage-section">
          <h4>App Usage</h4>
          {model.usages.length > 0 ? (
            <table className="usage-table">
              <thead>
                <tr>
                  <th>App</th>
                  <th>Function</th>
                </tr>
              </thead>
              <tbody>
                {model.usages.map((usage, index) => (
                  <tr key={index}>
                    <td>{usage.appName}</td>
                    <td>{usage.function}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-usage">This model is not currently in use.</p>
          )}
        </div>

        {model.status === 'available' && (
          <div className="model-actions-section">
            <button 
              className="use-model-button"
              onClick={() => onUseModel?.(model.id)}
            >
              Use Model
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderGridView = () => (
    <div className="models-grid">
      <div className="models-section">
        <h4>Active Models</h4>
        <div className="models-grid-content">
          {MODELS.filter(m => m.status === 'active').map(model => (
            <div 
              key={model.id} 
              className="model-card active"
              onClick={() => setSelectedModel(model)}
            >
              <div className="model-card-header">
                <span className="model-icon">{model.icon}</span>
                <span className="model-type">{model.type}</span>
              </div>
              <h4>{model.name}</h4>
              <div className="model-meta">
                <span className={`location ${model.location}`}>
                  {model.location === 'cloud' ? '☁️ Cloud' : '💻 Local'}
                </span>
                <span className={`pricing ${model.pricing.type}`}>
                  {model.pricing.type === 'free' ? '🆓' : '💰'} {model.pricing.details}
                </span>
              </div>
              <div className="usage-count">
                Used by {model.usages.length} app{model.usages.length !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="models-section">
        <h4>Available Models</h4>
        <div className="models-grid-content">
          {MODELS.filter(m => m.status === 'available').map(model => (
            <div 
              key={model.id} 
              className="model-card"
              onClick={() => setSelectedModel(model)}
            >
              <div className="model-card-header">
                <span className="model-icon">{model.icon}</span>
                <span className="model-type">{model.type}</span>
              </div>
              <h4>{model.name}</h4>
              <button 
                className="use-model-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUseModel?.(model.id);
                }}
              >
                Use Model
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTableView = () => (
    <div className="models-table">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Type</th>
            <th>Provider</th>
            <th>Location</th>
            <th>Pricing</th>
            <th>Apps Using</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {MODELS.map(model => (
            <tr key={model.id} onClick={() => setSelectedModel(model)}>
              <td>
                <span className="model-icon">{model.icon}</span>
              </td>
              <td>{model.name}</td>
              <td>{model.type}</td>
              <td>{model.provider}</td>
              <td>
                <span className={`location-badge ${model.location}`}>
                  {model.location === 'cloud' ? '☁️ Cloud' : '💻 Local'}
                </span>
              </td>
              <td>
                <span className={`pricing-badge ${model.pricing.type}`}>
                  {model.pricing.details}
                </span>
              </td>
              <td>
                {model.usages.length > 0 ? (
                  <div className="apps-list">
                    {model.usages.map(usage => usage.appName).join(', ')}
                  </div>
                ) : (
                  '-'
                )}
              </td>
              <td>
                <span className={`status-badge ${model.status}`}>
                  {model.status === 'active' ? 'Active' : 'Available'}
                </span>
              </td>
              <td>
                {model.status === 'available' && (
                  <button 
                    className="use-model-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUseModel?.(model.id);
                    }}
                  >
                    Use Model
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="models-container">
      <div className="models-header">
        <h3>Model Management</h3>
        <div className="header-controls">
          <div className="model-actions">
            <div className="action-buttons">
              <button className="action-button" disabled>
                <span className="icon">➕</span>
                Create New Model
              </button>
              <button className="action-button" disabled>
                <span className="icon">🔄</span>
                Fine-tune Model
              </button>
              <button className="action-button" disabled>
                <span className="icon">🔍</span>
                Browse 3rd Party Models
              </button>
            </div>
          </div>
          {/* <div className="controls-separator"></div> */}
          <div className="view-toggle">
            <button 
              className={`toggle-button ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button 
              className={`toggle-button ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? renderGridView() : renderTableView()}

      {selectedModel && (
        <div className="model-details-overlay">
          {renderModelDetails(selectedModel)}
        </div>
      )}
    </div>
  );
};

export default ModelsTab; 