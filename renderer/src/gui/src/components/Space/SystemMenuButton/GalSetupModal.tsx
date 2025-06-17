import React, { useState, useEffect } from 'react';
import './GalSetupModal.scss';

interface SetupStep {
  id: string;
  title: string;
  subtitle: string;
  component: React.FC<StepProps>;
}

interface StepProps {
  onNext: () => void;
  onBack: () => void;
  onComplete: (data: any) => void;
  isLastStep: boolean;
  setupData: SetupData;
}

interface SetupData {
  personalization?: {
    name: string;
    purpose: string;
    url: string;
    useCustomUrl: boolean;
  };
  data_sources?: {
    selectedSources: string[];
  };
  intelligence?: {
    localModels: string[];
    apiKeys: {
      [key: string]: string;
    };
    selectedModels: {
      local: string[];
      cloud: string[];
    };
  };
  preferences?: {
    workStyle: string;
    communicationStyle: string;
  };
}

interface GalSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Step Components
const WelcomeStep: React.FC<StepProps> = ({ onNext }) => (
  <div className="setup-step welcome">
    <h1>Welcome to Gal</h1>
    <p className="subtitle">Your personal AI computer is ready to be configured.</p>
    <div className="welcome-content">
      <div className="feature">
        <span className="emoji">🧠</span>
        <h3>Personalized Intelligence</h3>
        <p>Your Gal learns and adapts to your unique way of working</p>
      </div>
      <div className="feature">
        <span className="emoji">🔐</span>
        <h3>Private & Secure</h3>
        <p>Your data stays on your device, under your control</p>
      </div>
      <div className="feature">
        <span className="emoji">⚡️</span>
        <h3>Always Ready</h3>
        <p>Instant responses and seamless integration with your digital life</p>
      </div>
    </div>
    <button className="next-button" onClick={onNext}>Begin Setup</button>
  </div>
);

const PersonalizationStep: React.FC<StepProps> = ({ onNext, onBack, onComplete, setupData }) => {
  const [name, setName] = useState(setupData.personalization?.name || '');
  const [purpose, setPurpose] = useState(setupData.personalization?.purpose || '');
  const [useCustomUrl, setUseCustomUrl] = useState(setupData.personalization?.useCustomUrl || false);
  const [url, setUrl] = useState(setupData.personalization?.url || '');
  
  const generateDefaultUrl = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.bedrock.computer';
  };

  useEffect(() => {
    if (!useCustomUrl && name) {
      setUrl(generateDefaultUrl(name));
    }
  }, [name, useCustomUrl]);
  
  return (
    <div className="setup-step personalization">
      <h2>Personalize Your Gal</h2>
      <p className="subtitle">Let's make your Gal uniquely yours</p>
      
      <div className="input-group">
        <label>What would you like to name your Gal?</label>
        <input 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Gal, Assistant, Companion..."
        />
      </div>
      
      <div className="input-group">
        <label>What will you primarily use your Gal for?</label>
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g., Work productivity, creative projects, running businesses, household management..."
        />
      </div>

      <div className="input-group url-group">
        <div className="url-header">
          <label>Your Gal's URL</label>
          <label className="custom-url-toggle">
            <input
              type="checkbox"
              checked={useCustomUrl}
              onChange={(e) => setUseCustomUrl(e.target.checked)}
            />
            Use custom URL
          </label>
        </div>
        <input 
          type="text" 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="your-gal.bedrock.computer"
          disabled={!useCustomUrl}
          className={useCustomUrl ? '' : 'auto-generated'}
        />
      </div>

      <div className="button-group">
        <button className="back-button" onClick={onBack}>Back</button>
        <button 
          className="next-button" 
          onClick={() => {
            onComplete({ name, purpose, url, useCustomUrl });
            onNext();
          }}
          disabled={!name || !purpose || !url}
        >
          Next
        </button>
      </div>
    </div>
  );
};

