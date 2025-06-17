import React, { useState } from 'react';

import './ChatMessages.scss';
import { MessageContent, MessageEntity } from 'types/chat';
import Markdown from 'react-markdown';

interface ChatMessagesProps {
  messages: MessageEntity[];
  activePreview: string | null;
  setActivePreview: (id: string | null) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  isLoading?: boolean;
  mode?: string;
  onRetry?: () => void;
  getEntityMetadata?: (windowId: string) => { name?: string; type?: string } | null;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  activePreview,
  setActivePreview,
  messagesEndRef,
  isLoading = false,
  mode = 'chat',
  onRetry,
  getEntityMetadata,
}) => {
  const [expandedToolMessages, setExpandedToolMessages] = useState<Record<string, boolean>>({});

  const toggleToolExpand = (messageId: string, contentIndex: number) => {
    const key = `${messageId}-${contentIndex}`;
    setExpandedToolMessages((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const copyToClipboard = (content: any) => {
    navigator.clipboard.writeText(JSON.stringify(content));
  };

  const hasErrorMessage =
    messages.length > 0 &&
    messages[messages.length - 1].skeleton.sender === 'assistant' &&
    messages[messages.length - 1].skeleton.content.some(
      (c) =>
        c.type === 'text' &&
        c.text &&
        (c.text.includes('error') ||
          c.text.includes('busy') ||
          c.text.includes('try again') ||
          c.text.includes('servers')),
    );

  const renderMessageContent = (content: MessageContent, messageId: string, contentIndex: number) => {
    if (
      content.type === 'text' &&
      content.text &&
      contentIndex === 0 &&
      (content.text.includes('error') ||
        content.text.includes('busy') ||
        content.text.includes('try again') ||
        content.text.includes('servers'))
    ) {
      return (
        <div className="message-content error-message">
          <div className="error-icon">⚠️</div>
          <div className="error-text">{content.text}</div>
          {onRetry && (
            <button className="retry-button" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      );
    }

    if (content && (content.type === 'tool_use' || content.type === 'tool_result')) {
      const messageKey = `${messageId}-${contentIndex}`;
      const isExpanded = expandedToolMessages[messageKey];

      let toolInfo = { toolName: '', entityInfo: '', type: content.type };
      
      if (content.type === 'tool_use') {
        toolInfo.toolName = content.name;
        
        // Extract entity information from tool input
        let entityInfo: string | null = null;
        if (content.input) {
          // Try to find meaningful entity identifiers in the input
          const input = content.input;
          
          // First try to get entity metadata if we have the function and a windowId
          if (getEntityMetadata && input.windowId) {
            const metadata = getEntityMetadata(input.windowId);
            if (metadata?.name) {
              entityInfo = `"${metadata.name}"`;
              if (metadata.type) {
                entityInfo += ` (${metadata.type})`;
              }
            }
          }
          
          // Fallback to previous logic if no metadata function or no result
          if (!entityInfo) {
            if (input.windowId) {
              entityInfo = `window: ${input.windowId}`;
            } else if (input.entityId) {
              entityInfo = `entity: ${input.entityId}`;
            } else if (input.fileName || input.filename) {
              entityInfo = `file: ${input.fileName || input.filename}`;
            } else if (input.title) {
              entityInfo = `"${input.title}"`;
            } else if (input.path) {
              entityInfo = `path: ${input.path}`;
            } else if (input.name) {
              entityInfo = `"${input.name}"`;
            } else if (typeof input === 'string') {
              entityInfo = `"${input}"`;
            }
          }
        }
        
        toolInfo.entityInfo = entityInfo || '';
      } else if (content.type === 'tool_result') {
        toolInfo.toolName = `Result for: ${content.tool_use_id}`;
      }

      return (
        <div className="message-content tool-message">
          <div className="tool-header">
            <div className="tool-summary">
              {content.type === 'tool_use' ? (
                <>
                  <div className="tool-action">
                    <div className={`tool-badge ${content.type === 'tool_use' ? 'tool-use-badge' : 'tool-result-badge'}`}>
                      {content.type === 'tool_use' ? 'TOOL' : 'RESULT'}
                    </div>
                    Using tool: <span className="tool-name">{toolInfo.toolName}</span>
                  </div>
                  {toolInfo.entityInfo && (
                    <div className="tool-target">on: <span className="entity-name">{toolInfo.entityInfo}</span></div>
                  )}
                </>
              ) : (
                <div className="tool-action">
                  <div className={`tool-badge tool-result-badge`}>
                    RESULT
                  </div>
                  {toolInfo.toolName}
                </div>
              )}
            </div>
            <button onClick={() => toggleToolExpand(messageId, contentIndex)} className="expand-button">
              {isExpanded ? '▼' : '▶'}
            </button>
          </div>

          {isExpanded && (
            <div className="tool-details">
              <pre>{JSON.stringify(content, null, 2)}</pre>
              <button onClick={() => copyToClipboard(content)} className="copy-button">
                📋 Copy
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="message-content">
        <Markdown>{content?.text}</Markdown>
      </div>
    );
  };

  return (
    <div className="chat-messages">
      {messages.map((message) => {
        const contents = message.skeleton.content;
        return contents.map((content, index) => {
          return (
            <div
              key={`${message._id}-${index}`}
              className={`
                message
                ${message.skeleton.sender === 'user' ? 'user-message' : 'ai-message'}
                ${content.type}
                ${
                  content.type === 'text' &&
                  content.text &&
                  (content.text.includes('error') ||
                    content.text.includes('busy') ||
                    content.text.includes('try again') ||
                    content.text.includes('servers'))
                    ? 'error-container'
                    : ''
                }
              `}
            >
              <div className="message-bubble">{renderMessageContent(content, message._id, index)}</div>
            </div>
          );
        });
      })}

      {isLoading && (
        <div className="message ai-message">
          <div className="message-bubble">
            <div className="message-content loading">
              <div className="typing-indicator">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
