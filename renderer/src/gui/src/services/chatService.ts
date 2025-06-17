import fetchService from './fetchService';
import { ThreadEntity, MessageEntity, UIThread, UIMessage, UIThreadWithMessages, ChatError, ChatErrorType } from '../types/chatApp';
// import { ThreadEntity, MessageEntity } from '../types/chat';
import { API_BASE_URL } from '../api/config';
import { extractId } from '../utils/mongoUtils';
import { logger } from '../utils/logger';

// For development environment detection 
const isDevelopment = process.env.NODE_ENV === 'development';

// Update the ChatSettings type to include model and systemPrompt
interface ChatSettings {
  filter?: string[];
  model?: string;
  systemPrompt?: string;
  use_rag?: boolean;
}

// Helper function to validate model names
function validateModelName(model: string | undefined): string {
  // Default model if none provided
  if (!model) return 'gpt-3.5-turbo';
  
  // List of supported models
  const supportedModels = [
    // OpenAI models
    'gpt-3.5-turbo',
    'gpt-4',
    
    // Claude models
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229'
  ];
  
  // Map legacy model names to supported ones
  const modelMapping: Record<string, string> = {
    'claude-3.5-sonnet': 'claude-3-5-sonnet-20240620',
    'claude-3-sonnet': 'claude-3-sonnet-20240229'
  };
  
  // Check if we need to map this model name
  if (model in modelMapping) {
    logger.log(`Converting model name from ${model} to ${modelMapping[model]}`);
    return modelMapping[model];
  }
  
  // Check if model is supported
  if (supportedModels.includes(model)) {
    return model;
  }
  
  // Fall back to default
  logger.warn(`Unsupported model: ${model}, falling back to gpt-3.5-turbo`);
  return 'gpt-3.5-turbo';
}

class ChatService {
  // Helper functions to convert API types to UI types
  private convertThreadToUI(thread: ThreadEntity): UIThread {
    return {
      id: extractId(thread._id, 'convertThreadToUI'),
      title: thread.skeleton.title,
      created: new Date(thread.created_at),
      updated: new Date(thread.updated_at),
      pinned: thread.skeleton.pinned,
      messageIds: thread.skeleton.messages?.map(msgId => extractId(msgId, 'convertThreadToUI.messageIds')) || []
    };
  }

  private convertMessageToUI(message: MessageEntity): UIMessage {
    return {
      id: extractId(message._id, 'convertMessageToUI'),
      content: message.skeleton.content,
      sender: message.skeleton.sender,
      threadId: extractId(message.skeleton.threadId, 'convertMessageToUI.threadId'),
      created: new Date(message.created_at),
      updated: new Date(message.updated_at),
      sourceEntities: message.skeleton.sourceEntities
    };
  }