const DataSourcesStep: React.FC<StepProps> = ({ onNext, onBack, onComplete, setupData }) => {
  const [selectedSources, setSelectedSources] = useState<string[]>(
    setupData.data_sources?.selectedSources || []
  );
  
  const dataSources = [
    { id: 'email', name: 'Email', icon: '📧', description: 'Connect your email accounts' },
    { id: 'calendar', name: 'Calendar', icon: '📅', description: 'Sync your schedules and events' },
    { id: 'documents', name: 'Documents', icon: '📄', description: 'Access your files and documents' },
    { id: 'messages', name: 'Messages', icon: '💬', description: 'Connect messaging platforms' },
    { id: 'notes', name: 'Notes', icon: '📝', description: 'Sync your notes and thoughts' },
    { id: 'tasks', name: 'Tasks', icon: '✅', description: 'Manage your tasks and projects' }
  ];

  const toggleSource = (id: string) => {
    setSelectedSources(prev => {
      const newSources = prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id];
      
      // Update setup data immediately
      onComplete({ selectedSources: newSources });
      return newSources;
    });
  };

  return (
    <div className="setup-step data-sources">
      <h2>Connect Your Digital Life</h2>
      <p className="subtitle">Choose the data sources you'd like to connect with your Gal</p>
      
      <div className="sources-grid">
        {dataSources.map(source => (
          <div 
            key={source.id}
            className={`source-card ${selectedSources.includes(source.id) ? 'selected' : ''}`}
            onClick={() => toggleSource(source.id)}
          >
            <span className="source-icon">{source.icon}</span>
            <h3>{source.name}</h3>
            <p>{source.description}</p>
          </div>
        ))}
      </div>

      <div className="button-group">
        <button className="back-button" onClick={onBack}>Back</button>
        <button 
          className="next-button" 
          onClick={onNext}
        >
          Next
        </button>
      </div>
    </div>
  );
};

