import React, { useEffect, useState } from 'react';
import usePersonalModelStore from '../store/personalModelStore';
import { UIPersonalModel, ModelCreationParams, TrainingMethod } from '../types';
import ModelsList from './ModelsList';
import ModelDetails from './ModelDetails';
import CreateModelForm from './CreateModelForm';
import TrainingDataPanel from './TrainingDataPanel';
import './PersonalModelApp.scss';

interface PersonalModelAppProps {
  entityId?: string;
}

const PersonalModelApp: React.FC<PersonalModelAppProps> = ({ entityId }) => {
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [showTrainingData, setShowTrainingData] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const { 
    models, 
    activeModel, 
    isLoadingModels, 
    modelError,
    fetchModels,
    fetchModel,
    setActiveModel,
    clearModelError
  } = usePersonalModelStore();

  // Load models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        setApiError(null);
        await fetchModels();
        setAuthError(null);
      } catch (error) {
        console.error('Error fetching models:', error);
        
        // Parse different types of errors
        if (error instanceof Error) {
          if (error.message.includes('Authentication') || error.message.includes('401')) {
            setAuthError('Authentication error. Please log in again.');
          } else if (error.message.includes('400')) {
            setApiError('Bad request error. The API rejected the request.');
            console.log('Detailed API error:', error.message);
          } else {
            setApiError(`API Error: ${error.message}`);
          }
        } else {
          setApiError('Unknown error occurred while loading models');
        }
      }
    };
    
    loadModels();
    
    // If entityId is provided, load that specific model
    if (entityId) {
      fetchModel(entityId).catch(error => {
        console.error('Error fetching specific model:', error);
      });
    }
    
    // Cleanup on unmount
    return () => {
      setActiveModel(null);
      clearModelError();
    };
  }, [fetchModels, fetchModel, setActiveModel, clearModelError, entityId]);

  const handleModelSelect = (model: UIPersonalModel) => {
    setActiveModel(model);
  };

  const handleCreateClick = () => {
    setIsCreatingModel(true);
  };

  const handleCancelCreate = () => {
    setIsCreatingModel(false);
  };

  const handleToggleTrainingData = () => {
    setShowTrainingData(prev => !prev);
  };

  // If we have an auth error, display it prominently
  if (authError) {
    return (
      <div className="personal-model-app">
        <div className="auth-error-container">
          <h2>Authentication Error</h2>
          <p>{authError}</p>
          <button 
            onClick={() => {
              // Redirect to login or refresh page
              window.location.href = '/login';
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="personal-model-app">
      <div className="app-header">
        <h1>Personal AI Models</h1>
        <div className="actions">
          <button 
            className="create-button" 
            onClick={handleCreateClick}
            disabled={isCreatingModel}
          >
            Create New Model
          </button>
          <button 
            className="toggle-button" 
            onClick={handleToggleTrainingData}
          >
            {showTrainingData ? 'Hide Training Data' : 'Show Training Data'}
          </button>
        </div>
      </div>
      
      {(apiError || modelError) && (
        <div className="error-message">
          <strong>Error:</strong> {apiError || modelError}
          <button 
            className="close-button" 
            onClick={() => {
              setApiError(null);
              clearModelError();
            }}
          >
            ×
          </button>
        </div>
      )}
      
      <div className="app-content">
        {!showTrainingData ? (
          // Models view
          <div className="models-view">
            <div className="sidebar">
              <ModelsList 
                models={models} 
                activeModelId={activeModel?.id}
                isLoading={isLoadingModels}
                onModelSelect={handleModelSelect}
              />
            </div>
            
            <div className="main-content">
              {isCreatingModel ? (
                <CreateModelForm onCancel={handleCancelCreate} />
              ) : activeModel ? (
                <ModelDetails model={activeModel} />
              ) : (
                <div className="empty-state">
                  <p>Select a model or create a new one to get started</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Training data view
          <TrainingDataPanel />
        )}
      </div>
    </div>
  );
};

export default PersonalModelApp; 