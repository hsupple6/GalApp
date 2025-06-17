import { create, useStore } from 'zustand';
import { ChatMode, SpaceContext } from '../types';
import { 
  MessageEntity, 
  ThreadEntity,
  MessageContent
} from 'types/chat';
import { stream } from '../utils/streamHelpers';
import { entityService } from 'services/entityService';
import { useMemo } from 'react';
import { createMessageUtils } from '../utils/messageUtils';
import { logger } from 'utils/logger';

interface SendMessageProps {
  content: MessageContent;
  threadId: string;
  mode: ChatMode;
  context: SpaceContext;
  model: string;
}

interface ChatStoreState {
  // Messages
  messageEntities: Record<string, MessageEntity>;
  isProcessing: boolean;
  isStreaming: boolean;
  isGenerating: boolean;
  
  // Threads
  threadEntities: Record<string, ThreadEntity>;
  currentThreadIds: Record<ChatMode, string>;
  createThread: (mode: ChatMode) => string;
  setCurrentThread: (mode: ChatMode, threadId: string) => void;
  getThreadMessages: (threadId: string) => MessageEntity[];
  
  // DB
  initialized: boolean;
  initializationInProgress: boolean;
  initialize: () => Promise<void>;
  fetchMessages: (threadId: string) => Promise<MessageEntity[]>;
  persistEntities: (entities: (MessageEntity | ThreadEntity)[]) => Promise<void>;
  
  // Message sending actions
  sendMessage: (props: SendMessageProps) => Promise<{ userMessage: MessageEntity, aiMessage: MessageEntity } | null>;
  streamMessage: (messageContent: MessageContent, context: SpaceContext, messageId: string, threadId: string, model: string) => Promise<boolean>;
  handleStreamError: (error: Error, threadId: string) => void;
  stopStream: () => void;
  
  // Stream controller
  streamController: AbortController | null;
  currentStreamingMessageId: string | null;

  // Tool Use
  pendingToolMessageId: string | null;
  handleToolResult: (toolUseId: string, content: any, context: SpaceContext, threadId: string, model: string) => void;
}