const IntelligenceStep: React.FC<StepProps> = ({ onNext, onBack, onComplete, setupData }) => {
  const [localModels, setLocalModels] = useState<string[]>(
    setupData.intelligence?.localModels || []
  );
  const [apiKeys, setApiKeys] = useState<{[key: string]: string}>(
    setupData.intelligence?.apiKeys || {}
  );
  const [selectedModels, setSelectedModels] = useState<{local: string[], cloud: string[]}>(
    setupData.intelligence?.selectedModels || { local: [], cloud: [] }
  );

  const availableLocalModels = [
    { id: 'gpt4all', name: 'GPT4All', size: '4GB', type: 'Language' },
    { id: 'stablelm', name: 'StableLM', size: '3GB', type: 'Language' },
    { id: 'whisper', name: 'Whisper', size: '2GB', type: 'Speech' },
    { id: 'stablediffusion', name: 'Stable Diffusion', size: '5GB', type: 'Image' },
  ];

  const cloudProviders = [
    { id: 'openai', name: 'OpenAI', models: ['GPT-4', 'GPT-3.5'] },
    { id: 'anthropic', name: 'Anthropic', models: ['Claude 3 Opus', 'Claude 3 Sonnet'] },
  ];

  return (
    <div className="setup-step intelligence">
      <h2>Configure Intelligence</h2>
      <p className="subtitle">Choose the AI models that will power your Gal</p>

      <div className="models-section">
        <h3>Local Models</h3>
        <p className="section-desc">These models run directly on your device for privacy and speed</p>
        
        <div className="model-grid">
          {availableLocalModels.map(model => (
            <div 
              key={model.id}
              className={`model-card ${selectedModels.local.includes(model.id) ? 'selected' : ''}`}
              onClick={() => setSelectedModels(prev => ({
                ...prev,
                local: prev.local.includes(model.id) 
                  ? prev.local.filter(id => id !== model.id)
                  : [...prev.local, model.id]
              }))}
            >
              <div className="model-info">
                <h4>{model.name}</h4>
                <span className="model-meta">{model.size} • {model.type}</span>
              </div>
              <div className="model-status">
                {selectedModels.local.includes(model.id) ? 'Selected' : 'Optional'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="models-section">
        <h3>Cloud Models</h3>
        <p className="section-desc">Connect to powerful cloud AI models</p>

        {cloudProviders.map(provider => (
          <div key={provider.id} className="cloud-provider">
            <div className="provider-header">
              <h4>{provider.name}</h4>
              <input
                type="text"
                placeholder={`${provider.name} API Key`}
                value={apiKeys[provider.id] || ''}
                onChange={(e) => setApiKeys(prev => ({
                  ...prev,
                  [provider.id]: e.target.value
                }))}
              />
            </div>
            {apiKeys[provider.id] && (
              <div className="cloud-models">
                {provider.models.map(model => (
                  <label key={model} className="cloud-model-option">
                    <input
                      type="checkbox"
                      checked={selectedModels.cloud.includes(model)}
                      onChange={(e) => setSelectedModels(prev => ({
                        ...prev,
                        cloud: e.target.checked
                          ? [...prev.cloud, model]
                          : prev.cloud.filter(m => m !== model)
                      }))}
                    />
                    {model}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="button-group">
        <button className="back-button" onClick={onBack}>Back</button>
        <button 
          className="next-button" 
          onClick={() => {
            onComplete({ localModels, apiKeys, selectedModels });
            onNext();
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

const PreferencesStep: React.FC<StepProps> = ({ onNext, onBack, onComplete, isLastStep, setupData }) => {
  const [preferences, setPreferences] = useState({
    workStyle: setupData.preferences?.workStyle || '',
    communicationStyle: setupData.preferences?.communicationStyle || ''
  });

  return (
    <div className="setup-step preferences">
      <h2>Set Your Preferences</h2>
      <p className="subtitle">Help your Gal understand how you like to work</p>

      <div className="preference-group">
        <label>How do you prefer to work?</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              name="workStyle"
              value="structured"
              checked={preferences.workStyle === 'structured'}
              onChange={(e) => setPreferences(prev => ({ ...prev, workStyle: e.target.value }))}
            />
            Structured and organized
          </label>
          <label>
            <input
              type="radio"
              name="workStyle"
              value="flexible"
              checked={preferences.workStyle === 'flexible'}
              onChange={(e) => setPreferences(prev => ({ ...prev, workStyle: e.target.value }))}
            />
            Flexible and adaptive
          </label>
        </div>
      </div>

      <div className="preference-group">
        <label>How should your Gal communicate?</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              name="communicationStyle"
              value="direct"
              checked={preferences.communicationStyle === 'direct'}
              onChange={(e) => setPreferences(prev => ({ ...prev, communicationStyle: e.target.value }))}
            />
            Direct and concise
          </label>
          <label>
            <input
              type="radio"
              name="communicationStyle"
              value="detailed"
              checked={preferences.communicationStyle === 'detailed'}
              onChange={(e) => setPreferences(prev => ({ ...prev, communicationStyle: e.target.value }))}
            />
            Detailed and explanatory
          </label>
        </div>
      </div>

      <div className="button-group">
        <button className="back-button" onClick={onBack}>Back</button>
        <button 
          className="next-button" 
          onClick={() => {
            onComplete(preferences);
            onNext();
          }}
          disabled={!preferences.workStyle || !preferences.communicationStyle}
        >
          {isLastStep ? 'Complete Setup' : 'Next'}
        </button>
      </div>
    </div>
  );
};

const GalSetupModal: React.FC<GalSetupModalProps> = ({ isOpen, onClose }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [setupData, setSetupData] = useState<SetupData>({});
  const [computeUsage, setComputeUsage] = useState(45); // Mock compute usage

  // Simulate changing compute usage
  useEffect(() => {
    const interval = setInterval(() => {
      setComputeUsage(prev => {
        const change = Math.random() * 10 - 5; // Random change between -5 and 5
        return Math.min(Math.max(prev + change, 0), 100); // Keep between 0 and 100
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const steps: SetupStep[] = [
    {
      id: 'welcome',
      title: 'Welcome',
      subtitle: 'Begin your journey with Gal',
      component: WelcomeStep
    },
    {
      id: 'personalization',
      title: 'Personalization',
      subtitle: 'Make it yours',
      component: PersonalizationStep
    },
    {
      id: 'data-sources',
      title: 'Data Sources',
      subtitle: 'Connect your world',
      component: DataSourcesStep
    },
    {
      id: 'intelligence',
      title: 'Intelligence',
      subtitle: 'Configure AI models',
      component: IntelligenceStep
    },
    {
      id: 'preferences',
      title: 'Preferences',
      subtitle: 'Customize your experience',
      component: PreferencesStep
    }
  ];

  const handleStepComplete = (stepData: any) => {
    setSetupData(prev => ({
      ...prev,
      [steps[currentStepIndex].id]: stepData
    }));
  };

  const handleComplete = () => {
    console.log('Setup completed with data:', setupData);
    onClose();
  };

  if (!isOpen) return null;

  const CurrentStepComponent = steps[currentStepIndex].component;

  return (
    <div className="gal-setup-modal">
      <div className="gal-modal-content">
        <div className="progress-bar">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`progress-step ${
                index === currentStepIndex 
                  ? 'active' 
                  : index < currentStepIndex 
                    ? 'completed' 
                    : ''
              }`}
            >
              <div className="step-indicator">
                {index < currentStepIndex ? '✓' : index + 1}
              </div>
              <div className="step-details">
                <div className="step-title">{step.title}</div>
                <div className="step-subtitle">{step.subtitle}</div>
              </div>
            </div>
          ))}
        </div>

        <CurrentStepComponent
          onNext={() => setCurrentStepIndex(prev => prev + 1)}
          onBack={() => setCurrentStepIndex(prev => prev - 1)}
          onComplete={handleStepComplete}
          isLastStep={currentStepIndex === steps.length - 1}
          setupData={setupData}
        />

        <div className="system-status">
          <div className="main-content">
            <div className="device-image" />
            
            <div className="system-info">
              <div className="info-row">
                <div className="detail-group">
                  <div className="label">NAME</div>
                  <div className="value">
                    {setupData.personalization?.name || "Not set"}
                  </div>
                </div>
                
                <div className="detail-group">
                  <div className="label">URL</div>
                  <div className="value">
                    {setupData.personalization?.url || "Not set"}
                  </div>
                </div>

                <div className="detail-group">
                  <div className="label">ACCOUNT</div>
                  <div className="value">username</div>
                </div>
              </div>

              <div className="info-row">
                <div className="detail-group">
                  <div className="label">DATA</div>
                  <div className="value">
                    {(setupData.data_sources?.selectedSources || []).length} integrations
                  </div>
                </div>

                <div className="detail-group">
                  <div className="label">INTELLIGENCE</div>
                  <div className="value intelligence">
                    <div className="model-count">
                      <span className="count">{(setupData.intelligence?.selectedModels?.local || []).length}</span>
                      <span className="type">local models</span>
                    </div>
                    <div className="model-count">
                      <span className="count">{(setupData.intelligence?.selectedModels?.cloud || []).length}</span>
                      <span className="type">cloud models</span>
                    </div>
                  </div>
                </div>

                <div className="detail-group">
                  <div className="label">BIOMETRICS</div>
                  <div className="value">Face</div>
                </div>
              </div>
            </div>
          </div>

          <div className="status-bar">
            <div className="device-status">
              <div className="status-indicator" />
              <span className="device-id">gal_001:8f39</span>
              <span className="status-text">Connected</span>
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

        <button className="close-button" onClick={onClose}>×</button>
      </div>
    </div>
  );
};

export default GalSetupModal; 