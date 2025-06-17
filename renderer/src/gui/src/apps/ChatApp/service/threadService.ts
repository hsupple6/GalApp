import { API_BASE_URL } from '../../../api/config';
import { MessageEntity, ThreadEntity } from '../../../types';
import fetchService from '../../../services/fetchService';

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem('authToken');

// Helper for API requests
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const authToken = getAuthToken();
  const method = options.method || 'GET';
  
  // Only include Content-Type for requests that have a body
  const hasBody = options.body && method !== 'GET' && method !== 'HEAD';
  
  const headers: HeadersInit = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  try {
    return await fetchService(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Include credentials for CORS
    });
  } catch (error) {
    console.error(`API error for ${endpoint}:`, error);
    throw error;
  }
};

// Thread API functions
export const getThreads = async (): Promise<ThreadEntity[]> => {
  try {
    const data = await apiRequest('/threads');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching threads:', error);
    return [];
  }
};

export const getThread = async (threadId: string): Promise<any> => {
  try {
    return await apiRequest(`/threads/${threadId}`);
  } catch (error) {
    console.error(`Error fetching thread ${threadId}:`, error);
    throw error;
  }
};

export const createThread = async (title: string): Promise<ThreadEntity> => {
  try {
    return await apiRequest('/threads', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    throw error;
  }
};

export const updateThread = async (threadId: string, data: Partial<ThreadEntity>): Promise<ThreadEntity> => {
  try {
    return await apiRequest(`/threads/${threadId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error(`Error updating thread ${threadId}:`, error);
    throw error;
  }
};

export const deleteThread = async (threadId: string): Promise<void> => {
  try {
    return await apiRequest(`/threads/${threadId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error(`Error deleting thread ${threadId}:`, error);
    throw error;
  }
};

// Message API functions
export const getMessages = async (threadId: string): Promise<MessageEntity[]> => {
  try {
    const data = await apiRequest(`/threads/${threadId}/messages`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching messages for thread ${threadId}:`, error);
    return [];
  }
};

export const createMessage = async (threadId: string, content: string, sender: 'User' | 'AI'): Promise<MessageEntity> => {
  try {
    return await apiRequest(`/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, sender }),
    });
  } catch (error) {
    console.error(`Error creating message in thread ${threadId}:`, error);
    throw error;
  }
};

// Chat in a specific thread (sends user message and gets AI response)
export interface ChatResponse {
  userMessage: MessageEntity;
  aiMessage: MessageEntity;
  answer: string;
  entities_used: any[];
}

export const sendChatMessage = async (
  threadId: string, 
  message: string, 
  settings?: any
): Promise<ChatResponse> => {
  try {
    return await apiRequest(`/threads/${threadId}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        settings,
      }),
    });
  } catch (error) {
    console.error(`Error sending chat message to thread ${threadId}:`, error);
    throw error;
  }
}; 