  private getAuthHeaders(): Record<string, string> {
    const authToken = localStorage.getItem('authToken');
    return authToken 
      ? {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      : {
          'Content-Type': 'application/json'
        };
  }

  // Thread related functions
  async getThreads(): Promise<UIThread[]> {
    try {
      const response = await fetchService(`${API_BASE_URL}/threads`);
      logger.log('Raw thread response:', response);
      
      // Check if response is an array
      if (Array.isArray(response)) {
        return response.map((thread: ThreadEntity) => this.convertThreadToUI(thread));
      } 
      // Check if response has a data property that's an array
      else if (response && Array.isArray(response.data)) {
        return response.data.map((thread: ThreadEntity) => this.convertThreadToUI(thread));
      }
      // If response is empty or invalid, return empty array
      else {
        logger.warn('Unexpected response format from threads endpoint:', response);
        return [];
      }
    } catch (error) {
      logger.error('Error fetching threads:', error);
      throw new ChatError(
        'Failed to fetch threads',
        'NETWORK_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async getThread(threadId: string | any): Promise<UIThreadWithMessages> {
    try {
      // Extra debugging for the threadId
      logger.log('getThread called with:', threadId);
      logger.log('threadId type:', typeof threadId);
      
      // Extract the ID using our utility function
      let threadIdStr: string;
      try {
        threadIdStr = extractId(threadId, 'ChatService.getThread');
      } catch (error: unknown) {
        logger.error('Failed to extract thread ID:', error);
        if (error instanceof Error) {
          throw new Error(`Invalid thread ID format: ${error.message}`);
        } else {
          throw new Error(`Invalid thread ID format: ${String(error)}`);
        }
      }
      
      logger.log(`Fetching thread with ID: ${threadIdStr}`);
      
      const response = await fetchService(`${API_BASE_URL}/threads/${threadIdStr}`);
      logger.log('Raw thread detail response:', response);
      
      // Validate the response structure
      if (!response) {
        throw new Error('Empty response from thread detail endpoint');
      }
      
      const thread = this.convertThreadToUI(response);
      
      // Check if messages exists and is an array
      const messages = Array.isArray(response.messages) 
        ? response.messages.map((message: MessageEntity) => this.convertMessageToUI(message))
        : [];
      
      return {
        thread,
        messages
      };
    } catch (error) {
      logger.error(`Error fetching thread ${threadId}:`, error);
      throw new ChatError(
        'Failed to fetch thread',
        'NETWORK_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async createThread(title: string): Promise<UIThread> {
    try {
      const response = await fetchService(`${API_BASE_URL}/threads`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ title })
      });
      return this.convertThreadToUI(response);
    } catch (error) {
      logger.error('Error creating thread:', error);
      throw new ChatError(
        'Failed to create thread',
        'NETWORK_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async updateThread(threadId: string | any, data: { title?: string, pinned?: boolean }): Promise<UIThread> {
    try {
      // Extract the ID using the helper function
      const threadIdStr = extractId(threadId, 'ChatService.updateThread');
      
      const response = await fetchService(`${API_BASE_URL}/threads/${threadIdStr}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return this.convertThreadToUI(response);
    } catch (error) {
      logger.error(`Error updating thread ${threadId}:`, error);
      throw new ChatError(
        'Failed to update thread',
        'NETWORK_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async deleteThread(threadId: string | any): Promise<void> {
    try {
      // Extract the ID using the helper function
      const threadIdStr = extractId(threadId, 'ChatService.deleteThread');
      
      await fetchService(`${API_BASE_URL}/threads/${threadIdStr}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      logger.error(`Error deleting thread ${threadId}:`, error);
      throw new ChatError(
        'Failed to delete thread',
        'NETWORK_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Message related functions
  async getMessages(threadId: string | any): Promise<UIMessage[]> {
    try {
      // Extract the ID using the helper function
      const threadIdStr = extractId(threadId, 'ChatService.getMessages');
      
      const response = await fetchService(`${API_BASE_URL}/threads/${threadIdStr}/messages`);
      
      if (!response || !response.messages) {
        logger.warn('Unexpected response format from messages endpoint:', response);
        return [];
      }
      
      return response.messages.map((message: MessageEntity) => this.convertMessageToUI(message));
    } catch (error) {
      logger.error(`Error fetching messages for thread ${threadId}:`, error);
      throw new ChatError(
        'Failed to fetch messages',
        'NETWORK_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Get messages in batches for pagination
  async getMessagesBatch(
    threadId: string | any, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<{
    messages: UIMessage[],
    pagination: {
      total: number,
      limit: number,
      offset: number
    }
  }> {
    try {
      // Extract the ID using the helper function
      const threadIdStr = extractId(threadId, 'ChatService.getMessagesBatch');
      
      const response = await fetchService(
        `${API_BASE_URL}/threads/${threadIdStr}/messages?limit=${limit}&offset=${offset}`
      );
      
      if (!response || !response.messages) {
        logger.warn('Unexpected response format from messages batch endpoint:', response);
        return {
          messages: [],
          pagination: { total: 0, limit, offset }
        };
      }
      
      return {
        messages: response.messages.map((message: MessageEntity) => this.convertMessageToUI(message)),
        pagination: response.pagination || { total: response.messages.length, limit, offset }
      };
    } catch (error) {
      logger.error(`Error fetching message batch for thread ${threadId}:`, error);
      throw new ChatError(
        'Failed to fetch message batch',
        'NETWORK_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async createMessage(threadId: string | any, content: string): Promise<UIMessage> {
    try {
      // Extract the ID using the helper function
      const threadIdStr = extractId(threadId, 'ChatService.createMessage');
      
      const response = await fetchService(`${API_BASE_URL}/threads/${threadIdStr}/messages`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ content, sender: 'User' })
      });
      return this.convertMessageToUI(response);
    } catch (error) {
      logger.error(`Error creating message in thread ${threadId}:`, error);
      throw new ChatError(
        'Failed to create message',
        'NETWORK_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async sendChatMessage(
    threadId: string | any,
    message: string,
    settings?: ChatSettings
  ): Promise<ChatResponse> {
    try {
      // Extract the ID using the helper function
      const threadIdStr = extractId(threadId, 'ChatService.sendChatMessage');
      
      // Make a copy of settings to avoid modifying the original
      const validatedSettings = settings ? { ...settings } : {};
      
      // Validate and potentially convert model name if provided
      if (validatedSettings.model) {
        validatedSettings.model = validateModelName(validatedSettings.model);
      }
      
      logger.log('📤 Sending chat message to API with:');
      logger.log(`🧵 Thread ID: ${threadIdStr}`);
      logger.log(`💬 Message: ${message.length > 50 ? message.substring(0, 50) + '...' : message}`);
      logger.log(`⚙️ Settings:`, validatedSettings);
      
      const requestBody = { message, settings: validatedSettings };
      logger.log('📦 Request body:', JSON.stringify(requestBody));
      
      const url = `${API_BASE_URL}/threads/${threadIdStr}/chat`;
      logger.log(`🌐 Request URL: ${url}`);
      
      const response = await fetchService(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });
      
      logger.log('📥 Received response from API:');
      logger.log('📋 Response structure:', Object.keys(response));
      
      // Validate response structure
      if (!response) {
        logger.error('❌ Empty response received from chat API');
        throw new Error('Empty response received from API');
      }
      
      if (response.error) {
        logger.error('❌ Error in API response:', response.error);
        throw new Error(`API error: ${response.error.message || JSON.stringify(response.error)}`);
      }
      
      // Check for required fields
      if (!response.answer) {
        logger.error('❌ Missing answer in response:', response);
        throw new Error('Invalid response format: missing answer');
      }
      
      logger.log('✅ Successfully processed chat message');
      logger.log(`🤖 AI response (${response.answer.length} chars): ${response.answer.substring(0, 50)}...`);
      
      return {
        userMessage: response.userMessage,
        aiMessage: response.aiMessage,
        answer: response.answer,
        entities_used: response.entities_used || []
      };
    } catch (error) {
      logger.error(`❌ Error sending chat message in thread ${threadId}:`, error);
      logger.error('📜 Error details:', error instanceof Error ? error.stack : String(error));
      throw new ChatError(
        'Failed to send chat message',
        'NETWORK_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Send a chat message with RAG (Retrieval Augmented Generation)
  async sendChatMessageWithRAG(
    threadId: string | any,
    message: string,
    settings?: ChatSettings
  ): Promise<ChatResponse> {
    try {
      // Extract the ID using the helper function
      const threadIdStr = extractId(threadId, 'ChatService.sendChatMessageWithRAG');
      
      // Make a copy of settings to avoid modifying the original
      const validatedSettings = settings ? { ...settings } : {};
      
      // Validate and potentially convert model name if provided
      if (validatedSettings.model) {
        validatedSettings.model = validateModelName(validatedSettings.model);
      }
      
      logger.log('📤 Sending chat message with RAG to API with:');
      logger.log(`🧵 Thread ID: ${threadIdStr}`);
      logger.log(`💬 Message: ${message.length > 50 ? message.substring(0, 50) + '...' : message}`);
      logger.log(`⚙️ Settings:`, validatedSettings);
      
      const requestBody = { message, settings: validatedSettings };
      logger.log('📦 Request body:', JSON.stringify(requestBody));
      
      const url = `${API_BASE_URL}/threads/${threadIdStr}/chat_rag`;
      logger.log(`🌐 Request URL: ${url}`);
      
      const response = await fetchService(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });
      
      logger.log('📥 Received response from API:');
      logger.log('📋 Response structure:', Object.keys(response));
      
      // Validate response structure
      if (!response) {
        logger.error('❌ Empty response received from chat API');
        throw new Error('Empty response received from API');
      }
      
      if (response.error) {
        logger.error('❌ Error in API response:', response.error);
        throw new Error(`API error: ${response.error.message || JSON.stringify(response.error)}`);
      }
      
      // Check for required fields
      if (!response.answer) {
        logger.error('❌ Missing answer in response:', response);
        throw new Error('Invalid response format: missing answer');
      }
      
      logger.log('✅ Successfully processed chat message with RAG');
      logger.log(`🤖 AI response (${response.answer.length} chars): ${response.answer.substring(0, 50)}...`);
      
      return {
        userMessage: response.userMessage,
        aiMessage: response.aiMessage,
        answer: response.answer,
        entities_used: response.entities_used || []
      };
    } catch (error) {
      logger.error(`❌ Error sending chat message with RAG in thread ${threadId}:`, error);
      logger.error('📜 Error details:', error instanceof Error ? error.stack : String(error));
      throw new ChatError(
        'Failed to send chat message with RAG',
        'NETWORK_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

// Export a singleton instance
export const chatService = new ChatService();

// Maintain the previous API for backward compatibility
export const getThreads = () => chatService.getThreads();
export const getThread = (threadId: any) => {
  try {
    const threadIdStr = extractId(threadId, 'getThread');
    logger.log('getThread delegate called with:', threadId, 'using ID:', threadIdStr);
    return chatService.getThread(threadIdStr);
  } catch (error) {
    logger.error('Error extracting thread ID:', error);
    // Throw a user-friendly error to be handled by the UI
    throw new ChatError(
      'Invalid thread ID format',
      'INVALID_PARAMETER',
      error instanceof Error ? error : new Error(String(error))
    );
  }
};
export const createThread = (title: string) => chatService.createThread(title);
export const updateThread = (threadId: any, data: { title?: string, pinned?: boolean }) => {
  try {
    const threadIdStr = extractId(threadId, 'updateThread');
    return chatService.updateThread(threadIdStr, data);
  } catch (error) {
    logger.error('Error extracting thread ID:', error);
    throw new ChatError(
      'Invalid thread ID format',
      'INVALID_PARAMETER',
      error instanceof Error ? error : new Error(String(error))
    );
  }
};
export const deleteThread = (threadId: any) => {
  try {
    const threadIdStr = extractId(threadId, 'deleteThread');
    return chatService.deleteThread(threadIdStr);
  } catch (error) {
    logger.error('Error extracting thread ID:', error);
    throw new ChatError(
      'Invalid thread ID format', 
      'INVALID_PARAMETER',
      error instanceof Error ? error : new Error(String(error))
    );
  }
};
export const getMessages = (threadId: any) => {
  try {
    const threadIdStr = extractId(threadId, 'getMessages');
    return chatService.getMessages(threadIdStr);
  } catch (error) {
    logger.error('Error extracting thread ID:', error);
    throw new ChatError(
      'Invalid thread ID format',
      'INVALID_PARAMETER',
      error instanceof Error ? error : new Error(String(error))
    );
  }
};
export const getMessagesBatch = (threadId: any, limit?: number, offset?: number) => {
  try {
    const threadIdStr = extractId(threadId, 'getMessagesBatch');
    return chatService.getMessagesBatch(threadIdStr, limit, offset);
  } catch (error) {
    logger.error('Error extracting thread ID:', error);
    throw new ChatError(
      'Invalid thread ID format',
      'INVALID_PARAMETER',
      error instanceof Error ? error : new Error(String(error))
    );
  }
};
export const createMessage = (threadId: any, content: string) => {
  try {
    const threadIdStr = extractId(threadId, 'createMessage');
    return chatService.createMessage(threadIdStr, content);
  } catch (error) {
    logger.error('Error extracting thread ID:', error);
    throw new ChatError(
      'Invalid thread ID format',
      'INVALID_PARAMETER',
      error instanceof Error ? error : new Error(String(error))
    );
  }
};
export const sendChatMessage = (threadId: any, message: string, settings?: ChatSettings) => {
  try {
    const threadIdStr = extractId(threadId, 'sendChatMessage');
    return chatService.sendChatMessage(threadIdStr, message, settings);
  } catch (error) {
    logger.error('Error extracting thread ID:', error);
    throw new ChatError(
      'Invalid thread ID format',
      'INVALID_PARAMETER',
      error instanceof Error ? error : new Error(String(error))
    );
  }
};
export const sendChatMessageWithRAG = (threadId: any, message: string, settings?: ChatSettings) => {
  try {
    const threadIdStr = extractId(threadId, 'sendChatMessageWithRAG');
    return chatService.sendChatMessageWithRAG(threadIdStr, message, settings);
  } catch (error) {
    logger.error('Error extracting thread ID:', error);
    throw new ChatError(
      'Invalid thread ID format',
      'INVALID_PARAMETER',
      error instanceof Error ? error : new Error(String(error))
    );
  }
};

// Define and export the ChatResponse type
export interface ChatResponse {
  userMessage: any;
  aiMessage: any;
  answer: string;
  entities_used: any[];
  model?: string;
  threadId?: string;
  timestamp?: string;
  passages_used?: any[];
  personal_model?: any;
} 