const createChatStore = (userId: string) => {
  if (!userId) throw new Error('[chatStore][createChatStore] userId is required');

  const messageUtils = createMessageUtils(userId);

  return create<ChatStoreState>((set, get) => ({
    // Initial state
    messageEntities: {},
    isProcessing: false,
    isStreaming: false,
    isGenerating: false,
    threadEntities: {},
    currentThreadIds: {} as Record<ChatMode, string>,
    initialized: false,
    initializationInProgress: false,
    pendingToolMessageId: null,
    streamController: null,
    currentStreamingMessageId: null,

    // Function to stop the current stream
    stopStream: () => {
      const controller = get().streamController;
      const pendingToolMessageId = get().pendingToolMessageId;
      const currentStreamingMessageId = get().currentStreamingMessageId;
      const currentIsGenerating = get().isGenerating;
      
      if (controller) {
        logger.log('[chatStore][stopStream] Aborting stream');
        controller.abort();
      }
      
      // Determine which message to finalize - prioritize pending tool message, then current streaming message
      const messageIdToFinalize = pendingToolMessageId || currentStreamingMessageId;
      
      // If we have a message being generated, finalize it with whatever content it currently has
      if (messageIdToFinalize && currentIsGenerating) {
        const currentMessage = get().messageEntities[messageIdToFinalize];
        if (currentMessage) {
          // Special handling for tool use: remove incomplete tool_use blocks
          if (pendingToolMessageId) {
            console.log('[chatStore][stopStream] Removing incomplete tool_use blocks from message:', messageIdToFinalize);
            
            // Filter out incomplete tool_use blocks (ones without corresponding tool_result)
            const filteredContent = currentMessage.skeleton.content.filter(content => {
              if (content.type === 'tool_use') {
                // Remove tool_use blocks as they are incomplete
                console.log('[chatStore][stopStream] Removing incomplete tool_use:', content.id);
                return false;
              }
              return true;
            });
            
            // Update the message with filtered content
            currentMessage.skeleton.content = filteredContent;
            
            // If no content left after filtering, add a placeholder text
            if (filteredContent.length === 0) {
              currentMessage.skeleton.content = [{
                type: 'text',
                text: '[Generation stopped]'
              }];
            }
          }
          
          // Ensure the message is properly persisted with whatever content it currently has
          console.log('[chatStore][stopStream] Finalizing partial AI response for message:', messageIdToFinalize);
          get().persistEntities([currentMessage]);
          
          // Find the thread and ensure the message is included
          const threadId = currentMessage.skeleton.thread_id;
          const thread = get().threadEntities[threadId];
          if (thread && !thread.skeleton.message_ids.includes(messageIdToFinalize)) {
            thread.skeleton.message_ids.push(messageIdToFinalize);
            get().persistEntities([thread]);
          }
        }
      }
      
      // Reset all streaming states
      set({ 
        isStreaming: false, 
        isProcessing: false,
        isGenerating: false,
        streamController: null,
        pendingToolMessageId: null,
        currentStreamingMessageId: null
      });
      
      console.log('[chatStore][stopStream] Stream stopped, AI response preserved, chat ready for new input');
    },

    // Thread management
    initialize: async () => {
      if (get().initialized || get().initializationInProgress || !userId) return;
      
      set({ initializationInProgress: true });
      try {
        // Fetch all threads for the user
        const threads = await entityService.queryEntities({
          entityType: 'Thread',
          user_id: userId
        });
        
        const threadEntities = threads.reduce((acc, thread) => ({
          ...acc,
          [thread._id]: thread as unknown as ThreadEntity
        }), {} as Record<string, ThreadEntity>);

        // Get current thread IDs from space store if available
        const spaceStore = (await import('../../../../stores/spaceStore')).default;
        const spaceState = spaceStore.getState();
        const savedCurrentThreadIds = spaceState.activeSpace?.settings?.spaceChat?.currentThreadIds || {};

        // Fetch messages for any saved current threads
        const messageEntitiesByThread: Record<string, MessageEntity> = {};
        for (const [mode, threadId] of Object.entries(savedCurrentThreadIds)) {
          if (threadId && threadEntities[threadId]) {
            logger.log(`[chatStore][initialize] Loading messages for saved thread ${threadId} (mode: ${mode})`);
            try {
              const messages = await entityService.queryEntities({
                entityType: 'Message',
                "skeleton.thread_id": threadId
              });
              
              const messageEntities = messages.map(message => message as unknown as MessageEntity);
              messageEntities.forEach(msg => {
                messageEntitiesByThread[msg._id] = msg;
              });
            } catch (error) {
              logger.error(`[chatStore][initialize] Failed to load messages for thread ${threadId}:`, error);
            }
          }
        }

        set({ 
          threadEntities,
          messageEntities: messageEntitiesByThread,
          currentThreadIds: savedCurrentThreadIds,
          initialized: true,
          initializationInProgress: false
        });
        
        logger.log('[chatStore][initialize] Initialization complete with restored threads and messages');
      } catch (error) {
        logger.error('[messageStore][initialize] Error:', error);
        set({ initializationInProgress: false });
        throw error;
      }
    },

    createThread: (mode: ChatMode) => {
      // Create more user-friendly thread names
      const getThreadName = (mode: ChatMode): string => {
        switch (mode) {
          case 'create':
            return 'New Conversation';
          case 'chat':
            return 'New Chat';
          case 'editor':
            return 'New Document';
          case 'exp1':
            return 'New Experiment';
          default:
            return 'New Thread';
        }
      };

      const newThread = messageUtils.createThread(mode, getThreadName(mode), []);

      const newCurrentThreadIds = {
        ...get().currentThreadIds,
        [mode]: newThread._id
      };

      set((state) => ({
        threadEntities: {
          ...state.threadEntities,
          [newThread._id]: newThread
        },
        currentThreadIds: newCurrentThreadIds
      }));

      // Persist to space store
      (async () => {
        try {
          const spaceStore = (await import('../../../../stores/spaceStore')).default;
          const spaceState = spaceStore.getState();
          await spaceState.updateSpaceChatSettings({
            currentThreadIds: newCurrentThreadIds
          });
          logger.log('[chatStore][createThread] Persisted new thread selection to space store');
        } catch (error) {
          logger.error('[chatStore][createThread] Failed to persist new thread selection:', error);
        }
      })();

      return newThread._id;
    },

    setCurrentThread: async (mode: ChatMode, threadId: string) => {
      await get().fetchMessages(threadId);
      
      const newCurrentThreadIds = {
        ...get().currentThreadIds,
        [mode]: threadId
      };
      
      set((state) => ({
        currentThreadIds: newCurrentThreadIds
      }));

      // Persist to space store
      try {
        const spaceStore = (await import('../../../../stores/spaceStore')).default;
        const spaceState = spaceStore.getState();
        await spaceState.updateSpaceChatSettings({
          currentThreadIds: newCurrentThreadIds
        });
        logger.log('[chatStore][setCurrentThread] Persisted thread selection to space store');
      } catch (error) {
        logger.error('[chatStore][setCurrentThread] Failed to persist thread selection:', error);
      }
    },

    getThreadMessages: (threadId: string) => {
      const thread = get().threadEntities[threadId];
      return thread.skeleton.message_ids.map(messageId => get().messageEntities[messageId]);
    },

    persistEntities: async (entities) => {
      try {
        await entityService.batchUpsert(entities);
      } catch (error) {
        logger.error('[messageStore][persistEntities] Error:', error);
        throw error;
      }
    },

    handleStreamError: (error, threadId) => {
      logger.error('[messageStore][handleStreamError] Error:', error);
      
      // Check for specific error types and provide more friendly messages
      let errorMessage: MessageEntity;
      const errorText = error.message || String(error);
      
      if (errorText.includes('high traffic') || errorText.includes('overloaded')) {
        // Claude server overload
        errorMessage = messageUtils.createErrorMessage(
          new Error("Claude's servers are busy right now. Please try again in a moment."), 
          threadId
        );
      } else if (errorText.includes('timeout') || errorText.includes('timed out')) {
        // Request timeout
        errorMessage = messageUtils.createErrorMessage(
          new Error("The request took too long to complete. Please try again."),
          threadId
        );
      } else if (errorText.includes('quota') || errorText.includes('rate limit')) {
        // Rate limit or quota exceeded
        errorMessage = messageUtils.createErrorMessage(
          new Error("You've reached your usage limit for Claude. Please try again later."),
          threadId
        );
      } else {
        // Generic error
        errorMessage = messageUtils.createErrorMessage(error, threadId);
      }
      
      set((state) => ({
        messageEntities: {
          ...state.messageEntities,
          [errorMessage._id]: errorMessage
        }
      }));
    },

    sendMessage: async (props: SendMessageProps) => {
      if (get().isProcessing) {
        logger.log('[chatStore][sendMessage] Already processing, skipping');
        return null;
      };

      const { content, threadId, mode, context, model } = props;
      if (content.type === 'text' && !content.text.trim()) return null;

      set({ isProcessing: true, isGenerating: true });

      try {
        let thread = get().threadEntities[threadId];
        if (!thread) {
          logger.log('[chatStore][sendMessage] Creating new thread');
          thread = messageUtils.createThread(mode, `New ${mode} thread`, []);
        }
        const userMessage = messageUtils.createMessage([content], 'user', thread._id);
        const aiMessage = messageUtils.createAIMessage([], thread._id);
        thread.skeleton.message_ids.push(userMessage._id);
        const entities = [userMessage, aiMessage, thread];
        get().persistEntities(entities);
        
        set((state) => ({
          messageEntities: {
            ...state.messageEntities,
            [userMessage._id]: userMessage,
            [aiMessage._id]: aiMessage
          },
          threadEntities: {
            ...state.threadEntities,
            [thread._id]: thread
          },
          currentThreadIds: {
            ...state.currentThreadIds,
            [mode]: thread._id
          },
          isStreaming: true,
          isGenerating: true
        }));

        const streamSuccess = await get().streamMessage(content, context, aiMessage._id, threadId, model);
        if (!streamSuccess) {
          get().handleStreamError(new Error('Stream failed'), threadId);
          return null;
        }
        
        return { userMessage, aiMessage };
      } catch (error) {
        logger.error('[chatStore][sendMessage] Error:', error);
        return null;
      } finally {
        set({ 
          isProcessing: false,
          isStreaming: false,
          // DO NOT reset isGenerating here as handleToolResult may still be active
          // Also clear currentStreamingMessageId if we're not generating anymore
          ...(get().isGenerating ? {} : { currentStreamingMessageId: null })
        });
      }
    },

    streamMessage: async (messageContent: MessageContent, context: SpaceContext, messageId: string, threadId: string, model: string) => {
      try {
        const { getThreadMessages, threadEntities } = get();
        const messageHistory = getThreadMessages(threadId);
        const thread = threadEntities[threadId];
        logger.log('[context-debug][chatStore][streamMessage] context:', context);

        // Ensure isGenerating is set to true throughout this process and track the streaming message
        set({ isGenerating: true, currentStreamingMessageId: messageId });

        // Start the stream and immediately store the controller for cancellation
        const streamPromise = stream({
          messageContent,
          context,
          messageId,
          model,
          messageHistory: messageUtils.convertMessagesToClaudeFormat(messageHistory),
          logPrefix: 'sendMessage',
          onControllerReady: (controller) => {
            // Store the controller immediately when stream starts
            console.log('[chatStore][streamMessage] Controller ready, storing for cancellation');
            set({ streamController: controller });
          },
          onText: (text, fullResponse, messageId) => {
            set((state) => {
              const aiMessage = state.messageEntities[messageId];
              if (aiMessage) {
                aiMessage.skeleton.content = [{
                  type: 'text',
                  text: fullResponse
                }];
                if (!thread.skeleton.message_ids.includes(messageId)) {
                  thread.skeleton.message_ids.push(messageId);
                }
                return { 
                  messageEntities: { ...state.messageEntities, [messageId]: aiMessage },
                  threadEntities: { ...state.threadEntities, [thread._id]: thread },
                  isGenerating: true, // Ensure this stays true during text updates
                  currentStreamingMessageId: messageId // Keep tracking the streaming message
                };
              }
              return state;
            });
          },
          onToolUse: async (toolUse, messageId) => {
            logger.log('[chatStore][streamMessage][onToolUse] Tool use:', toolUse);
            const thread = get().threadEntities[threadId];
            const message = get().messageEntities[messageId];
            const updatedMessage = messageUtils.pushToolUseToMessage(message, toolUse);
            
            if (!thread.skeleton.message_ids.includes(updatedMessage._id)) {
              thread.skeleton.message_ids.push(updatedMessage._id);
              get().persistEntities([updatedMessage, thread]);
            } else {
              get().persistEntities([updatedMessage]);
            }

            // Critical: set these states together atomically
            set((state) => ({
              messageEntities: {
                ...state.messageEntities,
                [updatedMessage._id]: updatedMessage
              },
              threadEntities: {
                ...state.threadEntities,
                [thread._id]: thread
              },
              pendingToolMessageId: updatedMessage._id,
              isStreaming: false, // Streaming is done but we're still generating
              isGenerating: true, // Keep generating flag true during tool use
              currentStreamingMessageId: null // Clear since we're now in tool use mode
            }));
          },
          onDone: async (fullResponse, messageId, conversationTitle) => {
            const aiMessage = get().messageEntities[messageId];
            thread.name = conversationTitle;
            get().persistEntities([aiMessage, thread]);
            
            // Only if we don't have a pending tool, we can set isGenerating to false
            if (!get().pendingToolMessageId) {
              set({ isGenerating: false, currentStreamingMessageId: null });
            }
          },
          onError: (error) => {
            get().handleStreamError(error as Error, threadId);
            // Set isGenerating to false on error and clear streaming message
            set({ isGenerating: false, currentStreamingMessageId: null });
          }
        }).catch(error => {
          get().handleStreamError(error as Error, threadId);
          set({ isGenerating: false, currentStreamingMessageId: null });
          return null;
        });

        // We need to get the controller from the stream immediately, not after it completes
        // The stream() function returns a promise, but we need the controller sync
        // Let's modify this to get the controller immediately
        let streamResult = null;
        try {
          // Since stream() returns both result and controller, we await it but store controller immediately
          streamResult = await streamPromise;
          
          // Controller is now stored immediately via onControllerReady callback
        } catch (error) {
          get().handleStreamError(error as Error, threadId);
          set({ isGenerating: false, currentStreamingMessageId: null });
          return false;
        }

        // If at this point we have no pending tool message and no errors, we're done generating
        if (!get().pendingToolMessageId && streamResult !== null) {
          set({ isGenerating: false, currentStreamingMessageId: null });
        }

        return streamResult !== null;
      } catch (error) {
        get().handleStreamError(error as Error, threadId);
        set({ isGenerating: false, currentStreamingMessageId: null });
        return false;
      }
    },

    handleToolResult: (toolUseId, content, context, threadId, model) => {
      // Always set isGenerating to true when handling a tool result
      // but reset pendingToolMessageId to prepare for the next response
      set({
        pendingToolMessageId: null,
        isProcessing: false,
        isGenerating: true // Explicitly set this to ensure the Stop button shows
      });

      const thread = get().threadEntities[threadId];
      const mode = thread.skeleton.mode;
      
      // Create a structured tool result if it's not already structured
      const structuredResult = content.status ? content : {
        status: content.error ? 'error' : 'success',
        message: content.error ? `Error: ${content.error}` : 'Tool executed successfully',
        data: content
      };
      
      // If this was a document-related tool, refresh the context
      const isDocUpdateTool = toolUseId.startsWith('docs_') || 
                            (typeof content?.name === 'string' && content.name.startsWith('docs_'));
      
      // Format the tool result for Claude's API (must be string or array of content blocks)
      // Claude doesn't accept complex objects in tool_result.content
      const formattedToolResult = JSON.stringify(structuredResult);
      
      // Send tool result to continue the conversation
      get().sendMessage({
        content: {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: formattedToolResult
        },
        threadId: thread._id,
        mode: mode as ChatMode,
        context: isDocUpdateTool ? { ...context, _refreshTimestamp: Date.now() } : context, // Force context refresh if needed
        model
      }).then(() => {
        // If generation completes successfully, this will be set to false by 
        // the streamMessage's onDone handler
      }).catch((error) => {
        logger.error('[chatStore][handleToolResult] Error:', error);
        // If sendMessage fails, make sure to reset isGenerating
        set({ isGenerating: false });
      });
    },

    fetchMessages: async (threadId) => {
      const messages = await entityService.queryEntities({
        entityType: 'Message',
        "skeleton.thread_id": threadId
      });
      const messageEntities = messages.map(message => message as unknown as MessageEntity);
      set((state) => ({
        messageEntities: {
          ...state.messageEntities,
          ...Object.fromEntries(messageEntities.map(msg => [msg._id, msg]))
        }
      }));
      return messageEntities;
    }
  }));
}; 

export const useChatStore = (userId: string) => useStore(useMemo(() => createChatStore(userId), [userId]));

export const useChatStoreSelector = <T>(userId: string, selector: (state: ChatStoreState) => T) => {
  const store = useChatStore(userId);
  return useMemo(() => selector(store), [store, selector]);
};
