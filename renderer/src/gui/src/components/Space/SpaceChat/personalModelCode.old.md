import './SpaceChat.scss';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import useSpaceStore from '../../../stores/spaceStore';
import { ChatHeader } from './components/chat/ChatHeader';
import { ChatInput } from './components/chat/ChatInput';
import { ChatMessages } from './components/chat/ChatMessages';
import { ThreadHistory } from './components/ThreadHistory';
import { useChatMode } from './hooks/useChatMode';
import type { ChatMessage, ChatMode } from './types';
import { useContextRouterStore } from 'components/Space/SpaceChat/contextStore';
import { NotesEditorRef } from '../../../apps/NotesApp/components/NotesEditor';
import { API_BASE_URL } from '../../../api/config';
import { useCommandRegistryStore } from '../../../stores/commandRegistryStore';
import { useSpaceChatStore } from './spaceChatStore';
import { useGalBoxServer } from '../../../hooks/useGalBoxServer';
import { ModelType } from './components/ModelSelector';
import fetchService from '../../../services/fetchService';
import { actionEventService } from '../../../services/actionEventService';

// Extend the ContextRouterState interface to include initialize
declare module 'components/Space/SpaceChat/contextStore' {
  interface ContextRouterState {
    initialize: () => void;
  }
}

// Define action status types
type ActionStatus = 'pending' | 'success' | 'error';

// Define action interface
interface Action {
  type: string;
  args?: any;
  status?: ActionStatus;
  message?: string;
}

// Define the ActionPlan type
interface ActionPlan {
  actions: Action[];
}

// Extend the ChatMessage type to include actions
declare module './types' {
  interface ChatMessage {
    actions?: ActionPlan['actions'];
  }
}

// Control logging verbosity with this constant
const DEBUG = process.env.NODE_ENV === 'development';

interface SpaceChatProps {
  isVisible: boolean;
  user_id: string;
  setIsVisible: (visible: boolean) => void;
}

function composeContextSummary(message?: ChatMessage) {
  if (!message || !Array.isArray(message?.contentObject)) {
    return '';
  }

  const isResponseAction = message?.contentObject.some((action) => action.response);

  return `${(message?.contentObject).map((action) => action.ACTION_NAME).join(', ')} ${isResponseAction ? 'response' : ''}`;
}

interface Mention {
  id: string;
  displayName: string;
  type: string;
}

const generateMessageId = (() => {
  let counter = 0;
  return () => {
    counter += 1;
    return `msg-${Date.now()}-${counter}-${Math.random().toString(36).substring(2, 7)}`;
  };
})();

interface RateLimitError {
  error: string;
  remaining_queries: number;
  limit: number;
}

interface LocalModel {
  name: string;
  source: 'galbox';
}

interface CloudModel {
  name: string;
  source: 'cloud';
}

type Model = LocalModel | CloudModel;

// Map our Model type to the ModelType used by the ModelSelector component
const mapModelToModelType = (model: Model): ModelType => {
  if (model.source === 'cloud') {
    // Try to map to one of the predefined ModelType values
    return model.name as ModelType;
  }
  // For GalBox models, return the name (these will be treated as custom models)
  return model.name as ModelType;
};

