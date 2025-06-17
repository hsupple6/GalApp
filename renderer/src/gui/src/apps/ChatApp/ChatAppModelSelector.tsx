import './ModelSelector.scss';

import React, { useEffect, useRef, useState } from 'react';

import { useGalBoxServer } from '../../hooks/useGalBoxServer';
import personalModelService from '../PersonalModelApp/utils/personalModelService';
import { UIPersonalModel } from '../PersonalModelApp/types/index';

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
  'claude-3-5-sonnet-20240620': true, // Added existing model from ChatInput
  
  // Models without backend implementation
  'claude-3.7-sonnet-thinking': false,
  'gpt-4o': false,
  'gpt-4.5-preview': false,
  'bedrock-small': false
};

export type ModelType = 
  | 'gpt-3.5-turbo'
  | 'gpt-4'
  | 'claude-3-5-sonnet-20240620'
  | 'claude-3.5-sonnet'
  | 'claude-3.7-sonnet-thinking'
  | 'gpt-4o'
  | 'gpt-4.5-preview'
  | 'bedrock-small'
  | GalBoxModelType
  | PersonalModelType;

export const AVAILABLE_MODELS: ModelType[] = [
  'gpt-3.5-turbo',
  'gpt-4',
  'claude-3-5-sonnet-20240620',
  'claude-3.5-sonnet'
];

// GalBox models can have any name since they're dynamically loaded
export type GalBoxModelType = string;

// Personal models from the Personal Models API
export type PersonalModelType = string;

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
        console.log('[ModelSelector] Fetching GalBox models, server status:', serverStatus);
        
        // Fetch models directly from the GalBox API server
        const response = await fetch(`http://${serverStatus.address}:3001/models`);
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[ModelSelector] Models received from GalBox:', data);
        
        // Extract model names from the response (models are in the 'models' array)
        if (data && Array.isArray(data.models)) {
          const modelNames = data.models.map((model: { name: string }) => model.name);
          setGalBoxModels(modelNames);
        } else {
          console.warn('[ModelSelector] Unexpected API response format:', data);
          setGalBoxModels([]);
          setFetchError('Could not parse model list from server');
        }
      } catch (error) {
        console.error('[ModelSelector] Failed to fetch GalBox models:', error);
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
        console.log('[ModelSelector] Fetching personal models');
        const models = await personalModelService.fetchModels();
        console.log('[ModelSelector] Personal models received:', models);
        
        // Only include trained models that are ready to use
        const trainedModels = models.filter(model => 
          model.status === 'ready' || model.status === 'draft'
        );
        
        setPersonalModels(trainedModels);
      } catch (error) {
        console.error('[ModelSelector] Failed to fetch personal models:', error);
        setPersonalModels([]);
        setPersonalModelError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoadingPersonalModels(false);
      }
    };

    fetchPersonalModels();
  }, []);

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
    console.log('ModelSelector handling click:', newModel);
    onModelChange(newModel);
    setIsOpen(false);
  };

  // Get display name for the model
  const getModelDisplayName = (modelId: string): string => {
    // First check if it's a personal model
    const personalModel = personalModels.find(m => m.id === modelId);
    if (personalModel) {
      return personalModel.name;
    }
    
    // Otherwise just return the model ID (could be improved with a mapping for well-known models)
    return modelId;
  };

  // Get model icon/badge
  const getModelIcon = (modelId: string): string => {
    if (modelId === 'gpt-3.5-turbo') return '3.5';
    if (modelId === 'gpt-4') return '4';
    if (modelId.includes('claude')) return 'C';
    
    // For other models, use first letter
    return modelId.charAt(0).toUpperCase();
  };

  // Display a message based on GalBox status
  const renderGalBoxStatusMessage = () => {
    if (!serverStatus.online) {
      return (
        <div className="status-message warning">
          <p>GalBox Server Offline</p>
          <p className="status-note">Check if your GalBox server is running</p>
        </div>
      );
    }
    
    if (isLoadingModels) {
      return (
        <div className="status-message info">
          <p>Loading models from GalBox Server...</p>
        </div>
      );
    }
    
    if (fetchError) {
      return (
        <div className="status-message error">
          <p>Error: {fetchError}</p>
        </div>
      );
    }

    if (galBoxModels.length === 0) {
      return (
        <div className="status-message warning">
          <p>No models found on GalBox</p>
        </div>
      );
    }
    
    return null;
  };

  // Display a message based on Personal Models status
  const renderPersonalModelsStatusMessage = () => {
    if (isLoadingPersonalModels) {
      return (
        <div className="status-message info">
          <p>Loading personal models...</p>
        </div>
      );
    }
    
    if (personalModelError) {
      return (
        <div className="status-message error">
          <p>Error: {personalModelError}</p>
        </div>
      );
    }

    if (personalModels.length === 0) {
      return (
        <div className="status-message info">
          <p>No trained personal models available</p>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="chat-model-selector">
      <button 
        ref={buttonRef}
        type="button" 
        className="model-selector-button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={disabled}
      >
        <div className="model-icon">
          {getModelIcon(model)}
        </div>
        <span className="model-name">
          {getModelDisplayName(model)}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="model-dropdown"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cloud Models */}
          <div className="section-header">Cloud Models</div>
          {AVAILABLE_MODELS.map((modelOption) => (
            <div
              key={modelOption}
              className={`model-option ${model === modelOption ? 'active' : ''} ${!isModelAvailable(modelOption) ? 'unavailable' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isModelAvailable(modelOption)) {
                  handleModelChange(modelOption);
                }
              }}
            >
              <div className="model-icon">{getModelIcon(modelOption)}</div>
              <span>{modelOption}</span>
              {!isModelAvailable(modelOption) && <span className="unavailable-label">(Coming Soon)</span>}
              {model === modelOption && <span className="check">✓</span>}
            </div>
          ))}
          
          {/* GalBox Models */}
          <div className="section-header">
            GalBox Models 
            {isLoadingModels && <span className="loading-indicator">...</span>}
            {serverStatus.online && <span className="connection-status online">• Connected</span>}
            {!serverStatus.online && <span className="connection-status offline">• Offline</span>}
          </div>
          
          {/* Show GalBox models if available */}
          {galBoxModels.length > 0 && galBoxModels.map((modelName) => (
            <div
              key={`galbox-${modelName}`}
              className={`model-option ${model === modelName ? 'active' : ''} ${!serverStatus.online ? 'unavailable' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (serverStatus.online) {
                  handleModelChange(modelName as ModelType);
                }
              }}
            >
              <span className="galbox-indicator"></span>
              <span>{modelName}</span>
              {model === modelName && <span className="check">✓</span>}
            </div>
          ))}
          
          {/* Show appropriate message when no models are available */}
          {renderGalBoxStatusMessage()}
          
          {/* Personal Models */}
          <div className="section-header">
            Personal Models
            {isLoadingPersonalModels && <span className="loading-indicator">...</span>}
          </div>
          
          {/* Show Personal models if available */}
          {personalModels.length > 0 && personalModels.map((personalModel) => (
            <div
              key={`personal-${personalModel.id}`}
              className={`model-option ${model === personalModel.id ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleModelChange(personalModel.id as ModelType);
              }}
            >
              <div className="model-icon">P</div>
              <span>{personalModel.name}</span>
              {model === personalModel.id && <span className="check">✓</span>}
            </div>
          ))}
          
          {/* Show appropriate message when no personal models are available */}
          {renderPersonalModelsStatusMessage()}
        </div>
      )}
    </div>
  );
}; 