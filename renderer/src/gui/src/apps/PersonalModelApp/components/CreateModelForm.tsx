import React, { useState } from 'react';
import usePersonalModelStore from '../store/personalModelStore';
import { BaseModel, TrainingMethod, ModelCreationParams } from '../types';
import './CreateModelForm.scss';

interface CreateModelFormProps {
  onCancel: () => void;
}

const CreateModelForm: React.FC<CreateModelFormProps> = ({ onCancel }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseModel, setBaseModel] = useState<BaseModel>('llama3');
  const [trainingMethod, setTrainingMethod] = useState<TrainingMethod>('systemPrompt');
  const [writingSample, setWritingSample] = useState('');
  const [galBoxSerialNumber, setGalBoxSerialNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notifyOnComplete, setNotifyOnComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const { createModel } = usePersonalModelStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    try {
      const modelParams: ModelCreationParams = {
        name,
        description,
        baseModel,
        trainingMethod,
        writingSample: trainingMethod === 'systemPrompt' ? writingSample : undefined,
        galBoxSerialNumber: galBoxSerialNumber || undefined,
        phoneNumber: notifyOnComplete ? phoneNumber : undefined,
        notifyOnComplete,
      };
      
      await createModel(modelParams);
      onCancel(); // Close the form after successful creation
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create model');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextStep = () => {
    if (step === 1 && (!name.trim() || !description.trim())) {
      setError('Please provide both name and description');
      return;
    }
    
    if (step === 2 && trainingMethod === 'systemPrompt' && !writingSample.trim()) {
      setError('Please provide a writing sample');
      return;
    }
    
    setError('');
    setStep(step + 1);
  };

  const handlePreviousStep = () => {
    setStep(step - 1);
  };

  const isStepOneValid = name.trim() && description.trim();
  const isStepTwoValid = trainingMethod === 'fineTuning' || 
    (trainingMethod === 'systemPrompt' && writingSample.trim());
  const isStepThreeValid = true; // GalBox is optional
  
  // Helper to evaluate writing sample quality
  const getSampleGuidance = () => {
    if (!writingSample) return null;
    
    if (writingSample.length < 200) {
      return { text: "Very short - the model may not learn your style well", class: "poor" };
    } else if (writingSample.length < 500) {
      return { text: "Short - provides some stylistic elements", class: "fair" };
    } else if (writingSample.length < 1000) {
      return { text: "Good - should capture basic writing patterns", class: "good" };
    } else if (writingSample.length < 3000) {
      return { text: "Great - should capture more nuanced writing style", class: "great" };
    } else {
      return { text: "Excellent - should provide a strong stylistic template", class: "excellent" };
    }
  };
  
  const sampleGuidance = getSampleGuidance();

  return (
    <div className="create-model-form">
      <h2>Create Personal Model</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="step-indicator">
        <div className={`step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-label">Basics</div>
        </div>
        <div className={`step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Training</div>
        </div>
        <div className={`step ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Deploy</div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="form-step">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="name">Model Name*</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Personal Model"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Description*</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this model for?"
                rows={3}
                required
              />
            </div>
            
            <div className="form-buttons">
              <button type="button" className="cancel-button" onClick={onCancel}>
                Cancel
              </button>
              <button 
                type="button" 
                className="next-button" 
                onClick={handleNextStep}
                disabled={!isStepOneValid}
              >
                Next
              </button>
            </div>
          </div>
        )}
        
        {step === 2 && (
          <div className="form-step">
            <h3>Training Method</h3>
            
            <div className="form-group">
              <label htmlFor="baseModel">Base Model</label>
              <select
                id="baseModel"
                value={baseModel}
                onChange={(e) => setBaseModel(e.target.value as BaseModel)}
              >
                <option value="llama3">Llama 3</option>
                <option value="mistral">Mistral</option>
                <option value="phi3">Phi-3</option>
              </select>
            </div>
            
            <div className="form-group training-method-group">
              <label>Training Method</label>
              
              <div className="training-method-options">
                <div 
                  className={`training-option ${trainingMethod === 'systemPrompt' ? 'selected' : ''}`}
                  onClick={() => setTrainingMethod('systemPrompt')}
                >
                  <div className="option-header">
                    <div className="option-title">Basic</div>
                    <div className="option-radio">
                      <input 
                        type="radio" 
                        checked={trainingMethod === 'systemPrompt'} 
                        onChange={() => setTrainingMethod('systemPrompt')}
                      />
                    </div>
                  </div>
                  <div className="option-description">
                    Uses your writing sample within a system prompt. Quick and easy, but less personalized.
                  </div>
                </div>
                
                <div 
                  className={`training-option ${trainingMethod === 'fineTuning' ? 'selected' : ''}`}
                  onClick={() => setTrainingMethod('fineTuning')}
                >
                  <div className="option-header">
                    <div className="option-title">Advanced Fine-Tuning</div>
                    <div className="option-radio">
                      <input 
                        type="radio" 
                        checked={trainingMethod === 'fineTuning'} 
                        onChange={() => setTrainingMethod('fineTuning')}
                      />
                    </div>
                  </div>
                  <div className="option-description">
                    Generate training data from your writing and fine-tune the model. Better results but takes longer.
                  </div>
                </div>
              </div>
            </div>
            
            {trainingMethod === 'systemPrompt' && (
              <div className="form-group">
                <label htmlFor="writingSample">Writing Sample*</label>
                <p className="input-hint">
                  Paste examples of your writing style. The more text, the better the model will understand your style.
                </p>
                <textarea
                  id="writingSample"
                  value={writingSample}
                  onChange={(e) => setWritingSample(e.target.value)}
                  placeholder="Paste emails, notes, or other content written in your style"
                  rows={8}
                  required={trainingMethod === 'systemPrompt'}
                />
                {sampleGuidance && (
                  <div className={`sample-quality ${sampleGuidance.class}`}>
                    {sampleGuidance.text} ({writingSample.length} characters)
                  </div>
                )}
              </div>
            )}
            
            <div className="form-buttons">
              <button type="button" className="back-button" onClick={handlePreviousStep}>
                Back
              </button>
              <button 
                type="button" 
                className="next-button" 
                onClick={handleNextStep}
                disabled={!isStepTwoValid}
              >
                Next
              </button>
            </div>
          </div>
        )}
        
        {step === 3 && (
          <div className="form-step">
            <h3>Deployment Options</h3>
            
            <div className="form-group">
              <label htmlFor="galBoxSerialNumber">GalBox Serial Number (Optional)</label>
              <input
                id="galBoxSerialNumber"
                type="text"
                value={galBoxSerialNumber}
                onChange={(e) => setGalBoxSerialNumber(e.target.value)}
                placeholder="Enter your GalBox serial number"
              />
              <p className="input-hint">
                If specified, your model will be trained on this GalBox
              </p>
            </div>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={notifyOnComplete}
                  onChange={(e) => setNotifyOnComplete(e.target.checked)}
                />
                Notify me when training is complete
              </label>
            </div>
            
            {notifyOnComplete && (
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number</label>
                <input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter your phone number"
                  required={notifyOnComplete}
                />
                <p className="input-hint">
                  We'll send a text message when your model is ready
                </p>
              </div>
            )}
            
            <div className="form-buttons">
              <button type="button" className="back-button" onClick={handlePreviousStep}>
                Back
              </button>
              <button 
                type="submit" 
                className="submit-button" 
                disabled={isSubmitting || !isStepThreeValid || (notifyOnComplete && !phoneNumber)}
              >
                {isSubmitting ? 'Creating...' : 'Create Model'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default CreateModelForm; 