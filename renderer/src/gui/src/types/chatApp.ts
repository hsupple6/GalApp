// API Types
export interface ThreadEntity {
  _id: string;
  entityType: "Thread";
  userId: string;
  type: "thread";
  name: string;
  created_at: string;
  updated_at: string;
  skeleton: {
    "@type": "Thread";
    title: string;
    messages: string[];
    pinned?: boolean;
  };
}

export interface MessageEntity {
  _id: string;
  entityType: "Message";
  userId: string;
  type: "message";
  name: string;
  created_at: string;
  updated_at: string;
  skeleton: {
    "@type": "Message";
    content: string;
    sender: "User" | "AI";
    threadId: string;
    sourceEntities: string[];
  };
}

// UI Types
export interface UIThread {
  id: string;
  title: string;
  created: Date;
  updated: Date;
  pinned?: boolean;
  messageIds: string[];
}

export interface UIMessage {
  id: string;
  content: string;
  sender: "User" | "AI";
  threadId: string;
  created: Date;
  updated: Date;
  sourceEntities: string[];
}

// Chat UI Thread with Messages
export interface UIThreadWithMessages {
  thread: UIThread;
  messages: UIMessage[];
}

// Chat Response Types
export interface ChatResponse {
  userMessage: MessageEntity;
  aiMessage: MessageEntity;
  answer: string;
  entities_used: any[];
}

// Error Types
export type ChatErrorType = 'NOT_FOUND' | 'PERMISSION_DENIED' | 'NETWORK_ERROR' | 'INVALID_INPUT' | 'INVALID_PARAMETER';

export class ChatError extends Error {
  constructor(
    message: string,
    public type: ChatErrorType,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ChatError';
  }
} 