import React, { useState, useEffect, useRef } from 'react';
import { GalDevice } from '../../hooks/useUSBDevices';
import { debug } from '../../utils/debug';
import { SystemStatus } from './SystemStatus';
import './ConfigureGalBoxModal.scss';
import { Terminal } from '../Terminal/Terminal';
import useGalBoxStore from './store/galboxStore';
import { UIGalBox, GalBoxError } from './types/galbox';

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
  device: GalDevice;
}

interface SetupData {
  basic?: {
    name: string;
  };
  ollama?: {
    install: boolean;
    version?: string;
    credentials?: {
      username: string;
      password: string;
    };
  };
  model?: {
    create: boolean;
    name: string;
    writingSample: string;
    baseModel?: string;
    phoneNumber?: string;
    notifyOnComplete?: boolean;
  };
}

interface ConfigureGalBoxModalProps {
  device: GalDevice;
  onClose: () => void;
  onComplete: (serialNumber: string, config: any) => void;
}

// Helper function to get device display ID
function getDeviceDisplayId(device: GalDevice): string {
  return `gal_${device.serialNumber.slice(-8)}`;
}

// Step Components
const BasicConfigStep: React.FC<StepProps> = ({ onNext, onComplete, setupData }) => {
  const [name, setName] = useState(setupData.basic?.name || '');

  return (
    <div className="setup-step">
      <h2>Name Your Box</h2>
      <p className="subtitle">Give your Gal Box a unique identifier</p>
      
      <div className="input-group">
        <label>Device Name</label>
        <input 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a name for this device"
          className="styled-input"
        />
      </div>

      <div className="button-group">
        <button 
          className="next-button" 
          onClick={() => {
            onComplete({ name });
            onNext();
          }}
          disabled={!name.trim()}
        >
          Next
        </button>
      </div>
    </div>
  );
};

