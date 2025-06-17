import React, { useEffect,useRef, useState } from 'react';

import { AnyWindowEntity } from '../../../../../types/windows';
import { ChatMode } from '../../types';
import { MentionSuggestions } from '../MentionSuggestions';
import { ModelSelector, ModelType } from '../ModelSelector';
import { ModeSelectorMenu } from '../index';
import { ThreadEntity } from 'types/chat';

interface ChatInputProps {
  inputText: string;
  isProcessing: boolean;
  isStreaming: boolean;
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  mentionSuggestions: AnyWindowEntity[];
  model: ModelType;
  onModelChange: (model: ModelType) => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onMentionSelect: (entity: AnyWindowEntity) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  getModeDescription?: (mode: ChatMode) => string;
  threads: Record<string, ThreadEntity>;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  isProcessing,
  isStreaming,
  mode,
  setMode,
  mentionSuggestions,
  model,
  onModelChange,
  onInputChange,
  onSubmit,
  onMentionSelect,
  onPaste,
  getModeDescription,
  threads
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isModelDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        modelButtonRef.current && 
        !modelButtonRef.current.contains(event.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelDropdownOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-chat-input">
      <div ref={inputWrapperRef} className="input-wrapper">
        <textarea
          ref={inputRef}
          autoFocus
          value={inputText}
          onKeyDown={handleKeyDown}
          onChange={onInputChange}
          onPaste={onPaste}
          placeholder={
            isStreaming 
              ? 'Streaming...' 
              : isProcessing
                ? 'Processing...' 
                : mode === 'create'
                  ? 'Create and edit stuff, @ to mention'
                : mode === 'editor'
                  ? 'Describe the edit you want to make...'
                  : mode === 'exp1'
                    ? 'Experimental mode 1'
                    : 'Ask anything, @ to mention'
          }
          disabled={isProcessing || isStreaming}
          rows={1}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
          }}
        />
        
        <div className="input-actions">
          <ModeSelectorMenu
            currentMode={mode}
            onChange={setMode}
            getDescription={getModeDescription}
            threads={threads}
          />
          <ModelSelector
            model={model}
            onModelChange={onModelChange}
            disabled={isProcessing || isStreaming}
          />
          <button type="submit" disabled={isProcessing || isStreaming} className="chatInputButton">
            {isProcessing || isStreaming ? '⏳' : 'Send ↵'}
          </button>
        </div>

        {mentionSuggestions && mentionSuggestions.length > 0 && (
          <MentionSuggestions
            suggestions={mentionSuggestions}
            onSelect={onMentionSelect}
            style={{
              width: inputWrapperRef.current?.offsetWidth,
            }}
          />
        )}
      </div>
    </form>
  );
}; 