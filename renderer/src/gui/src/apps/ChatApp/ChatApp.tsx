import './ChatApp.scss';

import React, { useEffect, useRef, useState } from 'react';

import { UIMessage as ChatUIMessage, UIThread } from '../../types/chatApp';
import WindowWrapper from '../../WindowWrapper';
import RespondingDots from './RespondingDots';
import ThreadSidebar from './ThreadSidebar';
import { ChatInput } from './ChatInput';
import { ModelType } from './ChatAppModelSelector';
import * as chatService from '../../services/chatService';
import { ChatResponse } from '../../services/chatService';
import { extractId } from '../../utils/mongoUtils';
import Markdown from 'react-markdown';
import { logger } from 'utils/logger';

interface MessageType {
  message: string;
  sentTime: string;
  sender: string;
  sourceEntities?: any[];
  model?: ModelType;
}

// MongoDB interfaces have been moved to utils/mongoUtils.ts

const ChatApp = ({ onClose, title }: { onClose: () => void; title: string }) => {
  const [threads, setThreads] = useState<UIThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isCreatingThread, setIsCreatingThread] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch threads on component mount
  useEffect(() => {
    const fetchThreads = async () => {
      try {
        setLoading(true);
        const fetchedThreads = await chatService.getThreads();
        logger.log('Fetched threads:', fetchedThreads);
        setThreads(fetchedThreads);

        // Set active thread to the most recent one if available
        if (fetchedThreads.length > 0) {
          const sortedThreads = [...fetchedThreads].sort(
            (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
          );

          // Debug log the thread object structure
          logger.log('First thread:', sortedThreads[0]);
          logger.log('Thread ID type:', typeof sortedThreads[0].id);
          logger.log('Thread ID value:', sortedThreads[0].id);

          // Extract ID using helper function
          const threadId = extractId(sortedThreads[0].id);
          logger.log('Extracted thread ID:', threadId);
          setActiveThreadId(threadId);

          // Load messages for this thread
          loadThreadMessages(threadId);
        } else {
          // No threads found, stop loading
          setLoading(false);
        }
      } catch (error) {
        logger.error('Error fetching threads:', error);
        setLoading(false);
      }
    };

    fetchThreads();
  }, []);

  // Load messages for a specific thread
  const loadThreadMessages = async (threadId: any) => {
    try {
      // Add extensive logging for threadId debugging
      logger.log('loadThreadMessages called with threadId:', threadId);
      logger.log('threadId type:', typeof threadId);

      // Extract ID properly using our helper function
      const threadIdStr = extractId(threadId);
      logger.log('Using extracted threadIdStr:', threadIdStr);

      setLoading(true);
      const threadData = await chatService.getThread(threadIdStr);

      if (threadData && 'messages' in threadData && Array.isArray(threadData.messages)) {
        logger.log('Thread data with messages:', threadData);
        // Convert API message format to our UI format
        const formattedMessages = threadData.messages.map((msg: ChatUIMessage) => ({
          message: msg.content,
          sentTime: new Date(msg.created).toLocaleTimeString(),
          sender: msg.sender,
          sourceEntities: msg.sourceEntities || [],
        }));

        setMessages(formattedMessages);
      } else {
        // Default welcome message if no messages
        setMessages([
          {
            message: 'Hello! How can I assist you today?',
            sentTime: 'just now',
            sender: 'AI',
            sourceEntities: [],
          },
        ]);
      }
    } catch (error) {
      logger.error('Error loading thread messages:', error);
      // Set a default message in case of error
      setMessages([
        {
          message: 'Hello! How can I assist you today?',
          sentTime: 'just now',
          sender: 'AI',
          sourceEntities: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle thread selection
  const handleSelectThread = (threadId: any) => {
    logger.log('Selected thread ID:', threadId, 'Type:', typeof threadId);

    // Extract the ID using our helper function
    const threadIdStr = extractId(threadId);
    logger.log('Using extracted threadIdStr:', threadIdStr);

    setActiveThreadId(threadIdStr);
    loadThreadMessages(threadIdStr);
  };

  // Handle creating a new thread
  const handleCreateThread = async () => {
    setIsCreatingThread(true);
    try {
      const newThread = await chatService.createThread('New Conversation');
      setThreads((prevThreads) => [newThread, ...prevThreads]);
      // Extract ID using our helper function
      const threadId = extractId(newThread.id);
      setActiveThreadId(threadId);

      // Reset messages for the new thread
      setMessages([
        {
          message: 'Hello! How can I assist you today?',
          sentTime: 'just now',
          sender: 'AI',
          sourceEntities: [],
        },
      ]);
    } catch (error) {
      logger.error('Error creating thread:', error);
    } finally {
      setIsCreatingThread(false);
    }
  };

  const handleSendMessage = async (
    message: string,
    model: ModelType = 'gpt-3.5-turbo',
    options?: { useRAG?: boolean },
  ): Promise<void> => {
    let threadId: any = activeThreadId;
    logger.log('Initial threadId:', threadId);
    logger.log('Using model:', model);
    logger.log('RAG enabled:', options?.useRAG !== false);

    // Create a thread if none exists
    if (!threadId) {
      try {
        logger.log('Creating new thread...');
        const newThread = await chatService.createThread('New Conversation');
        logger.log('New thread created:', newThread);
        setThreads((prevThreads) => [newThread, ...prevThreads]);
        // Use the new thread ID directly instead of waiting for state update
        threadId = newThread.id;
        logger.log('Using new threadId:', threadId, 'Type:', typeof threadId);
        setActiveThreadId(threadId);
      } catch (error) {
        logger.error('Error creating thread:', error);
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            message: 'Error: Unable to create a new thread',
            sentTime: 'just now',
            sender: 'AI',
            sourceEntities: [],
            model: model,
          },
        ]);
        return;
      }
    }

    // Double-check that we have a valid thread ID by this point
    if (!threadId) {
      logger.error('Failed to create or retrieve a valid thread ID');
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          message: 'Error: Unable to send message without a valid thread',
          sentTime: 'just now',
          sender: 'AI',
          sourceEntities: [],
          model: model,
        },
      ]);
      return;
    }

    // Extract the ID using our helper function
    const threadIdStr = extractId(threadId);
    logger.log('Using extracted threadIdStr for message:', threadIdStr);

    // Add user message to the UI immediately
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        message: message,
        sentTime: 'just now',
        sender: 'User',
        model: model,
      },
    ]);

    setLoading(true); // waiting for backend to respond

    try {
      logger.log('Sending chat message to thread:', threadIdStr, 'Type:', typeof threadIdStr);
      logger.log('Using model:', model);

      // Determine whether to use RAG-enhanced endpoint
      const useRAG = options?.useRAG !== false; // Default to true if not specified

      let data: ChatResponse;
      if (useRAG) {
        // Use RAG-enhanced endpoint
        logger.log('Using RAG-enhanced processing');
        data = await chatService.sendChatMessageWithRAG(threadIdStr, message, {
          model: model,
          use_rag: true,
          systemPrompt:
            "You are Gal, a helpful and friendly AI assistant. Answer the user's questions thoughtfully and accurately.",
        });
      } else {
        // Use standard endpoint
        logger.log('Using standard chat processing');
        data = await chatService.sendChatMessage(threadIdStr, message, {
          model: model,
          systemPrompt:
            "You are Gal, a helpful and friendly AI assistant. Answer the user's questions thoughtfully and accurately.",
        });
      }

      // Extract the AI response from the data
      const aiResponse = data.answer;

      // Update states with response data
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          message: aiResponse,
          sentTime: 'just now',
          sender: 'AI',
          sourceEntities: data.entities_used || [],
          model: model,
        },
      ]);

      // Update thread list to show this thread at the top (most recent)
      if (threads.length > 0) {
        // Find and update the current thread's position
        const updatedThreads = [...threads];
        const threadIndex = updatedThreads.findIndex((t) => extractId(t.id) === threadIdStr);

        if (threadIndex > 0) {
          // Remove thread from current position and add to the beginning
          const thread = updatedThreads.splice(threadIndex, 1)[0];
          updatedThreads.unshift(thread);
          setThreads(updatedThreads);
        }
      }
    } catch (error: unknown) {
      logger.error('Error during chat:', error);

      // Extract a more useful error message if possible
      let errorMessage = 'Error: Unable to reach AI';

      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }

      // Add error message to chat
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          message: errorMessage,
          sentTime: 'just now',
          sender: 'AI',
          sourceEntities: [],
          model: model,
        },
      ]);
    } finally {
      setLoading(false); // Hide animation when the response arrives
    }
  };

  return (
    // Conditionally wrap in WindowWrapper based on GUI vs standalone
    onClose ? (
      <WindowWrapper title={title} onClose={onClose}>
        <ChatAppContent
          messages={messages}
          handleSendMessage={handleSendMessage}
          loading={loading}
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={handleSelectThread}
          onCreateThread={handleCreateThread}
          isCreatingThread={isCreatingThread}
        />
      </WindowWrapper>
    ) : (
      <ChatAppContent
        messages={messages}
        handleSendMessage={handleSendMessage}
        loading={loading}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onCreateThread={handleCreateThread}
        isCreatingThread={isCreatingThread}
      />
    )
  );
};

