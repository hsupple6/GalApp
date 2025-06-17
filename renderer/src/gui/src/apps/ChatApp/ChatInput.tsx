import React, { useRef, useState, useEffect } from 'react';
import './ChatInput.scss';
import { ModelSelector, ModelType } from './ChatAppModelSelector';

interface ChatInputProps {
  onSendMessage: (message: string, model: ModelType, options?: { useRAG?: boolean }) => void;
  isProcessing: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isProcessing,
  placeholder = 'Message Gal...',
}) => {
  const [inputText, setInputText] = useState('');
  const [model, setModel] = useState<ModelType>('gpt-3.5-turbo');
  const [useRAG, setUseRAG] = useState<boolean>(true);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      onSendMessage(inputText, model, { useRAG });
      setInputText('');
      
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleModelChange = (selectedModel: ModelType) => {
    setModel(selectedModel);
  };

  const toggleRAG = () => {
    setUseRAG(!useRAG);
  };

  return (
    <form onSubmit={handleSubmit} className="chat-input">
      <div ref={inputWrapperRef} className="input-wrapper">
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isProcessing ? 'Processing...' : placeholder}
          disabled={isProcessing}
          rows={1}
          className="message-textarea"
        />
        
        <div className="input-actions">
          <div className="rag-toggle">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={useRAG}
                onChange={toggleRAG}
                disabled={isProcessing}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">RAG</span>
          </div>
          
          <ModelSelector 
            model={model}
            onModelChange={handleModelChange}
            disabled={isProcessing}
          />
          
          <button 
            type="submit" 
            className={`send-button ${inputText.trim() ? 'active' : ''}`}
            disabled={!inputText.trim() || isProcessing}
          >
            {isProcessing ? (
              <div className="processing-indicator">⏳</div>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      
      <div className="input-footer">
        <div className="chat-settings">
          <div className="setting-item" title="Retrieval Augmented Generation - enhances responses with document knowledge">
            <span className="setting-label">Document Knowledge:</span>
            <span className={`setting-value ${useRAG ? 'enabled' : 'disabled'}`}>
              {useRAG ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        <span className="hint">Press Enter to send. Shift+Enter for new line.</span>
      </div>
    </form>
  );
}; 