const SpaceChat: React.FC<SpaceChatProps> = ({ isVisible, setIsVisible }) => {
  // Use the new store
  const {
    mode,
    setMode,
    model,
    setModel,
    isHistoryOpen,
    setIsHistoryOpen,
    activePreview,
    isContextVisible,
    setIsContextVisible,
    setActivePreview,

    inputText,
    setInputText,
  } = useUiStore();

  const {
    messageEntities,
    threadEntities,
    currentThreadIds,
    createThread,
    setCurrentThread,
    initialize,
    initialized,
    initializationInProgress,

    isProcessing,
    isStreaming,
    sendMessage,
    // getThreadMessages,
    pendingToolMessageId,
    handleToolResult
  } = useChatStore(user_id);

  const {
    mentionSearch,
    setMentionSearch,
    mentionSuggestions,
    setMentionSuggestions,
    mentions,
    setMentions,
    mentionStartIndex,
    setMentionStartIndex,
    mentionResults,
    setMentionResults,
    showMentionResults,
    setShowMentionResults,
    handleMentionSelect,
  } = useMentionStore();

  // Use GalBoxServer hook to access GalBox functionality
  const { serverStatus, runModel } = useGalBoxServer();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { activeSpace, windows, activeWindowId } = useSpaceStore();
  const { context } = useContextStore();
  const { executeCommand } = useCommandRegistryStore();
  
  // Combined model list state (cloud + GalBox models)
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Initialize the context router store
  useEffect(() => {
    // Initialize the context router store to handle selections properly
    const contextRouter = useContextRouterStore.getState();
    contextRouter.initialize();
    
    return () => {
      // Clean up when unmounting
      contextRouter.dispose();
    };
  }, []);

  useEffect(() => {
    // Only log windows changes in development
    if (process.env.NODE_ENV === 'development') {
      console.debug('[SpaceChat] Windows updated');
    }
  }, [windows]);

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoadingModels(true);
      try {
        const cloudModels: CloudModel[] = [
          { name: 'claude-3.5-sonnet', source: 'cloud' },
          { name: 'claude-3-opus', source: 'cloud' },
          { name: 'claude-3-sonnet', source: 'cloud' },
          { name: 'claude-3-haiku', source: 'cloud' }
        ];
        
        // Only try to fetch GalBox models if server is online
        let localModels: LocalModel[] = [];
        if (serverStatus.online) {
          try {
            // Only log in non-production
            if (process.env.NODE_ENV !== 'production') {
              console.log('[SpaceChat] Fetching GalBox models from:', serverStatus.address);
            }
            
            try {
              // Fetch models directly from the GalBox API server
              const response = await fetch(`http://${serverStatus.address}:3001/models`);
              
              if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
              }
              
              const data = await response.json();
              
              // Extract model names from the response
              if (data && Array.isArray(data.models)) {
                const modelNames = data.models.map((model: { name: string }) => model.name);
                localModels = modelNames.map((name: string) => ({ name, source: 'galbox' }));
                // Only log detailed response in development
                if (process.env.NODE_ENV === 'development') {
                  console.debug('[SpaceChat] Loaded GalBox models:', localModels);
                } else {
                  console.log(`[SpaceChat] Found ${localModels.length} GalBox models`);
                }
              } else {
                console.warn('[SpaceChat] Unexpected API response format');
              }
            } catch (error) {
              console.error('[SpaceChat] Failed to fetch GalBox models:', error);
            }
          } catch (error) {
            console.error('[SpaceChat] Failed to fetch GalBox models:', error);
          }
        }
        
        setAvailableModels([...localModels, ...cloudModels]);
      } catch (error) {
        console.error('[SpaceChat] Error fetching models:', error);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
    
    // Refetch models when GalBox server status changes
    if (serverStatus.online) {
      fetchModels();
    }
  }, [serverStatus.online, serverStatus.address]);

  const executeActions = useCallback(
    async (actions: Action[], messageId: string) => {
      // Create execution message with initial pending status
      const executionMessageId = Date.now().toString();
      setMessages((prev) => [
        ...prev,
        {
          id: executionMessageId,
          content: 'Executing actions...',
          contentType: 'text',
          sender: 'ai',
          timestamp: new Date(),
          actions: actions.map((action: Action) => ({
            type: action.type,
            status: 'pending',
          })),
          messageRef: messageId,
        },
      ]);

      // Execute each action in sequence
      for (let index = 0; index < actions.length; index++) {
        const action = actions[index];

        // Update status to executing
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === executionMessageId
              ? {
                  ...msg,
                  actions: msg.actions?.map((a: Action, i: number) => ({
                    ...a,
                    status: i === index ? 'pending' : a.status,
                    message: i === index ? 'Executing...' : a.message,
                  })),
                }
              : msg
          )
        );

        try {
          // Execute the action
          await actionEventService.executeAction(action.type, action.args);

          // Update status to success
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === executionMessageId
                ? {
                    ...msg,
                    actions: msg.actions?.map((a: Action, i: number) => ({
                      ...a,
                      status: i === index ? 'success' : a.status,
                      message: i === index ? 'Completed' : a.message,
                    })),
                  }
                : msg
            )
          );
        } catch (error) {
          console.error(`Error executing action ${action.type}:`, error);

          // Update status to error
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === executionMessageId
                ? {
                    ...msg,
                    actions: msg.actions?.map((a: Action, i: number) => ({
                      ...a,
                      status: i === index ? 'error' : a.status,
                      message:
                        i === index
                          ? `Error: ${error instanceof Error ? error.message : String(error)}`
                          : a.message,
                    })),
                  }
                : msg
            )
          );
        }
      }
    },
    [setMessages]
  );

  const handleRateLimitError = (error: RateLimitError) => {
    const errorMessage: ChatMessage = {
      id: Date.now().toString(),
      text: `You've reached your query limit (${error.limit} queries). You have ${error.remaining_queries} queries remaining. Your limit will reset in 30 days.`,
      sender: 'ai',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, errorMessage]);
  };

  const addNewMessage = useCallback(({ content, role }: { content: string; role: 'user' | 'assistant' }) => {
    const newMessage: ChatMessage = {
      id: generateMessageId(),
      text: content,
      sender: role === 'user' ? 'user' : 'ai',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, [setMessages]);

  useEffect(() => {
    console.log('[SpaceChat][useEffect] Active tool payload:', activeToolPayload);

    const handleToolUse = async (toolPayload: any) => {
      console.log('[SpaceChat][useEffect] Tool use:', toolPayload);
      const result = await executeCommand(toolPayload.name, {
        ...toolPayload.input,
        callback: (output: string) => {
          console.log('[SpaceChat][useEffect] Tool used:', toolPayload, output);
          submitToolOutput(toolPayload.id, output, messages);
        },
      });
    };

    if (activeToolPayload?.id) {
      handleToolUse(activeToolPayload);
    }
    return [];
  }, [mode, currentThreadIds, messageEntities]);


  // TODO: workaround tool execution
  // using this in the hook is not working (not reactive, the useChatStore is not updating)
  useEffect(() => {
    if (pendingToolMessageId) {
      const toolMessage = messageEntities[pendingToolMessageId];
      const toolUse = toolMessage.skeleton.content.find((content) => content.type === 'tool_use');

      if (toolUse && toolUse.type === 'tool_use') {
        executeCommand(toolUse.name, {
          ...toolUse.input,
          callback: (output: any) => {
            console.log('[SpaceChat][useEffect] Tool used:', toolUse, output);
            handleToolResult(toolUse.id, output, context, toolMessage.skeleton.thread_id);
          },
        });
      }
    }
  }, [pendingToolMessageId, messageEntities, executeCommand, context]);

  useEffect(() => {
    if (!initialized && !initializationInProgress) {
      initialize();
    }
  }, [initialize, initialized, initializationInProgress]);

  // TODO: debug log, remove later
  useEffect(() => {
    console.log('[SpaceChat][useEffect] chat state:', {
      threadEntities,
      currentThreadIds,
      mode,
      messageEntities,
      messages,
      isStreaming,
      isProcessing,
    });
  }, [threadEntities, mode, currentThreadIds, messageEntities, messages, isStreaming, isProcessing]);


  // Handle auto message
  useEffect(() => {
    if (nextAutoMessage) {
      setNextAutoMessage(null);
      sendMessageHistory(JSON.stringify(nextAutoMessage));
    }
  }, [nextAutoMessage, sendMessageHistory, setNextAutoMessage]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);

    // Auto-adjust height
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;

    // Handle mention suggestions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && (lastAtIndex === 0 || value[lastAtIndex - 1] === ' ')) {
      const searchText = value.substring(lastAtIndex + 1).split(' ')[0];
      setMentionSearch(searchText);
      setMentionStartIndex(lastAtIndex);

      // Filter windows based on search text
      const filteredWindows = Object.values(windows).filter((window) =>
        (window as any)?.name?.toLowerCase().includes(searchText.toLowerCase()),
      );

      setMentionResults(filteredWindows);
      setShowMentionResults(true);
    } else {
      setShowMentionResults(false);
    }
  };

  // For personal models, prepare the messages in the format expected by the API
  const promptMessages = [{
    role: 'user',
    content: inputText
  }];

  // Update handleSendMessage to use the GalBox server when appropriate
  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || isProcessing || isStreaming ) return;

    // Only log in development or if context entities exist
    if (process.env.NODE_ENV === 'development' || contextEntities.length > 0) {
      console.log('[SpaceChat] Sending message with context:', {
        hasSelection: !!currentSelection?.text,
        contextEntities: contextEntities.length
      });
    }
    
    try {
      // Add user message immediately
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        text: inputText,
        sender: 'user',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      
      // Check if we have a personal model (typically an ObjectId)
      const isPersonalModel = model.match(/^[0-9a-f]{24}$/); // MongoDB ObjectId pattern
      
      if (isPersonalModel) {
        // Use Personal Model API
        console.log(`[SpaceChat] Using Personal Model: ${model}`);
        
        // Show thinking state
        const thinkingMessageId = generateMessageId();
        setMessages(prev => [...prev, {
          id: thinkingMessageId,
          text: "Thinking with your personal model...",
          sender: 'ai',
          timestamp: new Date()
        }]);
        
        try {
          // First fetch the model details to get access to the system prompt
          const modelDetails = await fetchService(`${API_BASE_URL}/personal-models/${model}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          
          if (!modelDetails) {
            throw new Error('Failed to fetch model details');
          }
          
          console.log(`[SpaceChat] Using model: ${modelDetails.skeleton.name}, method: ${modelDetails.skeleton.trainingMethod}`);
          
          // Get the formatted system prompt if available
          const systemPrompt = modelDetails.skeleton.formattedSystemPrompt || modelDetails.skeleton.writingSample;
          
          // Map models to the correct provider and model names the backend expects
          const providerModelMap: Record<string, { provider: string, model: string }> = {
            'llama3': { provider: 'anthropic', model: 'claude-3-opus-20240229' },
            'phi3': { provider: 'openai', model: 'gpt-3.5-turbo' },
            'mistral': { provider: 'anthropic', model: 'claude-3-sonnet-20240229' },
            'custom': { provider: 'openai', model: 'gpt-4' }
          };
          
          // Get the provider and model based on the base model
          const { provider, model: baseModel } = providerModelMap[modelDetails.skeleton.baseModel] || 
            { provider: 'openai', model: 'gpt-3.5-turbo' };
          
          console.log(`[SpaceChat] Using provider: ${provider}, base model: ${baseModel} for personal model`);
          
          // Call the personal model API endpoint
          const response = await fetchService(`${API_BASE_URL}/personal-models/${model}/generate`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              messages: promptMessages,
              system_prompt: modelDetails.system_prompt || "You are an AI assistant."
            })
          });
          
          if (response && response.text) {
            // Replace thinking message with actual response
            setMessages(prev => prev.map(msg => 
              msg.id === thinkingMessageId ? {
                id: msg.id,
                text: response.text,
                sender: 'ai',
                timestamp: new Date()
              } : msg
            ));
          } else {
            throw new Error('Invalid response from personal model');
          }
        } catch (error) {
          console.error('[SpaceChat] Error using personal model:', error);
          // Update thinking message to show error
          setMessages(prev => prev.map(msg => 
            msg.id === thinkingMessageId ? {
              id: msg.id,
              text: `Error with personal model: ${error instanceof Error ? error.message : 'Unknown error'}`,
              sender: 'ai',
              timestamp: new Date()
            } : msg
          ));
        }
      } else {
        // For non-personal models, check if we should use GalBox (local) model or cloud
        const selectedModel = availableModels.find(m => m.name === model);
        
        if (selectedModel?.source === 'galbox' && serverStatus.online) {
          // Use GalBox/Ollama model via the server
          console.log(`[SpaceChat] Using GalBox model: ${model}`);
          
          // Show thinking state
          const thinkingMessageId = generateMessageId();
          setMessages(prev => [...prev, {
            id: thinkingMessageId,
            text: "Thinking...",
            sender: 'ai',
            timestamp: new Date()
          }]);
          
          try {
            // Use runModel from useGalBoxServer 
            // Only send simple data to Ollama - extract just what's needed
            const response = await runModel(model, inputText, {
              // Pass the selected text as system message if available
              system: currentSelection?.text ? `Context: ${currentSelection.text}` : undefined
            });
            
            // Only log full response in development mode
            if (process.env.NODE_ENV === 'development') {
              console.debug('[SpaceChat] GalBox model full response:', response);
            }
            
            // Ollama API response contains the response in the "response" field
            let messageText = "";
            
            if (typeof response === 'object') {
              // Handle Ollama response format
              if (response.response) {
                messageText = response.response;
                // Log just a snippet for info purposes
                const previewLength = 50;
                if (messageText.length > previewLength) {
                  console.log('[SpaceChat] Response snippet:', 
                    messageText.substring(0, previewLength).replace(/\n/g, ' ') + '...');
                }
              } else if (response.message) {
                messageText = response.message;
              } else if (response.error) {
                messageText = `Error: ${response.error}`;
                console.error('[SpaceChat] Error in response:', response.error);
              } else if (response.raw) {
                // This is our fallback case from useGalBoxServer
                console.warn('[SpaceChat] Using raw response format');
                messageText = `Received response in unexpected format. Raw data: ${JSON.stringify(response.raw)}`;
              } else {
                console.warn('[SpaceChat] Unknown response format');
                messageText = `Received unexpected response format. Check console logs.`;
              }
            } else if (typeof response === 'string') {
              messageText = response;
            } else {
              console.warn('[SpaceChat] Unexpected response type:', typeof response);
              messageText = `Received response of type ${typeof response}. Check console logs.`;
            }
            
            if (!messageText || messageText.trim() === '') {
              console.warn('[SpaceChat] Empty response text');
              messageText = "No response received from model. Check server logs.";
            }
            
            // Replace thinking message with actual response
            setMessages(prev => prev.map(msg => 
              msg.id === thinkingMessageId ? {
                id: msg.id,
                text: messageText,
                sender: 'ai',
                timestamp: new Date()
              } : msg
            ));
          } catch (error) {
            console.error('[SpaceChat] Error running GalBox model:', error);
            // Update thinking message to show error
            setMessages(prev => prev.map(msg => 
              msg.id === thinkingMessageId ? {
                id: msg.id,
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                sender: 'ai',
                timestamp: new Date()
              } : msg
            ));
          }
        } else {
          // Use cloud model via the existing sendMessage function
          await sendMessage(inputText, {
            activeWindow: activeWindowId ? windows[activeWindowId] : undefined,
            selectedWindows: Object.values(windows),
            selection: currentSelection?.text,
            contextEntities,
          });
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'ai',
        timestamp: new Date()
      }]);
    }
  }, [
    inputText,
    isProcessing,
    isStreaming,
    activeWindowId,
    windows,
    currentSelection,
    contextEntities,
    sendMessage,
    setInputText,
    setMessages,
    model,
    availableModels,
    serverStatus,
    runModel
  ]);

  // Handle send confirm
  // const sendConfirm = useCallback(
  //   async (e: React.FormEvent) => {
  //     e.preventDefault();
  //     setInputText('');
  //     await sendMessageHistory('Confirm');
  //   },
  //   [sendMessageHistory, setInputText],
  // );

  const handleClear = () => {
    setInputText('');
    // setMessages([]);
    // setActivePreview(null);
    setIsHistoryOpen(false);
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'create':
        return 'Create mode';
      case 'chat':
        return 'Chat mode';
      case 'editor':
        return 'Editor mode';
      case 'exp1':
        return 'Experimental mode 1';
      default:
        return 'Unknown mode';
    }
  };

  // Convert our internal model state to the ModelType expected by the ModelSelector component
  const handleModelChange = (newModel: ModelType) => {
    console.log(`[SpaceChat] Changing model to: ${newModel}`);
    setModel(newModel as string);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
    setInputText('');
  };

  const handleNewChat = () => {
    if (messages.length > 0) {
      createThread(mode);
    }
    setIsHistoryOpen(false);
  };

  const toggleHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHistoryOpen(!isHistoryOpen);
  };

  return (
    <div className={`chat-wrapper`}>
      <button className="chat-button" onClick={() => setIsVisible(!isVisible)}>
        {isVisible ? '💬' : '💬'}
      </button>

      {isVisible && (
        <div className="chat-panel">
          <ChatHeader
            mode={mode}
            setMode={setMode}
            onNewChat={handleClear}
            onClose={() => setIsVisible(false)}
            getModeDescription={getModeDescription}
            threads={threadEntities}
          >
            <div className="header-buttons">
              <button type="button" className="chatHeaderButton" onClick={toggleHistory}>
                🕰️
              </button>
              <button type="button" className="chatHeaderButton" onClick={handleNewChat}>
                New
              </button>
              <button className="closeButton" onClick={() => setIsVisible(false)}>
                ×
              </button>
            </div>
          </ChatHeader>

          {isHistoryOpen && (
            <ThreadHistory
              threads={threadEntities}
              onSelectThread={(threadId) => setCurrentThread(mode, threadId)}
              onClose={() => setIsHistoryOpen(false)}
            />
          )}

          <ChatMessages
            messages={messages}
            isLoading={isStreaming || isProcessing}
            activePreview={activePreview}
            setActivePreview={setActivePreview}
            messagesEndRef={messagesEndRef}
          />

          <div className="chat-controls">
            <button
              className={`context-toggle ${isContextVisible ? 'active' : ''}`}
              onClick={() => setIsContextVisible(!isContextVisible)}
            >
              Context
            </button>
            
            
          </div>

          <ContextSection
            isVisible={isContextVisible}
            onRemove={(id) => {
              setContextEntities(contextEntities.filter(entity => entity.id !== id));
            }}
          />

          <ChatInput
            inputText={inputText}
            isProcessing={isProcessing}
            isStreaming={isStreaming}
            mode={mode}
            model={model as unknown as ModelType}
            onModelChange={handleModelChange}
            mentionSuggestions={mentionSuggestions}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            onMentionSelect={handleMentionSelect}
          />
        </div>
      )}
    </div>
  );
};

export default SpaceChat;