interface ChatAppContentProps {
  messages: MessageType[];
  handleSendMessage: (message: string, model: ModelType, options?: { useRAG?: boolean }) => void;
  loading: boolean;
  threads: UIThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  isCreatingThread: boolean;
}

const ChatAppContent: React.FC<ChatAppContentProps> = ({
  messages,
  handleSendMessage,
  loading,
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  isCreatingThread,
}) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleSidebar = () => setSidebarCollapsed(!isSidebarCollapsed);

  // Get the current active thread title
  const getActiveThreadTitle = () => {
    if (!activeThreadId) return 'New Conversation';

    // Extract the active thread ID
    const activeIdStr = extractId(activeThreadId);

    // Find the thread by comparing IDs
    const activeThread = threads.find((thread) => {
      // Extract thread ID using our helper function
      const threadIdStr = extractId(thread.id);
      return threadIdStr === activeIdStr;
    });

    return activeThread?.title || 'New Conversation';
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="appMain">
      <div className="chat-container-wrapper">
        {/* Thread Sidebar with collapse functionality */}
        {!isSidebarCollapsed && (
          <ThreadSidebar
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={onSelectThread}
            onCreateThread={onCreateThread}
            onToggleSidebar={toggleSidebar}
            isCreatingThread={isCreatingThread}
          />
        )}

        {/* Main Chat Area */}
        <div className="chat-main">
          {/* Conversation title header */}
          <div className="chat-header">
            <h2 className="conversation-title">{getActiveThreadTitle()}</h2>
          </div>

          <div className="messages-container">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender.toLowerCase()}`}>
                {msg.model && <div className="message-model-badge">{msg.model}</div>}
                <div className="message-content">
                  <div className="message-text">
                    <Markdown>{msg.message}</Markdown>
                  </div>
                  {/* Removed source entities display */}
                </div>
              </div>
            ))}
            {loading && <RespondingDots />}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput onSendMessage={handleSendMessage} isProcessing={loading} placeholder="Message Gal..." />
        </div>
      </div>
    </div>
  );
};

export default ChatApp;
