import './ModelSelector.scss';

import React, { useEffect, useRef, useState } from 'react';

import { CustomModelIcon } from './CustomModelIcon';
import { useGalBoxServer } from '../../../../hooks/useGalBoxServer';
import personalModelService from '../../../../apps/PersonalModelApp/utils/personalModelService';
import { UIPersonalModel } from '../../../../apps/PersonalModelApp/types';
import { useUiStore } from '../store/uiStore';
import { getModels } from '../utils/streamHelpers';
import { logger } from '../../../../utils/logger';

// Define which models are actually available in the backend
const AVAILABLE_BACKENDS = {
  // OpenAI models
  'gpt-3.5-turbo': true,
  'gpt-4': true,
  
  // Claude models - using Anthropic
  'claude-3-opus': true,
  'claude-3-sonnet': true, 
  'claude-3-haiku': true,
  'claude-3.5-sonnet': true,
  
  // Models without backend implementation
  'claude-3.7-sonnet-thinking': false,
  'gpt-4o': false,
  'gpt-4.5-preview': false,
  'bedrock-small': false
};


export type ModelType = 
  | 'claude-3.5-sonnet'
  | 'claude-3.7-sonnet-thinking'
  | 'gpt-4o'
  | 'gpt-4.5-preview'
  | 'bedrock-small'
  | CustomModelType
  | GalBoxModelType
  | PersonalModelType;  // Add Personal model type

export const AVAILABLE_MODELS: ModelType[] = [
  'claude-3.5-sonnet',
  'claude-3.7-sonnet-thinking',
  'gpt-4o',
  'gpt-4.5-preview',
  'bedrock-small'
];

// Add custom model types
export type CustomModelType = 
  | 'seed-fundraising'
  | 'my-fiction-writing'
  | 'webmd-notes'
  | 'mastermind';

// GalBox models can have any name since they're dynamically loaded
export type GalBoxModelType = string;

// Personal models from the Personal Models API
export type PersonalModelType = string;

export const CUSTOM_MODELS: { id: CustomModelType; name: string }[] = [
  { id: 'seed-fundraising', name: 'Seed Fundraising' },
  { id: 'my-fiction-writing', name: 'My Fiction Writing' },
  { id: 'webmd-notes', name: 'WebMD + Notes' },
  { id: 'mastermind', name: 'Mastermind' }
];

