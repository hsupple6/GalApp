import React, { useState, useEffect } from 'react';
import usePersonalModelStore from '../store/personalModelStore';
import { UITrainingData, GenerateTrainingDataParams, BaseModel } from '../types';
import './TrainingDataPanel.scss';

const TrainingDataPanel: React.FC = () => {
  const {
    trainingData,
    activeTrainingData,
    isLoadingTrainingData,
    trainingDataError,
    fetchTrainingData,
    setActiveTrainingData,
    generateTrainingData,
    deleteTrainingData
  } = usePersonalModelStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [writingSample, setWritingSample] = useState('');
  const [baseModel, setBaseModel] = useState<BaseModel>('llama3');
  const [numExamples, setNumExamples] = useState(50);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrainingData().catch(console.error);
  }, [fetchTrainingData]);

  const handleSelectTrainingData = (data: UITrainingData) => {
    setActiveTrainingData(data);
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);

    try {
      const params: GenerateTrainingDataParams = {
        baseModel,
        writingSample,
        numExamples
      };
      
      await generateTrainingData(params);
      setShowGenerateForm(false);
      setWritingSample('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate training data');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this training data?')) {
      try {
        await deleteTrainingData(id);
      } catch (error) {
        console.error('Error deleting training data:', error);
      }
    }
  };

  if (isLoadingTrainingData) {
    return (
      <div className="training-data-panel loading">
        <div className="loading-spinner"></div>
        <p>Loading training data...</p>
      </div>
    );
  }

  return (
    <div className="training-data-panel">
      <div className="panel-header">
        <h2>Training Data</h2>
        <button
          className="generate-button"
          onClick={() => setShowGenerateForm(true)}
          disabled={showGenerateForm}
        >
          Generate New Training Data
        </button>
      </div>

      {trainingDataError && (
        <div className="error-message">{trainingDataError}</div>
      )}

      {error && (
        <div className="error-message">{error}</div>
      )}

      {showGenerateForm ? (
        <div className="generate-form-container">
          <h3>Generate Training Data</h3>
          <form onSubmit={handleGenerateSubmit}>
            <div className="form-group">
              <label htmlFor="baseModel">Base Model</label>
              <select
                id="baseModel"
                value={baseModel}
                onChange={(e) => setBaseModel(e.target.value as BaseModel)}
                disabled={isGenerating}
              >
                <option value="llama3">Llama 3</option>
                <option value="mistral">Mistral</option>
                <option value="phi3">Phi-3</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="numExamples">Number of Examples</label>
              <input
                id="numExamples"
                type="number"
                min={10}
                max={500}
                value={numExamples}
                onChange={(e) => setNumExamples(Number(e.target.value))}
                disabled={isGenerating}
              />
              <p className="input-hint">
                More examples will produce better quality but take longer to generate.
                Recommend 50-100 examples for best results.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="writingSample">Writing Sample*</label>
              <textarea
                id="writingSample"
                value={writingSample}
                onChange={(e) => setWritingSample(e.target.value)}
                placeholder="Paste examples of your writing style here. The system will analyze this to generate training data."
                rows={8}
                required
                disabled={isGenerating}
              />
              <p className="input-hint">
                For best results, include at least 1000 characters of your writing.
              </p>
            </div>

            <div className="form-buttons">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setShowGenerateForm(false)}
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={isGenerating || !writingSample.trim()}
              >
                {isGenerating ? 'Generating...' : 'Generate Training Data'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="training-data-content">
          <div className="data-list">
            {trainingData.length === 0 ? (
              <div className="empty-state">
                <p>No training data available</p>
                <p className="hint">Generate training data from your writing samples</p>
              </div>
            ) : (
              <ul>
                {trainingData.map((data) => (
                  <li
                    key={data.id}
                    className={`data-item ${activeTrainingData?.id === data.id ? 'active' : ''}`}
                    onClick={() => handleSelectTrainingData(data)}
                  >
                    <div className="data-name">{data.name}</div>
                    <div className="data-info">
                      <span className="data-format">{data.dataFormat.toUpperCase()}</span>
                      <span className="data-source">{data.source}</span>
                    </div>
                    <div className="data-date">
                      {new Date(data.created).toLocaleDateString()}
                    </div>
                    <button
                      className="delete-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(data.id);
                      }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="data-preview">
            {activeTrainingData ? (
              <>
                <h3>{activeTrainingData.name}</h3>
                <div className="data-meta">
                  <div>Format: {activeTrainingData.dataFormat.toUpperCase()}</div>
                  <div>Source: {activeTrainingData.source}</div>
                  <div>Created: {new Date(activeTrainingData.created).toLocaleString()}</div>
                </div>
                <div className="data-content">
                  <pre>{activeTrainingData.content.substring(0, 1000)}
                    {activeTrainingData.content.length > 1000 ? '...' : ''}
                  </pre>
                </div>
              </>
            ) : (
              <div className="empty-preview">
                <p>Select a training data set to preview</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingDataPanel; 