import React from 'react';
import { UIPersonalModel } from '../types';
import './ModelsList.scss';

interface ModelsListProps {
  models: UIPersonalModel[];
  activeModelId?: string;
  isLoading: boolean;
  onModelSelect: (model: UIPersonalModel) => void;
}

const ModelsList: React.FC<ModelsListProps> = ({
  models,
  activeModelId,
  isLoading,
  onModelSelect,
}) => {
  if (isLoading) {
    return (
      <div className="models-list models-loading">
        <div className="loading-spinner"></div>
        <p>Loading models...</p>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="models-list models-empty">
        <p>No models found</p>
        <p className="hint">Create your first model to get started</p>
      </div>
    );
  }

  return (
    <div className="models-list">
      <h2>Your Models</h2>
      <ul>
        {models.map((model) => (
          <li
            key={model.id}
            className={`model-item ${model.id === activeModelId ? 'active' : ''} ${model.status}`}
            onClick={() => onModelSelect(model)}
          >
            <div className="model-name">{model.name}</div>
            <div className="model-base">Based on: {model.baseModel}</div>
            <div className="model-status">
              <span className={`status-badge ${model.status}`}>
                {model.status}
              </span>
              {model.status === 'training' && model.progress > 0 && (
                <span className="progress">{model.progress}%</span>
              )}
            </div>
            <div className="model-date">
              {new Date(model.updated).toLocaleDateString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ModelsList; 