const OllamaSetupStep: React.FC<StepProps> = ({ onNext, onBack, onComplete, setupData, device }) => {
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [ip, setIp] = useState(device.ip || '192.168.2.2');
  const [username, setUsername] = useState('brian');
  const [password, setPassword] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const terminalRef = useRef<{ 
    write: (data: string) => void;
    writeCommand: (cmd: string) => void;
    writeError: (error: string) => void;
    writeSuccess: (message: string) => void;
    clear: () => void;
  }>(null);
  const { createGalBox, updateOllamaVersion, updateStatus } = useGalBoxStore();

  const checkOllamaInstallation = async (credentials: { ip: string; username: string; password: string }) => {
    try {
      terminalRef.current?.writeCommand('Checking for existing Ollama installation...');
      
      const result = await window.electron.ipcRenderer.invoke('check-ollama', {
        ip: credentials.ip,
        credentials: {
          username: credentials.username,
          password: credentials.password
        }
      });
      
      if (result?.error) {
        // If we got an error response, Ollama is not installed
        terminalRef.current?.write('Ollama is not installed on the system.\r\n');
        return false;
      }
      
      if (result?.version) {
        setStatus('Ollama already installed');
        terminalRef.current?.writeSuccess(`Ollama version ${result.version} is already installed`);
        onComplete({ 
          install: true, 
          version: result.version,
          credentials: { username, password }
        });
        onNext();
        return true;
      }
      
      terminalRef.current?.write('No existing Ollama installation found.\r\n');
      return false;
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown error occurred while checking Ollama installation';
      terminalRef.current?.writeError(`Failed to check Ollama installation: ${errorMessage}`);
      setError(`Connection failed: ${errorMessage}`);
      return false;
    }
  };

  useEffect(() => {
    const handleProgress = async (data: any) => {
      const { status, error, version, log, progress: newProgress, command, output } = data;
      
      if (command) {
        terminalRef.current?.writeCommand(command);
      }
      
      if (output) {
        const cleanOutput = output.replace(/\r/g, '\n').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
        if (cleanOutput.trim()) {
          terminalRef.current?.write(cleanOutput);
        }
      }
      
      if (status) {
        setStatus(status);
        terminalRef.current?.write(`\n${status}\n`);
      }
      
      if (error) {
        setError(error);
        terminalRef.current?.writeError(error);
        setIsInstalling(false);
        await updateStatus('error');
      }
      
      if (version) {
        terminalRef.current?.writeSuccess(`Ollama version ${version} installed successfully`);
        setIsInstalling(false);
        await updateOllamaVersion(version);
        await updateStatus('ready');
        onComplete({ 
          install: true, 
          version,
          credentials: { username, password }
        });
        setTimeout(() => onNext(), 1000);
      }
      
      if (log) {
        terminalRef.current?.write(`${log}\n`);
      }
      
      if (newProgress !== undefined) {
        setProgress(newProgress);
      }
    };

    if (isInstalling) {
      window.electron.ipcRenderer.on('ollama-install-progress', handleProgress);
      return () => {
        window.electron.ipcRenderer.removeListener('ollama-install-progress', handleProgress);
      };
    }
  }, [isInstalling, onComplete, onNext, updateOllamaVersion, updateStatus]);

  const handleInstall = async () => {
    if (!ip || !username || !password) {
      setError('Please provide all required information');
      return;
    }

    setShowTerminal(true);
    setIsInstalling(true);
    setError('');
    setProgress(0);

    try {
      // Create GalBox entity first
      await createGalBox({
        serialNumber: device.serialNumber,
        name: setupData.basic?.name || 'Unnamed GalBox',
        ipAddress: ip,
        username: username
      }).catch(async (err: Error) => {
        // If error is not "already exists", throw it
        if (!err.message?.includes('already exists')) {
          throw err;
        }
        // Otherwise continue with the existing GalBox
        terminalRef.current?.writeSuccess('Using existing GalBox configuration');
      });

      const credentials = { ip, username, password };
      
      terminalRef.current?.clear();
      terminalRef.current?.writeCommand('Checking for existing Ollama installation...');
      
      const isInstalled = await checkOllamaInstallation(credentials);
      if (isInstalled) {
        setIsInstalling(false);
        return;
      }

      terminalRef.current?.writeSuccess('Starting Ollama installation...');

      const result = await window.electron.ipcRenderer.invoke('install-ollama', {
        ip,
        credentials: { username, password }
      });
      
      if (result?.error) {
        setError(result.error);
        terminalRef.current?.writeError(result.error);
        setIsInstalling(false);
        await updateStatus('error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start installation. Please try again.';
      setError(errorMessage);
      terminalRef.current?.writeError(errorMessage);
      setIsInstalling(false);
      await updateStatus('error');
    }
  };

  return (
    <div className="setup-step">
      <h3>Installing Ollama</h3>
      <p>Please provide your Gal Box credentials to install Ollama</p>

      <div className="input-group">
        <label>IP Address</label>
        <input
          type="text"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="Enter IP address"
          className="styled-input"
          disabled={isInstalling || !!device.ip}
        />
        {device.ip && (
          <div className="info-text">IP address automatically detected</div>
        )}
      </div>

      <div className="input-group">
        <label>Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter SSH username"
          className="styled-input"
          disabled={isInstalling}
        />
      </div>

      <div className="input-group">
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter SSH password"
          className="styled-input"
          disabled={isInstalling}
        />
      </div>

      {!isInstalling && (
        <div className="button-group">
          <button 
            className="next-button" 
            onClick={handleInstall}
            disabled={!ip || !username || !password}
          >
            Start Installation
          </button>
        </div>
      )}

      {showTerminal && (
        <>
          <div className="installation-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <div className="progress-text">{progress}%</div>
          </div>

          <div className="terminal-wrapper">
            <Terminal ref={terminalRef} />
          </div>
        </>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

const ModelSetupStep: React.FC<StepProps> = ({ onNext, onBack, onComplete, isLastStep, setupData, device }) => {
  const [createModel, setCreateModel] = useState(setupData.model?.create ?? false);
  const [modelName, setModelName] = useState(setupData.model?.name || '');
  const [writingSample, setWritingSample] = useState(setupData.model?.writingSample || '');
  const [baseModel, setBaseModel] = useState('llama3');
  const [phoneNumber, setPhoneNumber] = useState(setupData.model?.phoneNumber || '');
  const [notifyOnComplete, setNotifyOnComplete] = useState(setupData.model?.notifyOnComplete ?? false);
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [showTerminal, setShowTerminal] = useState(false);
  const terminalRef = useRef<{ 
    write: (data: string) => void;
    writeCommand: (cmd: string) => void;
    writeError: (error: string) => void;
    writeSuccess: (message: string) => void;
    clear: () => void;
  }>(null);
  const { updateStatus } = useGalBoxStore();

  // Listen for model creation progress updates
  useEffect(() => {
    const handleModelProgress = (data: any) => {
      const { modelName, progress: newProgress, output, error, status } = data;
      
      if (output) {
        terminalRef.current?.write(output);
      }
      
      if (error) {
        terminalRef.current?.writeError(error);
        setError(error);
      }
      
      if (status === 'completed') {
        terminalRef.current?.writeSuccess(`Model ${modelName} created successfully!`);
        setIsCreating(false);
        onComplete({
          create: true,
          name: modelName,
          writingSample,
          baseModel,
          phoneNumber,
          notifyOnComplete
        });
        
        // Show success message but allow user to continue right away
        setTimeout(() => onNext(), 2000);
      } else if (status === 'error') {
        setIsCreating(false);
        setError(`Model creation failed: ${error}`);
      }
      
      if (newProgress !== undefined) {
        setProgress(newProgress);
      }
    };

    window.electron.ipcRenderer.on('ollama-model-progress', handleModelProgress);
    return () => {
      window.electron.ipcRenderer.removeListener('ollama-model-progress', handleModelProgress);
    };
  }, [onComplete, onNext, writingSample, baseModel, phoneNumber, notifyOnComplete]);

  const handleCreateModel = async () => {
    if (!createModel || !modelName.trim() || !writingSample.trim()) {
      return;
    }

    setIsCreating(true);
    setError('');
    setProgress(0);
    setShowTerminal(true);

    try {
      terminalRef.current?.clear();
      terminalRef.current?.writeCommand(`Creating custom model: ${modelName}`);
      terminalRef.current?.write(`Using base model: ${baseModel}\n`);
      terminalRef.current?.write(`Writing sample length: ${writingSample.length} characters\n`);
      
      if (notifyOnComplete && phoneNumber) {
        terminalRef.current?.write(`SMS notification will be sent to ${phoneNumber} when complete\n`);
      }
      
      terminalRef.current?.write(`Starting model creation process...\n`);
      terminalRef.current?.writeSuccess("You can continue with setup while the model trains in the background");

      // Get credentials from Ollama setup
      let username = '';
      let password = '';
      
      if (setupData.ollama?.credentials) {
        username = setupData.ollama.credentials.username;
        password = setupData.ollama.credentials.password;
      }
      
      if (!username) {
        terminalRef.current?.writeError('Missing username. Please go back to the Ollama setup step.');
        setIsCreating(false);
        setError('Missing credentials');
        return;
      }

      await window.electron.ipcRenderer.invoke('create-ollama-model', {
        ip: device.ip,
        credentials: { username, password },
        modelName,
        baseModel,
        writingSample,
        notifyOnComplete,
        phoneNumber: notifyOnComplete ? phoneNumber : null
      });
      
      // Skip the timeout and allow immediate continuation
      terminalRef.current?.writeSuccess("Model training has started and will continue in the background");
      setTimeout(() => {
        setShowTerminal(false);
        onComplete({
          create: true,
          name: modelName,
          writingSample,
          baseModel,
          phoneNumber,
          notifyOnComplete,
          inProgress: true
        });
        onNext();
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create model. Please try again.';
      setError(errorMessage);
      terminalRef.current?.writeError(errorMessage);
      setIsCreating(false);
    }
  };

  const handleSkipOrComplete = () => {
    onComplete({
      create: createModel,
      name: modelName,
      writingSample,
      baseModel,
      phoneNumber,
      notifyOnComplete
    });
    onNext();
  };

  // Helper to extract sample text length guidance
  const getSampleGuidance = () => {
    if (writingSample.length < 200) {
      return "Very short - the model may not learn your style well";
    } else if (writingSample.length < 500) {
      return "Short - provides some stylistic elements";
    } else if (writingSample.length < 1000) {
      return "Good - should capture basic writing patterns";
    } else if (writingSample.length < 3000) {
      return "Great - should capture more nuanced writing style";
    } else {
      return "Excellent - should provide a strong stylistic template";
    }
  };

  return (
    <div className="setup-step">
      <h2>Personal AI Model</h2>
      <p className="subtitle">Create your own custom AI model</p>

      <div className="checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={createModel}
            onChange={(e) => setCreateModel(e.target.checked)}
            disabled={isCreating}
          />
          Create a custom AI model based on your writing style
        </label>
      </div>

      {createModel && (
        <>
          <div className="input-group">
            <label>Model Name</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="Name your custom model"
              className="styled-input"
              disabled={isCreating}
            />
          </div>
          
          <div className="input-group">
            <label>Base Model</label>
            <select
              value={baseModel}
              onChange={(e) => setBaseModel(e.target.value)}
              className="styled-input"
              disabled={isCreating}
            >
              <option value="llama3">Llama 3</option>
              <option value="mistral">Mistral</option>
              <option value="phi3">Phi-3</option>
            </select>
          </div>
          
          <div className="input-group">
            <label>Writing Sample</label>
            <p className="helper-text">
              Paste examples of your writing style here. For best results, include emails, notes, or other content written in your natural voice.
              Better samples should be 500-3000 characters, but longer is generally better.
              {writingSample && (
                <span className="sample-quality">
                  Current sample: <strong>{getSampleGuidance()}</strong> ({writingSample.length} characters)
                </span>
              )}
            </p>
            <textarea
              value={writingSample}
              onChange={(e) => setWritingSample(e.target.value)}
              placeholder="Paste your writing samples here. You can include multiple examples, emails, notes or other content that represents your writing style."
              className="styled-textarea"
              rows={8}
              disabled={isCreating}
            />
          </div>
          
          <div className="notification-group">
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={notifyOnComplete}
                  onChange={(e) => setNotifyOnComplete(e.target.checked)}
                  disabled={isCreating}
                />
                Notify me when model creation is complete
              </label>
            </div>
            
            {notifyOnComplete && (
              <div className="input-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter your phone number"
                  className="styled-input"
                  disabled={isCreating}
                />
                <p className="helper-text">We'll send you a text message when your model is ready</p>
              </div>
            )}
          </div>
        </>
      )}

      {showTerminal && (
        <>
          <div className="installation-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <div className="progress-text">{progress > 0 ? `${progress}%` : 'Processing...'}</div>
          </div>

          <div className="terminal-wrapper">
            <Terminal ref={terminalRef} />
          </div>
        </>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="button-group">
        <button className="back-button" onClick={onBack} disabled={isCreating}>
          Back
        </button>

        {createModel && !isCreating && (
          <button 
            className="create-button" 
            onClick={handleCreateModel}
            disabled={isCreating || !modelName.trim() || !writingSample.trim() || (notifyOnComplete && !phoneNumber)}
          >
            Create Model
          </button>
        )}

        <button 
          className="next-button" 
          onClick={handleSkipOrComplete}
          disabled={isCreating || (createModel && (!modelName.trim() || !writingSample.trim() || (notifyOnComplete && !phoneNumber)))}
        >
          {createModel ? 'Skip Creation for Now' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
};

export function ConfigureGalBoxModal({ device, onClose, onComplete }: ConfigureGalBoxModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [setupData, setSetupData] = useState<SetupData>({});
  const [error, setError] = useState<string | null>(null);
  const [computeUsage, setComputeUsage] = useState(45);
  const { fetchGalBox, activeGalBox } = useGalBoxStore();

  // Check for existing GalBox on mount
  useEffect(() => {
    const checkExistingGalBox = async () => {
      try {
        await fetchGalBox(device.serialNumber);
      } catch (err) {
        // If not found, that's fine - we'll create a new one
        if (!(err instanceof GalBoxError && err.code === 'NOT_FOUND')) {
          console.error('Error checking for existing GalBox:', err);
        }
      }
    };

    checkExistingGalBox();
  }, [device.serialNumber, fetchGalBox]);

  // Update setup data when activeGalBox changes
  useEffect(() => {
    if (activeGalBox) {
      setSetupData({
        basic: {
          name: activeGalBox.name
        },
        ollama: {
          install: !!activeGalBox.ollamaVersion
        }
      });
      
      // Update system status
      if (activeGalBox.status === 'ready') {
        setCurrentStepIndex(steps.length - 1); // Move to last step if setup is complete
      }
    }
  }, [activeGalBox]);

  // Simulate changing compute usage
  useEffect(() => {
    const interval = setInterval(() => {
      setComputeUsage(prev => {
        const change = Math.random() * 10 - 5;
        return Math.min(Math.max(prev + change, 0), 100);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const steps: SetupStep[] = [
    {
      id: 'basic',
      title: 'Basic Setup',
      subtitle: 'Configure your device',
      component: BasicConfigStep
    },
    {
      id: 'ollama',
      title: 'Ollama Setup',
      subtitle: 'Install Ollama on your device',
      component: OllamaSetupStep
    },
    {
      id: 'model',
      title: 'Model Setup',
      subtitle: 'Configure your AI model',
      component: ModelSetupStep
    }
  ];

  const handleStepComplete = (stepData: any) => {
    setSetupData(prev => ({
      ...prev,
      [steps[currentStepIndex].id]: stepData
    }));
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStepIndex(nextIndex);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleComplete = () => {
    const config = {
      name: setupData.basic?.name,
      ollamaInstalled: setupData.ollama?.install,
      modelCreated: setupData.model?.create,
      modelName: setupData.model?.name,
      writingSample: setupData.model?.writingSample
    };

    onComplete(device.serialNumber, config);
  };

  // Safety check for current step index
  if (currentStepIndex >= steps.length) {
    setCurrentStepIndex(steps.length - 1);
    return null;
  }

  const CurrentStepComponent = steps[currentStepIndex].component;
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <div className="gal-configure-modal">
      <div className="gal-modal-content">
        <div className="gal-modal-header">
          <h1>Configure Your Gal Box!</h1>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="gal-modal-body">
          <div className="progress-steps">
            {steps.map((step, index) => (
              <div 
                key={step.id}
                className={`step ${index === currentStepIndex ? 'active' : ''} ${index < currentStepIndex ? 'completed' : ''}`}
              >
                <div className="step-number">{index + 1}</div>
                <div className="step-info">
                  <div className="step-title">{step.title}</div>
                  <div className="step-subtitle">{step.subtitle}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="content-section">
            <p className="subtitle">Let's set up your personal AI computer</p>

            <CurrentStepComponent
              onNext={handleNext}
              onBack={handleBack}
              onComplete={handleStepComplete}
              isLastStep={isLastStep}
              setupData={setupData}
              device={device}
            />

            {error && <div className="error-message">{error}</div>}
          </div>

          <SystemStatus
            deviceId={getDeviceDisplayId(device)}
            name={setupData.basic?.name}
            ollamaInstalled={setupData.ollama?.install}
            modelCreated={setupData.model?.create}
            computeUsage={computeUsage}
            status="Setting up"
          />
        </div>
      </div>
    </div>
  );
} 