interface ModelSelectorProps {
  model: ModelType;
  onModelChange: (model: ModelType) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  model,
  onModelChange,
  disabled = false
}) => {
  const { models, setModels } = useUiStore();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { serverStatus } = useGalBoxServer();
  const [galBoxModels, setGalBoxModels] = useState<string[]>([]);
  const [personalModels, setPersonalModels] = useState<UIPersonalModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingPersonalModels, setIsLoadingPersonalModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [personalModelError, setPersonalModelError] = useState<string | null>(null);

  // Check if a model is available for use
  const isModelAvailable = (modelName: string): boolean => {
    // Personal models are always available
    if (personalModels.some(m => m.id === modelName)) {
      return true;
    }
    
    // GalBox models are available if server is online
    if (galBoxModels.includes(modelName)) {
      return serverStatus.online;
    }
    
    // Cloud models depend on the backend implementation
    return AVAILABLE_BACKENDS[modelName as keyof typeof AVAILABLE_BACKENDS] === true;
  };

  // Fetch GalBox models when the component mounts or when server status changes
  useEffect(() => {
    const fetchGalBoxModels = async () => {
      if (!serverStatus.online) {
        setGalBoxModels([]);
        setFetchError(null);
        return;
      }

      setIsLoadingModels(true);
      setFetchError(null);
      
      try {
        logger.log('[ModelSelector] Fetching GalBox models, server status:', serverStatus);
        
        // Fetch models directly from the GalBox API server
        const response = await fetch(`http://${serverStatus.address}:3001/models`);
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json();
        logger.log('[ModelSelector] Models received from GalBox:', data);
        
        // Extract model names from the response (models are in the 'models' array)
        if (data && Array.isArray(data.models)) {
          const modelNames = data.models.map((model: { name: string }) => model.name);
          setGalBoxModels(modelNames);
        } else {
          logger.warn('[ModelSelector] Unexpected API response format:', data);
          setGalBoxModels([]);
          setFetchError('Could not parse model list from server');
        }
      } catch (error) {
        logger.error('[ModelSelector] Failed to fetch GalBox models:', error);
        setGalBoxModels([]);
        setFetchError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchGalBoxModels();
  }, [serverStatus.online, serverStatus.address]);

  // Fetch personal models when the component mounts
  useEffect(() => {
    const fetchPersonalModels = async () => {
      setIsLoadingPersonalModels(true);
      setPersonalModelError(null);
      
      try {
        logger.log('[ModelSelector] Fetching personal models');
        const models = await personalModelService.fetchModels();
        logger.log('[ModelSelector] Personal models received:', models);
        
        // Only include trained models that are ready to use
        const trainedModels = models.filter(model => 
          model.status === 'ready' || model.status === 'draft'
        );
        
        setPersonalModels(trainedModels);
      } catch (error) {
        logger.error('[ModelSelector] Failed to fetch personal models:', error);
        setPersonalModels([]);
        setPersonalModelError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoadingPersonalModels(false);
      }
    };

    fetchPersonalModels();
  }, []);

  useEffect(() => {
    const fetchModels = async () => {
      setModels(AVAILABLE_MODELS);
      logger.log('[ModelSelector][useEffect] Fetching models');
      const models = await getModels();
      const modelIds = models.map((model: any) => model.id);
      logger.log('[ModelSelector][useEffect] Models:', models);
      setModels(modelIds);
      onModelChange(modelIds[0]);
    };
    fetchModels();
  }, [setModels]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside both button and dropdown
      if (
        buttonRef.current && 
        dropdownRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleModelChange = (newModel: ModelType) => {
    logger.log('ModelSelector handling click:', newModel);
    onModelChange(newModel);
    setIsOpen(false);
  };

  // Display a message based on GalBox status
  const renderGalBoxStatusMessage = () => {
    if (!serverStatus.online) {
      return (
        <div className="galbox-status-placeholder warning">
          <p>GalBox Server Offline</p>
          <p className="status-note">Check if your GalBox server is running at {serverStatus.address || 'unknown IP'}</p>
        </div>
      );
    }
    
    if (isLoadingModels) {
      return (
        <div className="galbox-status-placeholder info">
          <p>Loading models from GalBox Server...</p>
        </div>
      );
    }
    
    if (fetchError) {
      return (
        <div className="galbox-status-placeholder error">
          <p>Error: {fetchError}</p>
          <p className="status-note">Make sure the GalBox API server is running and Ollama is installed</p>
        </div>
      );
    }

    if (galBoxModels.length === 0) {
      return (
        <div className="galbox-status-placeholder warning">
          <p>No models found on GalBox</p>
          <p className="status-note">To install models, connect to your GalBox and run:</p>
          <p className="status-note code">ollama pull modelname</p>
        </div>
      );
    }
    
    return null;
  };

  // Display a message based on Personal Models status
  const renderPersonalModelsStatusMessage = () => {
    if (isLoadingPersonalModels) {
      return (
        <div className="personal-models-status-placeholder info">
          <p>Loading personal models...</p>
        </div>
      );
    }
    
    if (personalModelError) {
      return (
        <div className="personal-models-status-placeholder error">
          <p>Error: {personalModelError}</p>
        </div>
      );
    }

    if (personalModels.length === 0) {
      return (
        <div className="personal-models-status-placeholder info">
          <p>No trained personal models available</p>
          <p className="status-note">Create and train models in the Personal Models app</p>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="model-selector">
      <button 
        ref={buttonRef}
        type="button" 
        className="action-button model-button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={disabled}
      >
        {model}
      </button>
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="model-dropdown"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cloud Models */}
          <div className="model-section-header">Cloud Models</div>
          {/* {AVAILABLE_MODELS.map((modelOption) => ( */}
          {models.map((modelOption) => (
            <button
              key={modelOption}
              type="button"
              className={`model-option ${model === modelOption ? 'active' : ''} ${!isModelAvailable(modelOption) ? 'unavailable' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isModelAvailable(modelOption)) {
                  handleModelChange(modelOption);
                }
              }}
              disabled={!isModelAvailable(modelOption)}
            >
              {modelOption}
              {!isModelAvailable(modelOption) && <span className="unavailable-label">(Coming Soon)</span>}
              {model === modelOption && <span className="check">✓</span>}
            </button>
          ))}
          
          {/* GalBox Models - Always show this section */}
          <div className="model-section-header">
            GalBox Models 
            {isLoadingModels && <span className="loading-indicator">...</span>}
            {serverStatus.online && <span className="connection-status online">• Connected</span>}
            {!serverStatus.online && <span className="connection-status offline">• Offline</span>}
          </div>
          
          {/* Show GalBox models if available */}
          {galBoxModels.length > 0 && galBoxModels.map((modelName) => (
            <button
              key={`galbox-${modelName}`}
              type="button"
              className={`model-option galbox ${model === modelName ? 'active' : ''} ${!serverStatus.online ? 'unavailable' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (serverStatus.online) {
                  handleModelChange(modelName as ModelType);
                }
              }}
              disabled={!serverStatus.online}
            >
              <span className="galbox-indicator" style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: serverStatus.online ? '#00c853' : '#ccc',
                marginRight: '6px'
              }}></span>
              <span>{modelName}</span>
              {model === modelName && <span className="check">✓</span>}
            </button>
          ))}
          
          {/* Show appropriate message when no models are available */}
          {renderGalBoxStatusMessage()}
          
          {/* Personal Models - New section */}
          <div className="model-section-header">
            Personal Models
            {isLoadingPersonalModels && <span className="loading-indicator">...</span>}
          </div>
          
          {/* Show Personal models if available */}
          {personalModels.length > 0 && personalModels.map((personalModel) => (
            <button
              key={`personal-${personalModel.id}`}
              type="button"
              className={`model-option personal ${model === personalModel.id ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleModelChange(personalModel.id as ModelType);
              }}
            >
              <CustomModelIcon />
              <span>{personalModel.name}</span>
              {model === personalModel.id && <span className="check">✓</span>}
            </button>
          ))}
          
          {/* Show appropriate message when no personal models are available */}
          {renderPersonalModelsStatusMessage()}
          
          {/* Custom Models */}
          <div className="model-section-header">My Models</div>
          {CUSTOM_MODELS.map(({ id, name }) => (
            <button
              key={id}
              type="button"
              className={`model-option custom ${model === id ? 'active' : ''} unavailable`}
              onClick={(e) => {
                e.stopPropagation();
                // Custom models are just examples, not functional
                // handleModelChange(id as ModelType);
              }}
              disabled={true}
            >
              <CustomModelIcon />
              <span>{name}</span>
              <span className="unavailable-label">(Example)</span>
              {model === id && <span className="check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}; 