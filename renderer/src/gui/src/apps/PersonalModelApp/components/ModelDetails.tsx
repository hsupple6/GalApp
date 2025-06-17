import React, { useState } from 'react';
import { UIPersonalModel, TrainingMethod, BaseModel } from '../types';
import usePersonalModelStore from '../store/personalModelStore';
import './ModelDetails.scss';

interface ModelDetailsProps {
  model: UIPersonalModel;
}

const ModelDetails: React.FC<ModelDetailsProps> = ({ model }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedModel, setEditedModel] = useState<Partial<UIPersonalModel>>({});
  const [showFullSample, setShowFullSample] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [isEditingSystemPrompt, setIsEditingSystemPrompt] = useState(false);
  
  const {
    deleteModel,
    startTraining,
    updateModel,
    trainingProgress,
    trainingError
  } = usePersonalModelStore();

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete model "${model.name}"?`)) {
      setIsDeleting(true);
      try {
        await deleteModel(model.id);
      } catch (error) {
        console.error('Failed to delete model:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleTrain = async () => {
    setIsTraining(true);
    try {
      await startTraining(model.id);
    } catch (error) {
      console.error('Failed to start training:', error);
    } finally {
      setIsTraining(false);
    }
  };

  const handleEditClick = () => {
    setEditedModel({
      name: model.name,
      description: model.description,
      baseModel: model.baseModel,
      writingSample: model.writingSample,
      formattedSystemPrompt: model.formattedSystemPrompt,
      tags: [...model.tags]
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedModel({});
  };

  const handleSaveEdit = async () => {
    try {
      await updateModel(model.id, editedModel);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update model:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedModel(prev => ({ ...prev, [name]: value }));
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const getTrainingMethodLabel = (method: TrainingMethod) => {
    switch (method) {
      case 'systemPrompt':
        return 'System Prompt (Basic)';
      case 'fineTuning':
        return 'Fine-Tuning (Advanced)';
      default:
        return method;
    }
  };

  if (isEditing) {
    return (
      <div className="model-details">
        <div className="model-details-header">
          <h2>Edit Model</h2>
        </div>
        <div className="model-details-content edit-mode">
          <div className="section">
            <div className="form-group">
              <label>Name:</label>
              <input 
                type="text" 
                name="name" 
                value={editedModel.name || ''} 
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Description:</label>
              <textarea 
                name="description" 
                value={editedModel.description || ''} 
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Base Model:</label>
              <select 
                name="baseModel" 
                value={editedModel.baseModel} 
                onChange={handleChange}
              >
                <option value="llama3">Llama 3</option>
                <option value="mistral">Mistral</option>
                <option value="phi3">Phi-3</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            
            {model.trainingMethod === 'systemPrompt' && (
              <div className="form-group">
                <div className="edit-tabs">
                  <button 
                    type="button"
                    className={`tab-button ${!isEditingSystemPrompt ? 'active' : ''}`}
                    onClick={() => setIsEditingSystemPrompt(false)}
                  >
                    Writing Sample
                  </button>
                  <button 
                    type="button"
                    className={`tab-button ${isEditingSystemPrompt ? 'active' : ''}`}
                    onClick={() => setIsEditingSystemPrompt(true)}
                  >
                    System Prompt
                  </button>
                </div>
                
                {!isEditingSystemPrompt ? (
                  <>
                    <label>Writing Sample:</label>
                    <textarea 
                      name="writingSample" 
                      value={editedModel.writingSample || ''} 
                      onChange={handleChange}
                      className="writing-sample-editor"
                    />
                    <div className="help-text">
                      This writing sample will be used to guide your personal model's style and tone.
                    </div>
                  </>
                ) : (
                  <>
                    <label>System Prompt (Advanced):</label>
                    <textarea 
                      name="formattedSystemPrompt" 
                      value={editedModel.formattedSystemPrompt || ''} 
                      onChange={handleChange}
                      className="system-prompt-editor"
                    />
                    <div className="help-text">
                      <strong>Advanced:</strong> Directly edit the system prompt that will be sent to the AI. 
                      Changes here will override the automatic formatting of your writing sample.
                    </div>
                  </>
                )}
              </div>
            )}
            
            <div className="edit-actions">
              <button 
                className="secondary-button" 
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
              <button 
                className="primary-button" 
                onClick={handleSaveEdit}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="model-details">
      <div className="model-details-header">
        <h2>{model.name}</h2>
        <div className="model-status-badge">
          <span className={`status-indicator ${model.status}`}></span>
          {model.status}
        </div>
      </div>

      <div className="model-details-content">
        <div className="section">
          <h3>Details</h3>
          <div className="detail-row">
            <span className="label">Description:</span>
            <span className="value">{model.description || 'No description'}</span>
          </div>
          <div className="detail-row">
            <span className="label">Base Model:</span>
            <span className="value">{model.baseModel}</span>
          </div>
          <div className="detail-row">
            <span className="label">Training Method:</span>
            <span className="value">{getTrainingMethodLabel(model.trainingMethod)}</span>
          </div>
          <div className="detail-row">
            <span className="label">Status:</span>
            <span className="value status-text">{model.status}</span>
          </div>
          {model.status === 'training' && (
            <div className="detail-row">
              <span className="label">Progress:</span>
              <div className="progress-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${model.progress}%` }}
                ></div>
                <span className="progress-text">{model.progress}%</span>
              </div>
            </div>
          )}
          <div className="detail-row">
            <span className="label">GalBox:</span>
            <span className="value">{model.galBoxSerialNumber || 'Not specified'}</span>
          </div>
          <div className="detail-row">
            <span className="label">Ollama Model:</span>
            <span className="value">{model.ollamaModelName || 'Not deployed'}</span>
          </div>
          <div className="detail-row">
            <span className="label">Created:</span>
            <span className="value">{formatDate(model.created)}</span>
          </div>
          <div className="detail-row">
            <span className="label">Last Updated:</span>
            <span className="value">{formatDate(model.updated)}</span>
          </div>
        </div>

        {model.writingSample && (
          <div className="section">
            <h3>Writing Sample</h3>
            <div className="writing-sample">
              {!showFullSample && model.writingSample.length > 300 
                ? model.writingSample.substring(0, 300) + '...' 
                : model.writingSample}
            </div>
            {model.writingSample.length > 300 && (
              <button 
                className="text-button" 
                onClick={() => setShowFullSample(!showFullSample)}
              >
                {showFullSample ? 'Show less' : 'Show full sample'}
              </button>
            )}
          </div>
        )}

        {model.formattedSystemPrompt && model.trainingMethod === 'systemPrompt' && (
          <div className="section">
            <h3>Generated System Prompt</h3>
            <div className="system-prompt-toggle">
              <button 
                className="text-button" 
                onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              >
                {showSystemPrompt ? 'Hide System Prompt' : 'Show System Prompt'}
              </button>
            </div>
            
            {showSystemPrompt && (
              <div className="system-prompt">
                <pre>{model.formattedSystemPrompt}</pre>
                <div className="help-text">
                  This is the actual system prompt that will be sent to the AI model when using this personal model.
                </div>
              </div>
            )}
          </div>
        )}

        {model.trainingDataIds.length > 0 && (
          <div className="section">
            <h3>Training Data</h3>
            <div className="training-data-count">
              {model.trainingDataIds.length} dataset{model.trainingDataIds.length !== 1 ? 's' : ''}
            </div>
            <button className="text-button">View training data</button>
          </div>
        )}

        <div className="actions">
          {model.status !== 'training' && (
            <button 
              className="primary-button" 
              onClick={handleTrain}
              disabled={isTraining || model.status === 'ready'}
            >
              {model.status === 'ready' 
                ? 'Ready to Use' 
                : model.status === 'failed' 
                  ? 'Retry Activation' 
                  : model.trainingMethod === 'systemPrompt'
                    ? 'Activate Model'
                    : 'Start Training'}
            </button>
          )}
          <button 
            className="secondary-button" 
            onClick={handleEditClick}
          >
            Edit
          </button>
          <button 
            className="danger-button" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>

        {trainingError && model.status === 'failed' && (
          <div className="error-section">
            <h3>Training Error</h3>
            <div className="error-message">{trainingError}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelDetails; 